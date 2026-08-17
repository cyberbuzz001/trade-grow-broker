/**
 * adminEventBus.ts
 * 
 * Central event bus for real-time admin notifications.
 * Routes user/trade/position/funds events to subscribed admin WebSocket clients.
 * 
 * Usage:
 *   import { adminEventBus } from '../utils/adminEventBus';
 *   adminEventBus.emit('USER_STATUS_UPDATED', userId, { status: 'SUSPENDED', ... });
 */

import { EventEmitter } from 'events';

export type AdminEventType =
  | 'USER_STATUS_UPDATED'
  | 'USER_PROFILE_UPDATED'
  | 'ORDER_CREATED'
  | 'ORDER_UPDATED'
  | 'TRADE_EXECUTED'
  | 'POSITION_UPDATED'
  | 'FUNDS_UPDATED'
  | 'KYC_UPDATED'
  | 'RISK_ALERT';

export interface AdminEvent {
  type: AdminEventType;
  userId: string;
  payload: Record<string, any>;
  timestamp: number;
}

class AdminEventBus extends EventEmitter {
  /** Emit an event for a specific user that all watching admins should receive */
  emitUserEvent(type: AdminEventType, userId: string, payload: Record<string, any>): void {
    const event: AdminEvent = {
      type,
      userId,
      payload,
      timestamp: Date.now()
    };
    this.emit(`user:${userId}`, event);
    this.emit('all', event);  // also emit to global admin listeners
  }

  /** Subscribe to events for a specific user */
  onUserEvent(userId: string, handler: (event: AdminEvent) => void): void {
    this.on(`user:${userId}`, handler);
  }

  /** Unsubscribe from events for a specific user */
  offUserEvent(userId: string, handler: (event: AdminEvent) => void): void {
    this.off(`user:${userId}`, handler);
  }

  /** Subscribe to all events (for global admin monitors) */
  onAllEvents(handler: (event: AdminEvent) => void): void {
    this.on('all', handler);
  }

  offAllEvents(handler: (event: AdminEvent) => void): void {
    this.off('all', handler);
  }
}

// Singleton event bus — shared across the entire server process
export const adminEventBus = new AdminEventBus();
adminEventBus.setMaxListeners(500); // support many concurrent admin sessions
