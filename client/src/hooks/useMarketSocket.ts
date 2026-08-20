import React, { createContext, useContext, useEffect, useRef, useState, useCallback, ReactNode } from 'react';
import { MarketTick } from '../types';
import { logMarketTelemetry } from './useMarketTelemetry';

export type SocketStatus = 'CONNECTING' | 'CONNECTED' | 'DISCONNECTED' | 'RECONNECTING' | 'UNAVAILABLE';

/** Server-reported market data feed health (Phase 6). */
export interface FeedStatus {
  status: 'LIVE' | 'STALE' | 'CLOSED' | 'DISCONNECTED';
  lastTickMsAgo: number;
  provider: string;
  subscribedTokens: number;
  marketOpen: boolean;
}

export interface MarketSocketContextType {
  status: SocketStatus;
  feedStatus: FeedStatus | null;
  ticks: Map<string, MarketTick>;
  lastTickTimestamps: Map<string, number>;
  firstSubscribedAt: Map<string, number>;
  reconnectCount: number;
  subscribe: (tokens: string[]) => void;
  unsubscribe: (tokens: string[]) => void;
  subscribeOptionChain: (sub: ChainSubscription) => void;
  unsubscribeOptionChain: (sub: ChainSubscription) => void;
}

/** Identifies one distinct option-chain view. Must match the server's chainKey(). */
export interface ChainSubscription {
  symbol: string;
  expiry?: string;
  strikeRange?: string;
}

export function chainKey(sub: ChainSubscription): string {
  return `${sub.symbol.toUpperCase().trim()}|${(sub.expiry || '').trim()}|${sub.strikeRange || '10'}`;
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
  const [feedStatus, setFeedStatus] = useState<FeedStatus | null>(null);
  const [ticks, setTicks] = useState<Map<string, MarketTick>>(new Map());
  const [lastTickTimestamps, setLastTickTimestamps] = useState<Map<string, number>>(new Map());
  const [reconnectCount, setReconnectCount] = useState<number>(0);

  // Active subscriptions ref-counting map: token -> subscriber count
  const subscriptionCountsRef = useRef<Map<string, number>>(new Map());
  // Option-chain subscriptions ref-counting map: symbol -> subscriber count.
  // Tracked so they can be restored after a reconnect — previously option chain
  // subscriptions were fire-and-forget and were permanently lost on any drop.
  const optionChainCountsRef = useRef<Map<string, number>>(new Map());
  // Highest tick timestamp seen per instrument, used to reject out-of-order ticks.
  const latestTsRef = useRef<Map<string, number>>(new Map());
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

  /**
   * Subscribe to a server-broadcast option chain.
   * Ref-counted and recorded so the subscription is restored automatically after a
   * reconnect, and so mounting the same chain twice does not double-subscribe.
   * Safe to call before the socket is OPEN — it will be sent on connect.
   */
  const subscribeOptionChain = useCallback((sub: ChainSubscription) => {
    if (!sub || !sub.symbol) return;
    const key = chainKey(sub);
    const count = optionChainCountsRef.current.get(key) ?? 0;
    optionChainCountsRef.current.set(key, count + 1);
    if (count > 0) return; // already subscribed on the wire

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          action: 'SUBSCRIBE_OPTION_CHAIN',
          symbol: sub.symbol.toUpperCase().trim(),
          expiry: sub.expiry || '',
          strikeRange: sub.strikeRange || '10'
        }));
      } catch (err) {
        console.error('[MarketSocket] Failed to send SUBSCRIBE_OPTION_CHAIN', err);
      }
    }
    // If not OPEN yet, ws.onopen replays everything in optionChainCountsRef.
  }, []);

  const unsubscribeOptionChain = useCallback((sub: ChainSubscription) => {
    if (!sub || !sub.symbol) return;
    const key = chainKey(sub);
    const count = optionChainCountsRef.current.get(key) ?? 0;
    if (count <= 1) {
      optionChainCountsRef.current.delete(key);
    } else {
      optionChainCountsRef.current.set(key, count - 1);
      return; // other consumers still need it
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({
          action: 'UNSUBSCRIBE_OPTION_CHAIN',
          symbol: sub.symbol.toUpperCase().trim(),
          expiry: sub.expiry || '',
          strikeRange: sub.strikeRange || '10'
        }));
      } catch (err) {
        console.error('[MarketSocket] Failed to send UNSUBSCRIBE_OPTION_CHAIN', err);
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

        // ── Subscription recovery (Phase 13) ──────────────────────────────
        // Restore BOTH token subscriptions and option-chain subscriptions so the
        // user never has to refresh the page after a network blip.
        const activeTokens = Array.from(subscriptionCountsRef.current.keys());
        if (activeTokens.length > 0) {
          sendSubscribe(activeTokens);
        }
        optionChainCountsRef.current.forEach((_count, key) => {
          const [symbol, expiry, strikeRange] = key.split('|');
          try {
            ws.send(JSON.stringify({
              action: 'SUBSCRIBE_OPTION_CHAIN', symbol, expiry: expiry || '', strikeRange: strikeRange || '10'
            }));
          } catch (_) {}
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const storeTick = (t: MarketTick) => {
            if (!t || !t.instrumentToken) return;

            // ── Stale-tick guard (Phase 6) ────────────────────────────────
            // An older tick must never overwrite a newer one. This happens in
            // practice when a TICK_SNAPSHOT (built from cache) lands after a live
            // MARKET_TICK for the same instrument, or on reconnect replay.
            const incomingTs = typeof t.timestamp === 'number' && t.timestamp > 0 ? t.timestamp : Date.now();
            const knownTs = latestTsRef.current.get(t.instrumentToken);
            if (knownTs !== undefined && incomingTs < knownTs) return;
            latestTsRef.current.set(t.instrumentToken, incomingTs);

            // Always store by the canonical instrumentToken
            pendingTicksRef.current.set(t.instrumentToken, t);

            // Also store by symbol so lookups by both key formats work
            if (t.symbol && t.symbol !== t.instrumentToken) {
              pendingTicksRef.current.set(t.symbol.trim(), t);
            }
            if ((t as any).tradingSymbol && (t as any).tradingSymbol !== t.instrumentToken) {
              pendingTicksRef.current.set(((t as any).tradingSymbol as string).trim(), t);
            }

            // For option contracts (NFO_NIFTY_24500_CE / BFO_SENSEX_78000_CE) also store
            // the bare segment-free version so OptionChainView.freshnessMap lookups hit.
            const token = t.instrumentToken;
            const mFull = token.match(/^(NFO|BFO)_([A-Z0-9]+)_(\d+(?:\.\d+)?)_(CE|PE)$/);
            if (mFull) {
              const [, , underlying, strike, optType] = mFull;
              pendingTicksRef.current.set(`${underlying}_${strike}_${optType}`, t);
            }
          };

          if (message.type === 'TICK_SNAPSHOT' && Array.isArray(message.data)) {
            message.data.forEach((t: MarketTick) => storeTick(t));
            scheduleBatchUpdate();
          } else if (message.type === 'MARKET_TICK' && message.data) {
            storeTick(message.data as MarketTick);
            scheduleBatchUpdate();
          } else if (message.type === 'MARKET_STATUS' && message.data) {
            // Server-reported feed health: LIVE | STALE | CLOSED | DISCONNECTED
            setFeedStatus(message.data as FeedStatus);
          } else if (message.type === 'OPTION_CHAIN_SNAPSHOT' && message.data) {
            window.dispatchEvent(new CustomEvent('market:option_chain_snapshot', { detail: message.data }));
          }
        } catch (_) {}
      };

      ws.onclose = () => {
        if (!isMountedRef.current) return;
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        attempts++;
        setReconnectCount(attempts);

        setStatus('DISCONNECTED');
        const backoffMs = Math.min(INITIAL_BACKOFF_MS * Math.pow(1.5, Math.min(attempts - 1, 6)), 5000);
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
        feedStatus,
        ticks,
        lastTickTimestamps,
        firstSubscribedAt,
        reconnectCount,
        subscribe,
        unsubscribe,
        subscribeOptionChain,
        unsubscribeOptionChain,
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
  // NOTE: copy before sorting. `tokens.sort()` sorted the caller's array IN PLACE,
  // reordering component state/props as a side effect of merely computing a cache key.
  const tokensKey = React.useMemo(
    () => (tokens || []).filter(Boolean).slice().sort().join(','),
    [tokens]
  );

  useEffect(() => {
    if (!tokensKey) return;
    const tokenList = tokensKey.split(',');
    subscribe(tokenList);

    return () => {
      unsubscribe(tokenList);
    };
  }, [tokensKey, subscribe, unsubscribe]);
}

/**
 * Subscribes to a server-broadcast option chain for exactly the view the user is looking at.
 * Changing symbol / expiry / strike range tears down the old view and starts the new one,
 * so the server never computes chains nobody is watching (Phase 7).
 * Returns the subscription key, which callers use to discard snapshots for stale views.
 */
export function useSubscribeOptionChain(
  symbol: string,
  expiry?: string,
  strikeRange?: string
): string {
  const { subscribeOptionChain, unsubscribeOptionChain } = useMarketSocket();
  const key = symbol ? chainKey({ symbol, expiry, strikeRange }) : '';

  useEffect(() => {
    if (!symbol) return;
    const sub = { symbol, expiry, strikeRange };
    subscribeOptionChain(sub);
    return () => {
      unsubscribeOptionChain(sub);
    };
  }, [key, subscribeOptionChain, unsubscribeOptionChain]);

  return key;
}
