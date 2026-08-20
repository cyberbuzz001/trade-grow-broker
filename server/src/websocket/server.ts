import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { getJwtSecret } from '../middleware/auth';
import { adminEventBus, AdminEvent } from '../utils/adminEventBus';
import { optionChainBroadcaster, chainKey } from '../marketData/OptionChainBroadcasterService';

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  userRole?: string;
  subscriptions?: Set<string>;
  /** Option-chain view keys (symbol|expiry|strikeRange) this socket holds a ref on. */
  optionChainSymbols?: Set<string>;
  adminWatchedUsers?: Set<string>;
  /** Inbound message rate-limit window state. */
  rateWindowStart?: number;
  messagesInWindow?: number;
}

/** Inbound message guards — a market-data client never legitimately needs more than this. */
const MAX_WS_MESSAGE_BYTES = 64 * 1024;
const MAX_WS_MESSAGES_PER_SEC = 40;

// Inverted Subscription Index for O(1) tick dispatch
class TokenSubscriptionIndex {
  private index = new Map<string, Set<ExtendedWebSocket>>();

  public add(token: string, ws: ExtendedWebSocket): void {
    if (!this.index.has(token)) {
      this.index.set(token, new Set());
    }
    this.index.get(token)!.add(ws);
  }

  public remove(token: string, ws: ExtendedWebSocket): void {
    const set = this.index.get(token);
    if (set) {
      set.delete(ws);
      if (set.size === 0) {
        this.index.delete(token);
      }
    }
  }

  public removeAll(ws: ExtendedWebSocket): void {
    if (ws.subscriptions) {
      ws.subscriptions.forEach(token => {
        this.remove(token, ws);
      });
    }
  }

  public getSubscribers(token: string): Set<ExtendedWebSocket> | undefined {
    return this.index.get(token);
  }
}

const subscriptionIndex = new TokenSubscriptionIndex();
let totalMessagesBroadcast = 0;
let totalDroppedFrames = 0;

export function getWebSocketMetrics() {
  return {
    totalMessagesBroadcast,
    totalDroppedFrames
  };
}

let wssRef: WebSocketServer | null = null;
export function getConnectedClientCount(): number {
  return wssRef ? wssRef.clients.size : 0;
}

export function setupWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wssRef = wss;

  console.log('[WebSocket] High-Performance Gateway running on /ws');

  // Start background server-side option chain broadcast (4s intervals)
  optionChainBroadcaster.start(4000);

  const defaultTokens = ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK'];

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    ws.subscriptions = new Set();
    ws.optionChainSymbols = new Set();
    ws.adminWatchedUsers = new Set();

    // Register default subscriptions in index
    defaultTokens.forEach(t => {
      ws.subscriptions!.add(t);
      subscriptionIndex.add(t, ws);
      const aliases = SymbologyNormalizer.normalizeToken(t);
      aliases.forEach(a => {
        ws.subscriptions!.add(a);
        subscriptionIndex.add(a, ws);
      });
    });

    // Authenticate token via query string (?token=xyz)
    const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
    const token = urlParams.get('token');
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        ws.userId = decoded.userId;
        ws.userRole = decoded.role || 'USER';
      } catch (err) {
        // Continue unauthenticated for public market tick subscriptions
      }
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message: Buffer) => {
      try {
        // ── Per-connection abuse guards (Phase 18) ────────────────────────
        // The socket accepts unauthenticated connections so public market data works
        // without login. That means an anonymous client can drive SUBSCRIBE and
        // SUBSCRIBE_OPTION_CHAIN, both of which cost real upstream work, so inbound
        // messages must be bounded in both size and rate.
        if (message.length > MAX_WS_MESSAGE_BYTES) {
          ws.send(JSON.stringify({ type: 'ERROR', code: 'MESSAGE_TOO_LARGE' }));
          return;
        }

        const nowMs = Date.now();
        if (nowMs - (ws.rateWindowStart ?? 0) > 1000) {
          ws.rateWindowStart = nowMs;
          ws.messagesInWindow = 0;
        }
        ws.messagesInWindow = (ws.messagesInWindow ?? 0) + 1;
        if (ws.messagesInWindow > MAX_WS_MESSAGES_PER_SEC) {
          if (ws.messagesInWindow === MAX_WS_MESSAGES_PER_SEC + 1) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'RATE_LIMITED', message: 'Too many messages; slow down.' }));
          }
          // Persistent floods get disconnected rather than merely throttled.
          if (ws.messagesInWindow > MAX_WS_MESSAGES_PER_SEC * 10) ws.terminate();
          return;
        }

        const data = JSON.parse(message.toString());

        if (data.action === 'SUBSCRIBE' && Array.isArray(data.tokens)) {
          const MAX_SUBS = 1000;
          const currentSize = ws.subscriptions?.size ?? 0;
          const allowedAdds = Math.max(0, MAX_SUBS - currentSize);
          const tokensToAdd = data.tokens.slice(0, allowedAdds);

          tokensToAdd.forEach((t: string) => {
            if (!t) return;
            const clean = t.trim();
            ws.subscriptions?.add(clean);
            subscriptionIndex.add(clean, ws);
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => {
              ws.subscriptions?.add(alias);
              subscriptionIndex.add(alias, ws);
            });
          });

          // Forward token subscriptions to MarketDataEngine so market provider emits live ticks
          if (tokensToAdd.length > 0) {
            const engine = MarketDataEngine.getInstance();
            engine.subscribe(tokensToAdd);

            // Snapshot-then-stream: immediately return whatever is already cached for these
            // tokens so the UI paints real values before the next provider tick arrives.
            const seen = new Set<string>();
            const snapshot = [];
            for (const t of tokensToAdd) {
              const tick = engine.getCachedTick(String(t).trim());
              if (tick && !seen.has(tick.instrumentToken)) {
                seen.add(tick.instrumentToken);
                snapshot.push(tick);
              }
            }
            if (snapshot.length > 0 && ws.readyState === WebSocket.OPEN) {
              try {
                ws.send(JSON.stringify({ type: 'TICK_SNAPSHOT', data: snapshot }));
              } catch (_) {}
            }
          }
        } else if (data.action === 'UNSUBSCRIBE' && Array.isArray(data.tokens)) {
          const unsubTokens: string[] = [];
          data.tokens.forEach((t: string) => {
            if (!t) return;
            const clean = t.trim();
            ws.subscriptions?.delete(clean);
            subscriptionIndex.remove(clean, ws);
            unsubTokens.push(clean);
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => {
              ws.subscriptions?.delete(alias);
              subscriptionIndex.remove(alias, ws);
              unsubTokens.push(alias);
            });
          });
          if (unsubTokens.length > 0) {
            MarketDataEngine.getInstance().unsubscribe(unsubTokens);
          }

        // ── Real-Time Option Chain Subscriptions (Replaces Frontend Polling) ──
        } else if (data.action === 'SUBSCRIBE_OPTION_CHAIN' && data.symbol) {
          const cleanSym = String(data.symbol).toUpperCase().replace(/^(NSE_|BSE_)/, '').trim();
          const reqExpiry = typeof data.expiry === 'string' ? data.expiry.trim() : '';
          const reqRange = ['5', '10', '20', 'ALL'].includes(String(data.strikeRange))
            ? String(data.strikeRange)
            : '10';

          const key = chainKey({ symbol: cleanSym, expiry: reqExpiry, strikeRange: reqRange });

          // A socket may only hold one ref per view; re-sending SUBSCRIBE for a view it
          // already holds must not inflate the ref-count and pin the view forever.
          if (!ws.optionChainSymbols?.has(key)) {
            const MAX_CHAIN_VIEWS_PER_SOCKET = 8;
            if ((ws.optionChainSymbols?.size ?? 0) >= MAX_CHAIN_VIEWS_PER_SOCKET) {
              ws.send(JSON.stringify({
                type: 'ERROR', code: 'TOO_MANY_CHAIN_VIEWS',
                message: `A connection may watch at most ${MAX_CHAIN_VIEWS_PER_SOCKET} option chain views.`
              }));
            } else if (optionChainBroadcaster.addView({ symbol: cleanSym, expiry: reqExpiry, strikeRange: reqRange })) {
              ws.optionChainSymbols?.add(key);
              ws.send(JSON.stringify({
                type: 'OPTION_CHAIN_SUBSCRIBED',
                symbol: cleanSym, expiry: reqExpiry, strikeRange: reqRange, subscriptionKey: key
              }));

              // Phase 14 — snapshot-then-stream: deliver the last computed chain immediately
              // so the user never stares at an empty table waiting for the next cycle.
              const cachedSnapshot = optionChainBroadcaster.getLastSnapshot(key);
              if (cachedSnapshot) {
                try {
                  ws.send(JSON.stringify({ type: 'OPTION_CHAIN_SNAPSHOT', data: cachedSnapshot }));
                } catch (_) {}
              }
            } else {
              ws.send(JSON.stringify({
                type: 'ERROR', code: 'CHAIN_CAPACITY',
                message: 'Server is at option chain capacity. Please try again shortly.'
              }));
            }
          }

        } else if (data.action === 'UNSUBSCRIBE_OPTION_CHAIN' && data.symbol) {
          const cleanSym = String(data.symbol).toUpperCase().replace(/^(NSE_|BSE_)/, '').trim();
          const reqExpiry = typeof data.expiry === 'string' ? data.expiry.trim() : '';
          const reqRange = ['5', '10', '20', 'ALL'].includes(String(data.strikeRange))
            ? String(data.strikeRange)
            : '10';
          const key = chainKey({ symbol: cleanSym, expiry: reqExpiry, strikeRange: reqRange });

          // Only release a ref-count this socket actually holds
          if (ws.optionChainSymbols?.delete(key)) {
            optionChainBroadcaster.removeView(key);
          }

        // ── ADMIN-ONLY: Subscribe to a customer's real-time events ──────────
        } else if (data.action === 'ADMIN_SUBSCRIBE' && data.userId) {
          const ADMIN_ROLES = ['SUPER_ADMIN','ADMIN','MANAGER','RISK_MANAGER','FINANCE_MANAGER','KYC_OFFICER','READ_ONLY_AUDITOR'];
          if (!ws.userRole || !ADMIN_ROLES.includes(ws.userRole)) {
            ws.send(JSON.stringify({ type: 'ERROR', code: 'FORBIDDEN', message: 'Admin role required to subscribe to user events' }));
          } else {
            ws.adminWatchedUsers?.add(data.userId);
            ws.send(JSON.stringify({ type: 'ADMIN_SUBSCRIBED', userId: data.userId }));
          }

        // ── ADMIN-ONLY: Unsubscribe from a customer's real-time events ──────
        } else if (data.action === 'ADMIN_UNSUBSCRIBE' && data.userId) {
          ws.adminWatchedUsers?.delete(data.userId);
          ws.send(JSON.stringify({ type: 'ADMIN_UNSUBSCRIBED', userId: data.userId }));

        } else if (data.action === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (err) {
        // Invalid JSON message ignored
      }
    });

    ws.on('close', () => {
      // Release option chain broadcaster view ref-counts held by this socket
      ws.optionChainSymbols?.forEach(key => optionChainBroadcaster.removeView(key));
      // Decrement token ref-counts so Dhan unsubscribes tokens no client needs anymore
      if (ws.subscriptions && ws.subscriptions.size > 0) {
        MarketDataEngine.getInstance().unsubscribe(Array.from(ws.subscriptions));
      }
      // Clean up subscriptions from inverted index to prevent memory leak
      subscriptionIndex.removeAll(ws);
      ws.subscriptions?.clear();
      ws.optionChainSymbols?.clear();
      ws.adminWatchedUsers?.clear();
    });

    // Send initial snapshot for this client's default subscriptions only.
    // Previously this dumped the ENTIRE tick cache — which stores every instrument under
    // several symbology aliases — so each connecting client received thousands of
    // duplicated tick objects, a multi-megabyte frame during market hours.
    if (ws.readyState === WebSocket.OPEN) {
      const engine = MarketDataEngine.getInstance();
      const seen = new Set<string>();
      const snapshot = [];
      for (const token of defaultTokens) {
        const tick = engine.getCachedTick(token);
        if (tick && !seen.has(tick.instrumentToken)) {
          seen.add(tick.instrumentToken);
          snapshot.push(tick);
        }
      }
      ws.send(JSON.stringify({ type: 'TICK_SNAPSHOT', data: snapshot }));
      ws.send(JSON.stringify({ type: 'MARKET_STATUS', data: engine.getFeedHealth() }));
    }
  });

  // High-Speed O(1) Fan-Out: Broadcast market ticks to matching subscribers only
  MarketDataEngine.getInstance().onTick((tick) => {
    const payload = JSON.stringify({ type: 'MARKET_TICK', data: tick });
    const targetClients = new Set<ExtendedWebSocket>();

    // Collect subscribers for token and all aliases
    const directSubs = subscriptionIndex.getSubscribers(tick.instrumentToken);
    if (directSubs) directSubs.forEach(c => targetClients.add(c));

    const tickAliases = SymbologyNormalizer.normalizeToken(tick.instrumentToken);
    if (tick.symbol) {
      const symAliases = SymbologyNormalizer.normalizeToken(tick.symbol);
      symAliases.forEach(a => tickAliases.push(a));
    }

    for (const alias of tickAliases) {
      const aliasSubs = subscriptionIndex.getSubscribers(alias);
      if (aliasSubs) aliasSubs.forEach(c => targetClients.add(c));
    }

    // Broadcast to targeted subscriber clients with backpressure guard
    targetClients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          // Backpressure check: Skip frame if client write buffer is backlogged (>512KB)
          if (client.bufferedAmount > 512 * 1024) {
            totalDroppedFrames++;
            return;
          }
          client.send(payload);
          totalMessagesBroadcast++;
        } catch (err: any) {
          // Suppress send errors for dead connections
        }
      }
    });
  });

  // ── Server-Side Option Chain Matrix Broadcast Fan-Out ────────────────────
  // One computation per distinct (symbol, expiry, strikeRange) view is serialised once
  // and delivered to every client watching exactly that view.
  optionChainBroadcaster.on('snapshot', (snapshot) => {
    const payload = JSON.stringify({ type: 'OPTION_CHAIN_SNAPSHOT', data: snapshot });
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.optionChainSymbols?.has(snapshot.subscriptionKey)
      ) {
        try {
          if (client.bufferedAmount <= 512 * 1024) {
            client.send(payload);
          }
        } catch (_) {}
      }
    });
  });

  // Notify watchers when a view is dropped after repeated failures, so the UI can
  // surface an error instead of silently freezing on the last good snapshot.
  optionChainBroadcaster.on('view_failed', ({ key, error }: { key: string; error: string }) => {
    const payload = JSON.stringify({
      type: 'OPTION_CHAIN_ERROR', subscriptionKey: key, message: error
    });
    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.optionChainSymbols?.has(key)) {
        client.optionChainSymbols.delete(key);
        try { client.send(payload); } catch (_) {}
      }
    });
  });

  // ── Admin Event Bus → WebSocket Fan-Out ─────────────────────────────────
  adminEventBus.onAllEvents((event: AdminEvent) => {
    const payload = JSON.stringify({
      type: event.type,
      userId: event.userId,
      data: event.payload,
      timestamp: event.timestamp
    });

    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (
        client.readyState === WebSocket.OPEN &&
        client.adminWatchedUsers?.has(event.userId)
      ) {
        try {
          if (client.bufferedAmount <= 512 * 1024) {
            client.send(payload);
          }
        } catch (err: any) {
          // Suppress send errors for dead connections
        }
      }
    });
  });

  // Heartbeat ping interval (30 sec) — detect and terminate zombie connections
  const pingInterval = setInterval(() => {
    wss.clients.forEach((ws: ExtendedWebSocket) => {
      if (ws.isAlive === false) {
        ws.terminate();
        return;
      }
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  // ── Feed Status Broadcast (Phase 6: stale-data detection) ────────────────
  // Clients render LIVE / STALE / CLOSED / DISCONNECTED so old prices are never
  // silently presented as live prices. Only re-broadcast when the status changes
  // or every 15s, to avoid needless frames.
  let lastStatusPayload = '';
  let lastStatusSentAt = 0;
  const statusInterval = setInterval(() => {
    const health = MarketDataEngine.getInstance().getFeedHealth();
    const payload = JSON.stringify({ type: 'MARKET_STATUS', data: health });
    const now = Date.now();
    const changed = health.status !== lastStatusPayload;
    if (!changed && now - lastStatusSentAt < 15000) return;
    lastStatusPayload = health.status;
    lastStatusSentAt = now;

    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.bufferedAmount <= 512 * 1024) {
        try { client.send(payload); } catch (_) {}
      }
    });
  }, 5000);

  wss.on('close', () => {
    clearInterval(pingInterval);
    clearInterval(statusInterval);
    optionChainBroadcaster.stop();
  });

  return wss;
}

