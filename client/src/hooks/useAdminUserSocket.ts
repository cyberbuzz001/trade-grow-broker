/**
 * useAdminUserSocket.ts
 *
 * Custom React hook that subscribes to admin WebSocket events for a specific
 * customer. Uses the existing /ws gateway with ADMIN_SUBSCRIBE protocol.
 *
 * Replaces setInterval polling in Customer360.tsx for real-time updates.
 */

import { useEffect, useRef, useCallback } from 'react';

export interface AdminUserSocketCallbacks {
  onPositionUpdate?: (positions: any[]) => void;
  onTradeExecuted?: (trade: any) => void;
  onFundsUpdate?: (wallet: any) => void;
  onStatusChange?: (status: string, payload: any) => void;
  onKycUpdate?: (kycStatus: string, payload: any) => void;
  onProfileUpdate?: (changes: any) => void;
  onMarketTick?: (tick: any) => void;
  onTickSnapshot?: (ticks: any[]) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
}

export function useAdminUserSocket(
  customerId: string | null,
  token: string | null,
  callbacks: AdminUserSocketCallbacks
) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const currentCustomerRef = useRef<string | null>(null);
  const callbacksRef = useRef<AdminUserSocketCallbacks>(callbacks);
  callbacksRef.current = callbacks;

  const connect = useCallback(() => {
    if (!customerId || !token || !mountedRef.current) return;

    // Clean up existing connection if switching customers
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      if (currentCustomerRef.current && currentCustomerRef.current !== customerId) {
        wsRef.current.send(JSON.stringify({
          action: 'ADMIN_UNSUBSCRIBE',
          userId: currentCustomerRef.current
        }));
      } else if (currentCustomerRef.current === customerId) {
        // Already connected and watching this user
        return;
      }
    }

    // Build WebSocket URL — same host, /ws path, with admin JWT token
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    currentCustomerRef.current = customerId;

    ws.onopen = () => {
      if (!mountedRef.current || !customerId) return;
      // Subscribe to this customer's events
      ws.send(JSON.stringify({ action: 'ADMIN_SUBSCRIBE', userId: customerId }));
      callbacksRef.current.onConnected?.();
    };

    ws.onmessage = (event) => {
      if (!mountedRef.current) return;
      try {
        const msg = JSON.parse(event.data);

        if (msg.type === 'TICK_SNAPSHOT') {
          callbacksRef.current.onTickSnapshot?.(msg.data ?? []);
          return;
        }

        if (msg.type === 'MARKET_TICK') {
          callbacksRef.current.onMarketTick?.(msg.data ?? null);
          return;
        }

        // Only process events for the customer we're watching
        if (msg.userId && msg.userId !== customerId) return;

        switch (msg.type) {
          case 'POSITION_UPDATED':
            callbacksRef.current.onPositionUpdate?.(msg.data?.positions ?? []);
            break;
          case 'TRADE_EXECUTED':
            callbacksRef.current.onTradeExecuted?.(msg.data?.trade ?? null);
            break;
          case 'FUNDS_UPDATED':
            callbacksRef.current.onFundsUpdate?.(msg.data?.wallet ?? null);
            break;
          case 'USER_STATUS_UPDATED':
            callbacksRef.current.onStatusChange?.(msg.data?.status ?? '', msg.data ?? {});
            break;
          case 'USER_PROFILE_UPDATED':
            callbacksRef.current.onProfileUpdate?.(msg.data?.changes ?? {});
            break;
          case 'KYC_UPDATED':
            callbacksRef.current.onKycUpdate?.(msg.data?.kycStatus ?? '', msg.data ?? {});
            break;
          case 'ERROR':
            console.warn('[AdminSocket] Error from server:', msg.message);
            break;
          default:
            break;
        }
      } catch {
        // Ignore malformed frames
      }
    };

    ws.onclose = () => {
      callbacks.onDisconnected?.();
      if (!mountedRef.current) return;
      // Auto-reconnect after 3 seconds
      reconnectTimerRef.current = setTimeout(() => {
        if (mountedRef.current && customerId === currentCustomerRef.current) {
          connect();
        }
      }, 3000);
    };

    ws.onerror = () => {
      ws.close(); // trigger onclose → reconnect
    };
  }, [customerId, token]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        if (wsRef.current.readyState === WebSocket.OPEN && currentCustomerRef.current) {
          wsRef.current.send(JSON.stringify({
            action: 'ADMIN_UNSUBSCRIBE',
            userId: currentCustomerRef.current
          }));
        }
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return {
    /** Manually send a message through the admin WebSocket */
    send: (msg: object) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(msg));
      }
    },
    /** Subscribe to real-time market data ticks for instrument tokens/symbols */
    subscribeTokens: (tokens: string[]) => {
      if (wsRef.current?.readyState === WebSocket.OPEN && tokens.length > 0) {
        wsRef.current.send(JSON.stringify({ action: 'SUBSCRIBE', tokens }));
      }
    },
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}
