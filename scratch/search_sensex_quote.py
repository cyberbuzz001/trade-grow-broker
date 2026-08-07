import os, sys, json, pyotp
from SmartApi import SmartConnect

api_key     = os.getenv("SMARTAPI_API_KEY", "4DBv6HvT")
client_code = os.getenv("SMARTAPI_CLIENT_CODE", "N89824")
password    = os.getenv("SMARTAPI_PASSWORD", "9691")
totp_secret = os.getenv("SMARTAPI_TOTP_SECRET", "AV7KF7BEJBOOCVIS53TZZB2VEU")

totp      = pyotp.TOTP(totp_secret).now()
smart_api = SmartConnect(api_key=api_key)
session   = smart_api.generateSession(client_code, password, totp)

if not session or not session.get("status"):
    print("Auth failed:", session)
    sys.exit(1)

print("Authenticated successfully!")

# 1. Fetch SENSEX Spot price
spot_res = smart_api.ltpData("BSE", "SENSEX", "1")
print("\nSENSEX Spot LTP:", json.dumps(spot_res, indent=2))

# 2. Search scrip master for SENSEX 78400 option tokens
master_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "../server/data/angel_scrip_master.json"))
if os.path.exists(master_file):
    master = json.load(open(master_file))
    print(f"Loaded master with {len(master)} contracts")
    
    sensex_78400 = []
    for row in master:
        name = row.get("name", "").upper()
        symbol = row.get("symbol", "")
        exch = row.get("exch_seg", "")
        strike = row.get("strike", "")
        
        if (name == "SENSEX" or "SENSEX" in symbol) and exch == "BFO":
            try:
                s = float(strike) / 100.0 if float(strike) > 100000 else float(strike)
                if s == 78400.0:
                    sensex_78400.append(row)
            except: pass

    print(f"\nFound {len(sensex_78400)} matching SENSEX 78400 contracts:")
    for c in sensex_78400[:10]:
        token = c.get("token")
        sym = c.get("symbol")
        exp = c.get("expiry")
        print(f" - {sym} (Token: {token}, Expiry: {exp}, Exch: BFO)")
        
        # Fetch LTP for this strike contract
        try:
            q = smart_api.ltpData("BFO", sym, token)
            print(f"   LTP Quote: {q.get('data', {})}")
        except Exception as e:
            print(f"   Error fetching LTP: {e}")
