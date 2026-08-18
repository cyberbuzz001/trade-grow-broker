import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { getJwtSecret } from '../middleware/auth';
import { adminEventBus, AdminEvent } from '../utils/adminEventBus';

export interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  userRole?: string;
  subscriptions?: Set<string>;
  adminWatchedUsers?: Set<string>;
}

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

export function setupWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  console.log('[WebSocket] High-Performance Gateway running on /ws');

  const defaultTokens = ['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK'];

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    ws.subscriptions = new Set();
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
            MarketDataEngine.getInstance().subscribe(tokensToAdd);
          }
        } else if (data.action === 'UNSUBSCRIBE' && Array.isArray(data.tokens)) {
          data.tokens.forEach((t: string) => {
            if (!t) return;
            const clean = t.trim();
            ws.subscriptions?.delete(clean);
            subscriptionIndex.remove(clean, ws);
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => {
              ws.subscriptions?.delete(alias);
              subscriptionIndex.remove(alias, ws);
            });
          });

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
      // Clean up subscriptions from inverted index to prevent memory leak
      subscriptionIndex.removeAll(ws);
      ws.subscriptions?.clear();
      ws.adminWatchedUsers?.clear();
    });

    // Send initial snapshot of all cached ticks
    const cachedTicks = MarketDataEngine.getInstance().getAllCachedTicks();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TICK_SNAPSHOT', data: cachedTicks }));
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

  wss.on('close', () => clearInterval(pingInterval));

  return wss;
}

