import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { MarketDataEngine } from '../marketData/MarketDataEngine';
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
          // Limit subscription size to prevent abuse
          const allowedAdds = 50 - (ws.subscriptions?.size ?? 0);
          const tokensToAdd = data.tokens.slice(0, Math.max(0, allowedAdds));
          tokensToAdd.forEach((t: string) => ws.subscriptions?.add(t));
        } else if (data.action === 'UNSUBSCRIBE' && Array.isArray(data.tokens)) {
          data.tokens.forEach((t: string) => ws.subscriptions?.delete(t));
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
    let sentCount = 0;

    wss.clients.forEach((client: ExtendedWebSocket) => {
      if (client.readyState === WebSocket.OPEN && client.subscriptions?.has(tick.instrumentToken)) {
        try {
          client.send(payload);
          sentCount++;
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
