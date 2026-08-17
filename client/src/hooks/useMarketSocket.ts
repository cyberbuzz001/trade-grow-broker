import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { MarketTick } from '../types';
import { logMarketTelemetry } from './useMarketTelemetry';

export type SocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'UNAVAILABLE';

export interface MarketSocketContextType {
  status: SocketStatus;
  ticks: Map<string, MarketTick>;
  lastTickTimestamps: Map<string, number>;
  firstSubscribedAt: Map<string, number>;
  reconnectCount: number;
  subscribe: (tokens: string[]) => void;
  unsubscribe: (tokens: string[]) => void;
}

const MarketSocketContext = createContext<MarketSocketContextType | null>(null);

const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_BACKOFF_MS = 1000;
const MAX_BACKOFF_MS = 30000;

interface MarketSocketProviderProps {
  children: ReactNode;
  userToken?: string | null;
}

export const MarketSocketProvider: React.FC<MarketSocketProviderProps> = ({ children, userToken }) => {
  const [status, setStatus] = useState<SocketStatus>('CONNECTING');
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  const [lastTickTimestamps, setLastTickTimestamps] = useState<Map<string, number>>(new Map());
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  // Active subscriptions ref-counting map: token -> subscriber count
  const subscriptionCountsRef = useRef<Map<string, number>>(new Map());
  // Tracks timestamp when token was first subscribed (for 10s initial tick timeout check)
  const firstSubscribedAtRef = useRef<Map<string, number>>(new Map());
  const [firstSubscribedAt, setFirstSubscribedAt] = useState<Map<string, number>>(new Map());

  const wsRef = useRef<WebSocket | null>(null);
  const pendingTicksRef = useRef<Map<string, MarketTick>>(new Map());
  const rafIdRef = useRef<number | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef<boolean>(true);

  /**
   * PERFORMANCE & LATENCY OPTIMIZATION:
   * Incoming WebSocket ticks are accumulated in pendingTicksRef and flushed once per browser
   * animation frame (~16ms) via requestAnimationFrame. This guarantees zero frame drops during tick bursts
   * while ensuring ticks are committed to React state within ~16ms of arrival (no artificial delay).
   */
  const scheduleBatchUpdate = useCallback(() => {
    if (rafIdRef.current !== null) return;

    rafIdRef.current = requestAnimationFrame(() => {
      rafIdRef.current = null;
      if (!isMountedRef.current || pendingTicksRef.current.size === 0) return;

      const newTicks = new Map(pendingTicksRef.current);
      const now = Date.now();

      setTicks(prev => {
        const next = new Map(prev);
        newTicks.forEach((tick, token) => {
          next.set(token, tick);
        });
        return next;
      });

      setLastTickTimestamps(prev => {
        const next = new Map(prev);
        newTicks.forEach((tick, token) => {
          const ts = tick.timestamp && tick.timestamp > 0 ? tick.timestamp : now;
          next.set(token, ts);
        });
        return next;
      });

      pendingTicksRef.current.clear();
    });
  }, []);

  // Send WS subscription message for tokens
  const sendSubscribe = useCallback((tokens: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && tokens.length > 0) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'SUBSCRIBE', tokens }));
      } catch (err) {
        console.error('[MarketSocket] Failed to send SUBSCRIBE', err);
      }
    }
  }, []);

  // Send WS unsubscribe message for tokens
  const sendUnsubscribe = useCallback((tokens: string[]) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && tokens.length > 0) {
      try {
        wsRef.current.send(JSON.stringify({ action: 'UNSUBSCRIBE', tokens }));
      } catch (err) {
        console.error('[MarketSocket] Failed to send UNSUBSCRIBE', err);
      }
    }
  }, []);

  // Public subscribe method with ref-counting
  const subscribe = useCallback((tokens: string[]) => {
    if (!tokens || tokens.length === 0) return;
    const now = Date.now();
    const tokensToSubscribeOnWS: string[] = [];

    tokens.forEach(t => {
      if (!t) return;
      const currentCount = subscriptionCountsRef.current.get(t) || 0;
      subscriptionCountsRef.current.set(t, currentCount + 1);

      if (currentCount === 0) {
        tokensToSubscribeOnWS.push(t);
        firstSubscribedAtRef.current.set(t, now);
      }
    });

    if (tokensToSubscribeOnWS.length > 0) {
      setFirstSubscribedAt(new Map(firstSubscribedAtRef.current));
      sendSubscribe(tokensToSubscribeOnWS);
    }
  }, [sendSubscribe]);

  // Public unsubscribe method with ref-counting
  const unsubscribe = useCallback((tokens: string[]) => {
    if (!tokens || tokens.length === 0) return;
    const tokensToUnsubscribeOnWS: string[] = [];

    tokens.forEach(t => {
      if (!t) return;
      const currentCount = subscriptionCountsRef.current.get(t) || 0;
      if (currentCount <= 1) {
        subscriptionCountsRef.current.delete(t);
        firstSubscribedAtRef.current.delete(t);
        tokensToUnsubscribeOnWS.push(t);
      } else {
        subscriptionCountsRef.current.set(t, currentCount - 1);
      }
    });

    if (tokensToUnsubscribeOnWS.length > 0) {
      setFirstSubscribedAt(new Map(firstSubscribedAtRef.current));
      sendUnsubscribe(tokensToUnsubscribeOnWS);
    }
  }, [sendUnsubscribe]);

  // Connection & Exponential Backoff Reconnect Logic
  useEffect(() => {
    isMountedRef.current = true;
    let attempts = 0;

    const connect = () => {
      if (!isMountedRef.current) return;

      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.onerror = null;
        wsRef.current.onmessage = null;
        try { wsRef.current.close(); } catch (_) {}
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws${userToken ? `?token=${userToken}` : ''}`;
      
      setStatus(attempts === 0 ? 'CONNECTING' : 'RECONNECTING');
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!isMountedRef.current) return;
        setStatus('CONNECTED');
        setReconnectCount(0);
        attempts = 0;
        logMarketTelemetry('SOCKET_CONNECTED');

        // Ping heartbeat every 25s
        pingIntervalRef.current = setInterval(() => {
          if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ action: 'PING' }));
          }
        }, 25000);

        // Auto re-subscribe to all active tokens
        const activeTokens = Array.from(subscriptionCountsRef.current.keys());
        if (activeTokens.length > 0) {
          sendSubscribe(activeTokens);
        }
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const storeTick = (t: MarketTick) => {
            if (!t || !t.instrumentToken) return;
            pendingTicksRef.current.set(t.instrumentToken, t);

            const symsToProcess: string[] = [];
            if (t.instrumentToken) symsToProcess.push(t.instrumentToken.trim());
            if (t.symbol) symsToProcess.push(t.symbol.trim());
            if ((t as any).tradingSymbol) symsToProcess.push((t as any).tradingSymbol.trim());

            symsToProcess.forEach(rawSym => {
              pendingTicksRef.current.set(rawSym, t);
              pendingTicksRef.current.set(`NSE_${rawSym}`, t);
              pendingTicksRef.current.set(`MCX_${rawSym}`, t);
              pendingTicksRef.current.set(`BSE_${rawSym}`, t);
              pendingTicksRef.current.set(`NFO_${rawSym}`, t);
              pendingTicksRef.current.set(`BFO_${rawSym}`, t);

              // Compact format e.g. NIFTY24500CE or BANKNIFTY72600PE or SENSEX78400CE
              const mCompact = rawSym.match(/^([A-Z0-9]+?)(?:_)?(\d+(?:\.\d+)?)(?:_)?(CE|PE)$/i);
              if (mCompact) {
                const underlying = mCompact[1].toUpperCase().replace(/^(NFO_|BFO_|NSE_|BSE_)/, '');
                const strike = mCompact[2];
                const optType = mCompact[3].toUpperCase();
                const segPrefix = underlying === 'SENSEX' ? 'BFO' : 'NFO';
                pendingTicksRef.current.set(`${segPrefix}_${underlying}_${strike}_${optType}`, t);
                pendingTicksRef.current.set(`${underlying}_${strike}_${optType}`, t);
              }

              // Trading symbol format e.g. BANKNIFTY-Aug2026-72600-CE
              const mTrading = rawSym.match(/^([A-Z0-9]+)-[A-Za-z0-9]+-(\d+(?:\.\d+)?)-(CE|PE)$/i);
              if (mTrading) {
                const underlying = mTrading[1].toUpperCase();
                const strike = mTrading[2];
                const optType = mTrading[3].toUpperCase();
                const segPrefix = underlying === 'SENSEX' ? 'BFO' : 'NFO';
                pendingTicksRef.current.set(`${segPrefix}_${underlying}_${strike}_${optType}`, t);
                pendingTicksRef.current.set(`${underlying}_${strike}_${optType}`, t);
              }
            });
          };

          if (message.type === 'TICK_SNAPSHOT' && Array.isArray(message.data)) {
            message.data.forEach((t: MarketTick) => storeTick(t));
            scheduleBatchUpdate();
          } else if (message.type === 'MARKET_TICK' && message.data) {
            storeTick(message.data as MarketTick);
            scheduleBatchUpdate();
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        attempts++;
        setReconnectCount(attempts);

        if (attempts > MAX_RECONNECT_ATTEMPTS) {
          setStatus('UNAVAILABLE');
          logMarketTelemetry('RECONNECT_FAILED_MAX', { maxAttempts: MAX_RECONNECT_ATTEMPTS });
          return;
        }

        setStatus('DISCONNECTED');
        const backoffMs = Math.min(INITIAL_BACKOFF_MS * Math.pow(2, attempts - 1), MAX_BACKOFF_MS);
        logMarketTelemetry('RECONNECT_ATTEMPT', { attempt: attempts, backoffMs });

        reconnectTimeoutRef.current = setTimeout(connect, backoffMs);
      };

      ws.onerror = () => {
        try { ws?.close(); } catch (_) {}
      };
    };

    connect();

    return () => {
      isMountedRef.current = false;
      if (rafIdRef.current !== null) cancelAnimationFrame(rafIdRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [userToken, scheduleBatchUpdate, sendSubscribe]);

  return React.createElement(
    MarketSocketContext.Provider,
    {
      value: {
        status,
        ticks,
        lastTickTimestamps,
        firstSubscribedAt,
        reconnectCount,
        subscribe,
        unsubscribe,
      },
    },
    children
  );
};

export function useMarketSocket(): MarketSocketContextType {
  const context = useContext(MarketSocketContext);
  if (!context) {
    throw new Error('useMarketSocket must be used within a MarketSocketProvider');
  }
  return context;
}

export function useSubscribeTokens(tokens: string[]) {
  const { subscribe, unsubscribe } = useMarketSocket();
  const tokensKey = tokens.sort().join(',');

  useEffect(() => {
    if (!tokens || tokens.length === 0) return;
    const tokenList = tokens.filter(Boolean);
    subscribe(tokenList);

    return () => {
      unsubscribe(tokenList);
    };
  }, [tokensKey, subscribe, unsubscribe]);
}
