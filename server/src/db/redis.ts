import Redis from 'ioredis';

/**
 * Redis Client Infrastructure for Caching, Pub/Sub & WebSocket Fan-out
 * P3-1/3-2 FIX: Scalable distributed caching & pub/sub with graceful fallback.
 */

class RedisService {
  private static instance: RedisService;
  private client: Redis | null = null;
  private subClient: Redis | null = null;
  private isConnected = false;
  private inMemoryCache = new Map<string, { value: string; expiresAt: number }>();
  private localSubscribers = new Map<string, Set<(message: string) => void>>();

  private constructor() {
    const redisUrl = process.env.REDIS_URL;
    const host = process.env.REDIS_HOST || 'localhost';
    const port = parseInt(process.env.REDIS_PORT || '6379', 10);

    try {
      const options = {
        maxRetriesPerRequest: 1,
        enableOfflineQueue: false,
        connectTimeout: 3000,
        retryStrategy: (times: number) => {
          if (times > 3) {
            console.warn('[Redis] Connection retries exhausted. Running in degraded in-memory mode.');
            return null; // Stop retrying
          }
          return Math.min(times * 500, 2000);
        }
      };

      if (redisUrl) {
        this.client = new Redis(redisUrl, options);
      } else {
        this.client = new Redis({ host, port, ...options });
      }

      this.client.on('connect', () => {
        console.log('[Redis] ✅ Connected to Redis server.');
        this.isConnected = true;
      });

      this.client.on('error', (err) => {
        if (this.isConnected) {
          console.warn('[Redis] ⚠️ Redis error:', err.message);
        }
        this.isConnected = false;
      });
    } catch (err: any) {
      console.warn('[Redis] Failed to initialize Redis client. Degraded in-memory mode active.', err.message);
      this.isConnected = false;
    }
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  public isAvailable(): boolean {
    return this.isConnected && this.client !== null && this.client.status === 'ready';
  }

  /**
   * Set cache with TTL in seconds
   */
  public async set(key: string, value: string, ttlSeconds = 300): Promise<void> {
    if (this.isAvailable()) {
      try {
        await this.client!.set(key, value, 'EX', ttlSeconds);
        return;
      } catch (err: any) {
        console.warn(`[Redis] Set failed for key ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    this.inMemoryCache.set(key, { value, expiresAt: Date.now() + (ttlSeconds * 1000) });
  }

  /**
   * Get cache value by key
   */
  public async get(key: string): Promise<string | null> {
    if (this.isAvailable()) {
      try {
        return await this.client!.get(key);
      } catch (err: any) {
        console.warn(`[Redis] Get failed for key ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    const cached = this.inMemoryCache.get(key);
    if (!cached) return null;
    if (Date.now() > cached.expiresAt) {
      this.inMemoryCache.delete(key);
      return null;
    }
    return cached.value;
  }

  /**
   * Delete key from cache
   */
  public async del(key: string): Promise<void> {
    if (this.isAvailable()) {
      try {
        await this.client!.del(key);
      } catch (_) {}
    }
    this.inMemoryCache.delete(key);
  }

  /**
   * Pub/Sub: Publish message to Redis channel with in-memory fallback
   */
  public async publish(channel: string, message: string): Promise<void> {
    if (this.isAvailable()) {
      try {
        await this.client!.publish(channel, message);
      } catch (err: any) {
        console.warn(`[Redis] Publish failed for channel ${channel}:`, err.message);
      }
    }
    // Trigger local in-memory subscribers regardless
    const subs = this.localSubscribers.get(channel);
    if (subs) {
      subs.forEach(cb => cb(message));
    }
  }

  /**
   * Pub/Sub: Subscribe to channel
   */
  public async subscribe(channel: string, callback: (message: string) => void): Promise<void> {
    if (!this.localSubscribers.has(channel)) {
      this.localSubscribers.set(channel, new Set());
    }
    this.localSubscribers.get(channel)!.add(callback);

    if (this.isAvailable()) {
      if (!this.subClient) {
        this.subClient = this.client!.duplicate();
        this.subClient.on('message', (ch, msg) => {
          const callbacks = this.localSubscribers.get(ch);
          if (callbacks) {
            callbacks.forEach(cb => cb(msg));
          }
        });
      }
      try {
        await this.subClient.subscribe(channel);
      } catch (err: any) {
        console.warn(`[Redis] Subscribe failed for channel ${channel}:`, err.message);
      }
    }
  }

  /**
   * Set key with TTL only if key does NOT already exist (Atomic SET ... NX EX).
   * Returns true if key was set, false if key already exists.
   */
  public async setNx(key: string, value: string, ttlSeconds = 10): Promise<boolean> {
    if (this.isAvailable()) {
      try {
        const res = await this.client!.set(key, value, 'EX', ttlSeconds, 'NX');
        return res === 'OK';
      } catch (err: any) {
        console.warn(`[Redis] setNx failed for ${key}, falling back to memory:`, err.message);
      }
    }
    // In-memory fallback
    const now = Date.now();
    const existing = this.inMemoryCache.get(key);
    if (existing && now < existing.expiresAt) {
      return false; // Already locked
    }
    this.inMemoryCache.set(key, { value, expiresAt: now + (ttlSeconds * 1000) });
    return true;
  }

  /**
   * Acquire a distributed lock.
   */
  public async acquireLock(lockKey: string, ttlSeconds = 10, identifier = '1'): Promise<boolean> {
    return this.setNx(lockKey, identifier, ttlSeconds);
  }

  /**
   * Release a distributed lock.
   */
  public async releaseLock(lockKey: string): Promise<void> {
    await this.del(lockKey);
  }

  /**
   * Get Redis operational health & metrics.
   */
  public async getHealthMetrics(): Promise<{
    connected: boolean;
    mode: 'REDIS_SERVER' | 'IN_MEMORY_FALLBACK';
    inMemoryKeysCount: number;
    redisInfo?: Record<string, string>;
  }> {
    const connected = this.isAvailable();
    if (!connected) {
      return {
        connected: false,
        mode: 'IN_MEMORY_FALLBACK',
        inMemoryKeysCount: this.inMemoryCache.size
      };
    }

    try {
      const info = await this.client!.info('memory');
      const memoryUsedMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const peakMemoryMatch = info.match(/used_memory_peak_human:([^\r\n]+)/);

      return {
        connected: true,
        mode: 'REDIS_SERVER',
        inMemoryKeysCount: this.inMemoryCache.size,
        redisInfo: {
          usedMemory: memoryUsedMatch ? memoryUsedMatch[1] : 'unknown',
          peakMemory: peakMemoryMatch ? peakMemoryMatch[1] : 'unknown'
        }
      };
    } catch (_) {
      return {
        connected: true,
        mode: 'REDIS_SERVER',
        inMemoryKeysCount: this.inMemoryCache.size
      };
    }
  }
}

export const redis = RedisService.getInstance();
