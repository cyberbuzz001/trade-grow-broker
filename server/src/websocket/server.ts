import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
import { SymbologyNormalizer } from '../marketData/SymbologyNormalizer';
import { getJwtSecret } from '../middleware/auth';

interface ExtendedWebSocket extends WebSocket {
  isAlive?: boolean;
  userId?: string;
  subscriptions?: Set<string>;
}

export function setupWebSocketServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });

  console.log('[WebSocket] Gateway running on /ws');

  wss.on('connection', (ws: ExtendedWebSocket, req) => {
    ws.isAlive = true;
    ws.subscriptions = new Set(['NSE_NIFTY50', 'NSE_BANKNIFTY', 'NSE_RELIANCE', 'NSE_TCS', 'NSE_INFY', 'NSE_HDFCBANK']);

    // Authenticate token via query string (?token=xyz)
    // P0-3 FIX: Uses getJwtSecret() — no hardcoded fallback
    const urlParams = new URLSearchParams(req.url?.split('?')[1] || '');
    const token = urlParams.get('token');
    if (token) {
      try {
        const decoded = jwt.verify(token, getJwtSecret()) as any;
        ws.userId = decoded.userId;
      } catch (err) {
        // Continue unauthenticated for public market tick subscriptions
      }
    }

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());

        if (data.action === 'SUBSCRIBE' && Array.isArray(data.tokens)) {
          // Limit subscription size to prevent abuse (1000 max for active option chains & watchlists)
          const MAX_SUBS = 1000;
          const currentSize = ws.subscriptions?.size ?? 0;
          const allowedAdds = Math.max(0, MAX_SUBS - currentSize);
          const tokensToAdd = data.tokens.slice(0, allowedAdds);

          tokensToAdd.forEach((t: string) => {
            if (!t) return;
            const clean = t.trim();
            ws.subscriptions?.add(clean);
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => ws.subscriptions?.add(alias));
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
            const aliases = SymbologyNormalizer.normalizeToken(clean);
            aliases.forEach(alias => ws.subscriptions?.delete(alias));
          });
        } else if (data.action === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (err) {
        // Invalid JSON message ignored
      }
    });

    ws.on('close', () => {
      // Clean up subscriptions to free memory
      ws.subscriptions?.clear();
    });

    // Send initial snapshot of all cached ticks
    const cachedTicks = MarketDataEngine.getInstance().getAllCachedTicks();
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'TICK_SNAPSHOT', data: cachedTicks }));
    }
  });

  // Broadcast market ticks to subscribed connections
  MarketDataEngine.getInstance().onTick((tick) => {
    const payload = JSON.stringify({ type: 'MARKET_TICK', data: tick });
    const tickAliases = SymbologyNormalizer.normalizeToken(tick.instrumentToken);
    if (tick.symbol) {
      const symAliases = SymbologyNormalizer.normalizeToken(tick.symbol);
      symAliases.forEach(a => tickAliases.push(a));
    }

    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.subscriptions) {
        const subs = client.subscriptions;
        const isSubscribed = subs.has(tick.instrumentToken) || tickAliases.some(alias => subs.has(alias));

        if (isSubscribed) {
          try {
            client.send(payload);
          } catch (err: any) {
            // Suppress send errors for dead connections
          }
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
