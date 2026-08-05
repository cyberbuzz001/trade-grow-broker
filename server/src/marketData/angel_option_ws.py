"""
angel_option_ws.py
==================
Real-time option chain streaming via Angel One SmartWebSocketV2.

Architecture:
  1. Authenticate with SmartAPI
  2. Download Scrip Master (cached daily) → filter NIFTY/BANKNIFTY/FINNIFTY options
  3. Subscribe ATM ±15 strikes via SmartWebSocketV2 (mode=FULL)
  4. On each tick → update in-memory cache
  5. Write merged option chain JSON every ~0.5s

Output: server/data/angel_option_chain.json
  {
    "updatedAt": 1722000000000,
    "expiries": { "NIFTY": ["2026-08-07", ...], ... },
    "chains": {
      "NIFTY": {
        "2026-08-07": {
          "spot": 24450.0,
          "rows": [{ "strikePrice": 24400, "ce": {"ltp":45.2,"oi":...}, "pe": {...} }]
        }
      }
    }
  }
"""

import os, sys, time, json, threading, requests, pyotp, traceback
from datetime import datetime, date
from SmartApi import SmartConnect

try:
    from SmartApi.smartWebSocketV2 import SmartWebSocketV2
    WS_AVAILABLE = True
except ImportError:
    WS_AVAILABLE = False
    print("[OptionWS] SmartWebSocketV2 not available — falling back to REST polling", flush=True)

# ── Config ───────────────────────────────────────────────────────────────────
SCRIP_MASTER_URL = "https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json"
ATM_RANGE_STRIKES = 15   # ±15 strikes around ATM
WRITE_INTERVAL    = 0.5  # write JSON every 500ms
MAX_TOKENS_PER_WS = 50   # Angel One WS subscription limit per session

SYMBOLS = ["NIFTY", "BANKNIFTY", "FINNIFTY"]

SPOT_INSTRUMENTS = {
    "NIFTY":     {"exchange": "NSE", "tradingSymbol": "NIFTY 50",   "symbolToken": "99926000"},
    "BANKNIFTY": {"exchange": "NSE", "tradingSymbol": "BANKNIFTY",  "symbolToken": "99926009"},
    "FINNIFTY":  {"exchange": "NSE", "tradingSymbol": "FINNIFTY",   "symbolToken": "99926037"},
}

STEP = {"NIFTY": 50, "BANKNIFTY": 100, "FINNIFTY": 50}

# ── Paths ────────────────────────────────────────────────────────────────────
_BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../.."))
DATA_DIR     = os.path.join(_BASE, "server", "data")
os.makedirs(DATA_DIR, exist_ok=True)

MASTER_FILE  = os.path.join(DATA_DIR, "angel_scrip_master.json")
CHAIN_FILE   = os.path.join(DATA_DIR, "angel_option_chain.json")
TICKS_FILE   = os.path.join(DATA_DIR, "angel_ticks.json")

# ── In-memory state ──────────────────────────────────────────────────────────
tick_cache:   dict = {}   # token → {"ltp", "oi", "volume", "timestamp"}
spot_prices:  dict = {}   # "NIFTY" → 24450.0
chain_index:  dict = {}   # "NIFTY"→{"2026-08-07":[{"token","strike","optionType"},…]}
token_meta:   dict = {}   # token → {"symbol","strike","optionType","expiry"}
expiry_map:   dict = {}   # "NIFTY" → ["2026-08-07", …]
_lock = threading.Lock()

# ─────────────────────────────────────────────────────────────────────────────
# SCRIP MASTER
# ─────────────────────────────────────────────────────────────────────────────
def load_scrip_master() -> list:
    today = date.today().isoformat()
    date_file = MASTER_FILE + ".date"
    cached_date = open(date_file).read().strip() if os.path.exists(date_file) else ""

    if cached_date != today or not os.path.exists(MASTER_FILE):
        print("[OptionWS] Downloading Scrip Master…", flush=True)
        r = requests.get(SCRIP_MASTER_URL, timeout=30)
        r.raise_for_status()
        data = r.json()
        with open(MASTER_FILE, "w") as f: json.dump(data, f)
        with open(date_file, "w") as f:   f.write(today)
        print(f"[OptionWS] Scrip Master: {len(data)} instruments", flush=True)
    else:
        with open(MASTER_FILE) as f: data = json.load(f)
        print(f"[OptionWS] Loaded cached Scrip Master ({len(data)} instruments)", flush=True)
    return data

def parse_expiry(s: str):
    try:    return datetime.strptime(s.strip(), "%d%b%Y").date()
    except: return None

def build_index(master: list) -> None:
    global chain_index, expiry_map, token_meta
    idx:   dict = {}
    tmeta: dict = {}

    for row in master:
        name = row.get("name", "").upper()
        inst = row.get("instrumenttype", "").upper()
        if name not in SYMBOLS or inst != "OPTIDX":
            continue
        exp_date = parse_expiry(row.get("expiry", ""))
        if not exp_date or exp_date < date.today():
            continue
        exp_str = exp_date.isoformat()
        try:    strike = float(row["strike"]) / 100.0
        except: continue
        sym_code = row.get("symbol", "")
        opt_type = sym_code[-2:].upper()
        token    = row.get("token", "")
        if not token or opt_type not in ("CE", "PE"):
            continue

        idx.setdefault(name, {}).setdefault(exp_str, []).append({
            "token": token, "tradingSymbol": sym_code,
            "strike": strike, "optionType": opt_type,
        })
        tmeta[token] = {"symbol": name, "strike": strike,
                         "optionType": opt_type, "expiry": exp_str}

    with _lock:
        chain_index = idx
        token_meta  = tmeta
        expiry_map  = {sym: sorted(exps.keys()) for sym, exps in idx.items()}

    for sym, exps in expiry_map.items():
        print(f"[OptionWS] {sym}: {len(exps)} expiries, nearest={exps[0] if exps else 'N/A'}", flush=True)

# ─────────────────────────────────────────────────────────────────────────────
# ATM TOKEN SELECTION
# ─────────────────────────────────────────────────────────────────────────────
def get_atm_tokens(symbol: str, spot: float) -> list:
    """Returns list of contract dicts for ATM ±ATM_RANGE_STRIKES of nearest 2 expiries."""
    step   = STEP.get(symbol, 50)
    atm    = round(spot / step) * step
    low    = atm - ATM_RANGE_STRIKES * step
    high   = atm + ATM_RANGE_STRIKES * step

    tokens = []
    expiries_for_sym = expiry_map.get(symbol, [])
    for exp in expiries_for_sym[:3]:   # subscribe first 3 expiries
        contracts = chain_index.get(symbol, {}).get(exp, [])
        for c in contracts:
            if low <= c["strike"] <= high:
                tokens.append(c)
    return tokens

def build_all_tokens(spot_dict: dict) -> list:
    all_tokens = []
    for sym in SYMBOLS:
        spot = spot_dict.get(sym, 24500 if sym == "NIFTY" else 52000)
        all_tokens.extend(get_atm_tokens(sym, spot))
    # Deduplicate and cap at MAX_TOKENS_PER_WS
    seen = set()
    result = []
    for t in all_tokens:
        if t["token"] not in seen:
            seen.add(t["token"])
            result.append(t)
    return result[:MAX_TOKENS_PER_WS]

# ─────────────────────────────────────────────────────────────────────────────
# SPOT PRICES
# ─────────────────────────────────────────────────────────────────────────────
def fetch_spot_prices(smart_api: SmartConnect) -> dict:
    spots = {}
    # Wait up to 30s for angel_ticks.json to be populated by angel_ticker.py
    for _ in range(20):
        if os.path.exists(TICKS_FILE):
            try:
                raw = json.load(open(TICKS_FILE))
                n = float(raw.get("NSE_NIFTY50",   {}).get("ltp", 0) or 0)
                b = float(raw.get("NSE_BANKNIFTY", {}).get("ltp", 0) or 0)
                if n > 0 and b > 0:
                    spots["NIFTY"]     = n
                    spots["BANKNIFTY"] = b
                    break
            except: pass
        time.sleep(1.5)

    # Fallback to ltpData if still no data
    for sym, info in SPOT_INSTRUMENTS.items():
        if spots.get(sym, 0) > 0:
            continue
        try:
            r = smart_api.ltpData(info["exchange"], info["tradingSymbol"], info["symbolToken"])
            if r and r.get("status") and r.get("data"):
                spots[sym] = float(r["data"].get("ltp", 0))
        except: pass

    # Hard fallback so ATM calculation always works
    if spots.get("NIFTY", 0) == 0:     spots["NIFTY"]     = 24500.0
    if spots.get("BANKNIFTY", 0) == 0: spots["BANKNIFTY"] = 52000.0
    if spots.get("FINNIFTY", 0) == 0:  spots["FINNIFTY"]  = 23500.0

    return spots

# ─────────────────────────────────────────────────────────────────────────────
# OPTION CHAIN BUILDER
# ─────────────────────────────────────────────────────────────────────────────
def build_chain_output() -> dict:
    with _lock:
        local_cache  = dict(tick_cache)
        local_spots  = dict(spot_prices)
        local_expiry = dict(expiry_map)
        local_index  = dict(chain_index)

    output = {
        "updatedAt": int(time.time() * 1000),
        "expiries":  local_expiry,
        "chains":    {}
    }

    for sym in SYMBOLS:
        if sym not in local_index: continue
        step = STEP.get(sym, 50)
        spot = local_spots.get(sym, 24500)
        atm  = round(spot / step) * step
        low  = atm - ATM_RANGE_STRIKES * step
        high = atm + ATM_RANGE_STRIKES * step

        output["chains"][sym] = {}
        for exp in sorted(local_index.get(sym, {}).keys())[:3]:
            contracts = local_index[sym][exp]
            strike_map: dict = {}
            for c in contracts:
                s = c["strike"]
                if low <= s <= high:
                    strike_map.setdefault(s, {})[c["optionType"]] = c

            rows = []
            for strike in sorted(strike_map.keys()):
                opts = strike_map[strike]
                ce   = opts.get("CE")
                pe   = opts.get("PE")
                if not ce or not pe: continue

                ce_tick = local_cache.get(ce["token"], {})
                pe_tick = local_cache.get(pe["token"], {})

                rows.append({
                    "strikePrice": strike,
                    "ce": {
                        "token":     ce["token"],
                        "tradingSymbol": ce["tradingSymbol"],
                        "ltp":       ce_tick.get("ltp", 0),
                        "oi":        ce_tick.get("oi", 0),
                        "volume":    ce_tick.get("volume", 0),
                        "change":    ce_tick.get("change", 0),
                    },
                    "pe": {
                        "token":     pe["token"],
                        "tradingSymbol": pe["tradingSymbol"],
                        "ltp":       pe_tick.get("ltp", 0),
                        "oi":        pe_tick.get("oi", 0),
                        "volume":    pe_tick.get("volume", 0),
                        "change":    pe_tick.get("change", 0),
                    },
                })

            output["chains"][sym][exp] = {"spot": spot, "rows": rows}

    return output

# ─────────────────────────────────────────────────────────────────────────────
# JSON WRITER THREAD
# ─────────────────────────────────────────────────────────────────────────────
def writer_thread():
    while True:
        try:
            data = build_chain_output()
            tmp  = CHAIN_FILE + ".tmp"
            with open(tmp, "w") as f: json.dump(data, f)
            os.replace(tmp, CHAIN_FILE)   # atomic write
        except Exception as e:
            print(f"[OptionWS] Writer error: {e}", flush=True)
        time.sleep(WRITE_INTERVAL)

# ─────────────────────────────────────────────────────────────────────────────
# WEBSOCKET CALLBACKS
# ─────────────────────────────────────────────────────────────────────────────
def on_data(wsapp, message):
    """Called for every tick from SmartWebSocketV2."""
    try:
        token = str(message.get("token", ""))
        ltp   = message.get("last_traded_price", 0) / 100.0   # paise → ₹
        oi    = message.get("open_interest", 0)
        vol   = message.get("volume_trade_for_the_day", 0)
        close = message.get("52_week_high_price", 0) / 100.0  # prev close approx
        change_pct = round(((ltp - close) / close * 100), 2) if close > 0 else 0

        with _lock:
            tick_cache[token] = {
                "ltp":    ltp,
                "oi":     oi,
                "volume": vol,
                "change": change_pct,
                "ts":     int(time.time() * 1000),
            }
    except Exception as e:
        pass

def on_open(wsapp, subscriptions: list):
    """Called when WebSocket connection is established."""
    print(f"[OptionWS] WebSocket connected. Subscribing {len(subscriptions)} tokens…", flush=True)
    token_list = [[{"exchangeType": 2, "tokens": [t["token"] for t in subscriptions]}]]
    wsapp.subscribe("option-chain-session", 3, token_list[0])  # mode 3 = FULL

def on_error(wsapp, error):
    print(f"[OptionWS] WebSocket error: {error}", flush=True)

def on_close(wsapp):
    print("[OptionWS] WebSocket closed.", flush=True)

# ─────────────────────────────────────────────────────────────────────────────
# REST POLLING FALLBACK (when SmartWebSocketV2 not available)
# ─────────────────────────────────────────────────────────────────────────────
def rest_poll_loop(smart_api: SmartConnect, tokens_to_watch: list):
    """Fallback: poll ltpData for each token every 2 seconds."""
    print("[OptionWS] Using REST polling fallback (no WS)…", flush=True)
    while True:
        for contract in tokens_to_watch[:MAX_TOKENS_PER_WS]:
            try:
                r = smart_api.ltpData("NFO", contract["tradingSymbol"], contract["token"])
                if r and r.get("status") and r.get("data"):
                    d = r["data"]
                    ltp   = float(d.get("ltp", 0))
                    close = float(d.get("close", ltp))
                    with _lock:
                        tick_cache[contract["token"]] = {
                            "ltp":    ltp,
                            "oi":     int(d.get("openInterest", 0)),
                            "volume": int(d.get("tradedVolume", 0)),
                            "change": round((ltp - close) / close * 100, 2) if close > 0 else 0,
                            "ts":     int(time.time() * 1000),
                        }
                time.sleep(0.1)   # 100ms between calls → ~10 tokens/sec
            except Exception as e:
                time.sleep(0.5)

# ─────────────────────────────────────────────────────────────────────────────
# MAIN
# ─────────────────────────────────────────────────────────────────────────────
def main():
    api_key     = os.getenv("SMARTAPI_API_KEY", "4DBv6HvT")
    client_code = os.getenv("SMARTAPI_CLIENT_CODE", "N89824")
    password    = os.getenv("SMARTAPI_PASSWORD", "9691")
    totp_secret = os.getenv("SMARTAPI_TOTP_SECRET", "AV7KF7BEJBOOCVIS53TZZB2VEU")

    # 1. Authenticate
    print("[OptionWS] Authenticating…", flush=True)
    totp      = pyotp.TOTP(totp_secret).now()
    smart_api = SmartConnect(api_key=api_key)
    session   = smart_api.generateSession(client_code, password, totp)
    if not session or not session.get("status"):
        print("[OptionWS] Auth failed:", session, flush=True)
        sys.exit(1)
    print("[OptionWS] Authenticated!", flush=True)

    auth_token = session["data"]["jwtToken"]
    feed_token = smart_api.getfeedToken()

    # 2. Load scrip master & build index
    master = load_scrip_master()
    build_index(master)

    # 3. Fetch initial spot prices
    spots = fetch_spot_prices(smart_api)
    with _lock: spot_prices.update(spots)
    print(f"[OptionWS] Spot prices: { {k: round(v,2) for k,v in spots.items()} }", flush=True)

    # 4. Determine tokens to subscribe
    tokens_to_watch = build_all_tokens(spots)
    print(f"[OptionWS] Subscribing to {len(tokens_to_watch)} option contracts…", flush=True)

    # 5. Start JSON writer thread
    t = threading.Thread(target=writer_thread, daemon=True)
    t.start()

    # 6. Spot price refresh thread (reads from angel_ticks.json every 5s)
    def spot_refresh():
        while True:
            time.sleep(5)
            if os.path.exists(TICKS_FILE):
                try:
                    raw = json.load(open(TICKS_FILE))
                    new_spots = {
                        "NIFTY":     float(raw.get("NSE_NIFTY50", {}).get("ltp", 0) or 0),
                        "BANKNIFTY": float(raw.get("NSE_BANKNIFTY", {}).get("ltp", 0) or 0),
                    }
                    with _lock: spot_prices.update(new_spots)
                except: pass

    threading.Thread(target=spot_refresh, daemon=True).start()

    # 7. Connect WebSocket OR fall back to REST polling
    if WS_AVAILABLE:
        print("[OptionWS] Starting SmartWebSocketV2 stream…", flush=True)
        sws = SmartWebSocketV2(auth_token, api_key, client_code, feed_token)
        sws.on_data  = on_data
        sws.on_open  = lambda wsapp: on_open(wsapp, tokens_to_watch)
        sws.on_error = on_error
        sws.on_close = on_close
        sws.connect()   # blocking — reconnects automatically
    else:
        rest_poll_loop(smart_api, tokens_to_watch)

if __name__ == "__main__":
    main()
