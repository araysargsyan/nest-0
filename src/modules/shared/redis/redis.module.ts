import { Module, Global, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { RedisLockService } from './redis-lock.service';

@Global()
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (configService: ConfigService) => {
        const logger = new Logger('RedisModule');
        const host = configService.get<string>('REDIS_HOST', 'localhost');
        const port = configService.get<number>('REDIS_PORT', 6379);

        const client = new Redis({
          host,
          port,
          enableOfflineQueue: false, // Do not queue commands when offline
          maxRetriesPerRequest: 1,    // Fail fast
          retryStrategy: (times) => {
            // Limit connection retry attempts frequency to prevent spamming
            if (times === 1) return 2000;
            if (times === 2) return 5000;
            return 30000; // After 2 failed attempts, only try reconnecting every 30 seconds
          },
        });

        let loggedWarning = false;

        // Register error handler to prevent unhandled error event crashes/spam
        client.on('error', (err) => {
          if (!loggedWarning) {
            logger.warn(`Redis connection error: ${err.message}. Running in fallback in-memory mode.`);
            loggedWarning = true;
          }
        });

        client.on('connect', () => {
          logger.log('Successfully connected to Redis');
          loggedWarning = false;
        });

        return client;
      },
      inject: [ConfigService],
    },
    RedisLockService,
  ],
  exports: ['REDIS_CLIENT', RedisLockService],
})
export class RedisModule {}
