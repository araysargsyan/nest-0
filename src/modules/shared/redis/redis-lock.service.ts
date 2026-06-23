import { Injectable, OnModuleDestroy, Inject, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger('RedisLockService');
  private readonly subscriberClient: Redis;
  private readonly listeners = new Map<string, Set<(message: string) => void>>();
  private useMemoryFallback = false;

  // In-memory fallback stores
  private readonly memoryStore = new Map<string, string>();
  private readonly memoryListeners = new Map<string, Set<(message: string) => void>>();

  constructor(@Inject('REDIS_CLIENT') private readonly redis: Redis) {
    this.subscriberClient = this.redis.duplicate();

    // Catch connection errors silently to trigger memory fallback
    this.subscriberClient.on('error', () => {
      this.useMemoryFallback = true;
    });

    this.redis.on('error', () => {
      this.useMemoryFallback = true;
    });

    this.subscriberClient.on('message', (channel, message) => {
      const resolvers = this.listeners.get(channel);
      if (resolvers) {
        for (const resolve of resolvers) {
          resolve(message);
        }
        this.listeners.delete(channel);
        this.subscriberClient.unsubscribe(channel).catch(() => {});
      }
    });
  }

  async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
    if (this.useMemoryFallback) {
      if (this.memoryStore.has(key)) return false;
      this.memoryStore.set(key, '1');
      setTimeout(() => this.memoryStore.delete(key), ttlSeconds * 1000);
      return true;
    }

    try {
      const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
      return result === 'OK';
    } catch (err) {
      this.logger.warn(`Redis is offline, switching to fallback in-memory lock.`);
      this.useMemoryFallback = true;
      return this.acquireLock(key, ttlSeconds);
    }
  }

  async releaseLock(key: string): Promise<void> {
    if (this.useMemoryFallback) {
      this.memoryStore.delete(key);
      return;
    }

    try {
      await this.redis.del(key);
    } catch (err) {
      this.useMemoryFallback = true;
      this.releaseLock(key);
    }
  }

  async publishResult(channel: string, payload: string, ttlSeconds: number): Promise<void> {
    if (this.useMemoryFallback) {
      this.memoryStore.set(`grace:${channel}`, payload);
      setTimeout(() => this.memoryStore.delete(`grace:${channel}`), ttlSeconds * 1000);

      const resolvers = this.memoryListeners.get(channel);
      if (resolvers) {
        for (const resolve of resolvers) {
          resolve(payload);
        }
        this.memoryListeners.delete(channel);
      }
      return;
    }

    try {
      await this.redis.set(`grace:${channel}`, payload, 'EX', ttlSeconds);
      await this.redis.publish(channel, payload);
    } catch (err) {
      this.useMemoryFallback = true;
      await this.publishResult(channel, payload, ttlSeconds);
    }
  }

  async getGraceResult(channel: string): Promise<string | null> {
    if (this.useMemoryFallback) {
      return this.memoryStore.get(`grace:${channel}`) || null;
    }

    try {
      return await this.redis.get(`grace:${channel}`);
    } catch (err) {
      this.useMemoryFallback = true;
      return this.getGraceResult(channel);
    }
  }

  async waitForResult(channel: string, timeoutMs: number): Promise<string> {
    const existing = await this.getGraceResult(channel);
    if (existing) return existing;

    if (this.useMemoryFallback) {
      return new Promise((resolve, reject) => {
        let isResolved = false;

        const timeout = setTimeout(() => {
          if (!isResolved) {
            isResolved = true;
            const resolvers = this.memoryListeners.get(channel);
            if (resolvers) {
              resolvers.delete(resolveWrapper);
              if (resolvers.size === 0) this.memoryListeners.delete(channel);
            }
            reject(new Error('REFRESH_TIMEOUT'));
          }
        }, timeoutMs);

        const resolveWrapper = (msg: string) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            resolve(msg);
          }
        };

        let resolvers = this.memoryListeners.get(channel);
        if (!resolvers) {
          resolvers = new Set();
          this.memoryListeners.set(channel, resolvers);
        }
        resolvers.add(resolveWrapper);
      });
    }

    return new Promise((resolve, reject) => {
      let isResolved = false;

      const cleanup = () => {
        const resolvers = this.listeners.get(channel);
        if (resolvers) {
          resolvers.delete(resolveWrapper);
          if (resolvers.size === 0) {
            this.listeners.delete(channel);
            this.subscriberClient.unsubscribe(channel).catch(() => {});
          }
        }
      };

      const resolveWrapper = (message: string) => {
        if (!isResolved) {
          isResolved = true;
          clearTimeout(timeout);
          resolve(message);
        }
      };

      const timeout = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          cleanup();
          reject(new Error('REFRESH_TIMEOUT'));
        }
      }, timeoutMs);

      let resolvers = this.listeners.get(channel);
      if (!resolvers) {
        resolvers = new Set();
        this.listeners.set(channel, resolvers);
        this.subscriberClient.subscribe(channel).catch((err) => {
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeout);
            this.listeners.delete(channel);
            this.logger.warn(`Redis connection failed during subscribe: ${err.message}. Switching to in-memory fallback.`);
            this.useMemoryFallback = true;
            this.waitForResult(channel, timeoutMs).then(resolve).catch(reject);
          }
        });
      }

      if (!this.useMemoryFallback) {
        resolvers.add(resolveWrapper);
      }
    });
  }

  onModuleDestroy() {
    this.subscriberClient.disconnect();
    this.redis.disconnect();
  }
}
