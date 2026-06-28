# Production-grade Refresh Token Rotation — Full Implementation

## Architecture

- **Rotation** — every refresh issues a new pair, the old refresh token is invalidated
- **Family tracking** — all tokens in one session are linked by `familyId`; reuse detection revokes the entire family
- **Distributed lock via Redis** — protects against race conditions on parallel requests
- **Pub/Sub instead of polling** — waiting requests subscribe to an event instead of hammering Redis
- **Grace period** — a short window so parallel legitimate requests get the same result

---

## DB Schema

```ts
// refresh-token.entity.ts
@Entity('refresh_tokens')
export class RefreshTokenEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    userId: string;

    @Column()
    tokenHash: string; // sha256 hash of the raw token, never store raw

    @Column()
    familyId: string; // links the rotation chain of one session

    @Column({ default: false })
    revoked: boolean;

    @Column({ nullable: true })
    usedAt: Date | null;

    @CreateDateColumn()
    createdAt: Date;

    @Column()
    expiresAt: Date;
}
```

---

## Redis service (lock + pub/sub)

```ts
// redis-lock.service.ts
import { Injectable } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService {
    private subscriberClient: Redis;

    constructor(private readonly redis: Redis) {
        this.subscriberClient = redis.duplicate();
    }

    async acquireLock(key: string, ttlSeconds: number): Promise<boolean> {
        const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
        return result === 'OK';
    }

    async releaseLock(key: string): Promise<void> {
        await this.redis.del(key);
    }

    async publishResult(channel: string, payload: string, ttlSeconds: number): Promise<void> {
        // Save to grace cache for anyone who subscribes AFTER the publish
        await this.redis.set(`grace:${channel}`, payload, 'EX', ttlSeconds);
        // And publish for anyone already subscribed and waiting RIGHT NOW
        await this.redis.publish(channel, payload);
    }

    async getGraceResult(channel: string): Promise<string | null> {
        return this.redis.get(`grace:${channel}`);
    }

    async waitForResult(channel: string, timeoutMs: number): Promise<string> {
        // First check if the result is already ready (narrow window between checks)
        const existing = await this.getGraceResult(channel);
        if (existing) return existing;

        return new Promise((resolve, reject) => {
            const subscriber = this.subscriberClient.duplicate();

            const timeout = setTimeout(async () => {
                await subscriber.unsubscribe(channel);
                subscriber.disconnect();
                reject(new Error('REFRESH_TIMEOUT'));
            }, timeoutMs);

            subscriber.subscribe(channel, (err) => {
                if (err) {
                    clearTimeout(timeout);
                    reject(err);
                }
            });

            subscriber.on('message', (receivedChannel, message) => {
                if (receivedChannel === channel) {
                    clearTimeout(timeout);
                    subscriber.unsubscribe(channel);
                    subscriber.disconnect();
                    resolve(message);
                }
            });
        });
    }
}
```

---

## Main AuthService

```ts
// auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RefreshTokenEntity } from './refresh-token.entity';
import { RedisLockService } from './redis-lock.service';
import { JwtService } from '@nestjs/jwt';

const LOCK_TTL_SECONDS = 5;
const GRACE_PERIOD_SECONDS = 20;
const WAIT_TIMEOUT_MS = 4000;
const REFRESH_TOKEN_TTL_DAYS = 30;

type TTokenPair = {
    accessToken: string;
    refreshToken: string;
};

@Injectable()
export class AuthService {
    constructor(
        @InjectRepository(RefreshTokenEntity)
        private readonly refreshRepo: Repository<RefreshTokenEntity>,
        private readonly redisLock: RedisLockService,
        private readonly jwtService: JwtService,
    ) {}

    private hashToken(token: string): string {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    private generateRawToken(): string {
        return crypto.randomBytes(32).toString('hex');
    }

    async generateAccessToken(userId: string): Promise<string> {
        return this.jwtService.signAsync({ sub: userId }, { expiresIn: '15m' });
    }

    private async createRefreshTokenRecord(userId: string, familyId: string): Promise<string> {
        const rawToken = this.generateRawToken();
        const tokenHash = this.hashToken(rawToken);

        await this.refreshRepo.save({
            userId,
            tokenHash,
            familyId,
            revoked: false,
            usedAt: null,
            expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
        });

        return rawToken;
    }

    /**
     * Called at login — creates a new family
     */
    async createInitialSession(userId: string): Promise<TTokenPair> {
        const familyId = uuidv4();
        const refreshToken = await this.createRefreshTokenRecord(userId, familyId);
        const accessToken = await this.generateAccessToken(userId);
        return { accessToken, refreshToken };
    }

    /**
     * MAIN METHOD: rotation with lock + grace period + family reuse detection
     */
    async refresh(oldRefreshToken: string): Promise<TTokenPair> {
        const tokenHash = this.hashToken(oldRefreshToken);
        const lockKey = `refresh:lock:${tokenHash}`;
        const channelKey = `refresh:channel:${tokenHash}`;

        const acquired = await this.redisLock.acquireLock(lockKey, LOCK_TTL_SECONDS);

        if (!acquired) {
            // Someone else is already processing this token — wait via Pub/Sub
            try {
                const result = await this.redisLock.waitForResult(channelKey, WAIT_TIMEOUT_MS);
                return JSON.parse(result);
            } catch {
                throw new UnauthorizedException('Refresh timeout, please retry');
            }
        }

        try {
            // In case someone finished and wrote to the grace cache
            // between the moment "no lock existed" and "we acquired it"
            const cached = await this.redisLock.getGraceResult(channelKey);
            if (cached) return JSON.parse(cached);

            const tokenRecord = await this.refreshRepo.findOne({ where: { tokenHash } });

            if (!tokenRecord) {
                throw new UnauthorizedException('Invalid refresh token'); // Case 4
            }

            if (tokenRecord.expiresAt < new Date()) {
                throw new UnauthorizedException('Refresh token expired');
            }

            if (tokenRecord.revoked) {
                // Case 3: token already used and grace period didn't save it —
                // this is a genuine repeat use of an old token → theft
                await this.refreshRepo.update(
                    { familyId: tokenRecord.familyId },
                    { revoked: true },
                );
                throw new UnauthorizedException('Token reuse detected, session revoked');
            }

            // Case 1/5: normal refresh
            const newRefreshToken = await this.createRefreshTokenRecord(
                tokenRecord.userId,
                tokenRecord.familyId,
            );
            const newAccessToken = await this.generateAccessToken(tokenRecord.userId);

            await this.refreshRepo.update(tokenRecord.id, {
                revoked: true,
                usedAt: new Date(),
            });

            const responsePayload = JSON.stringify({
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
            });

            await this.redisLock.publishResult(channelKey, responsePayload, GRACE_PERIOD_SECONDS);

            return JSON.parse(responsePayload);
        } finally {
            await this.redisLock.releaseLock(lockKey);
        }
    }
}
```

---

## Controller

```ts
// auth.controller.ts
import { Controller, Get, Req, Res, UnauthorizedException } from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Throttle({ default: { limit: 10, ttl: 60_000 } }) // extra abuse protection on top of the main logic
    @Get('refresh')
    async refresh(@Req() req: Request, @Res() res: Response) {
        const oldRefreshToken = req.cookies['refreshToken'];

        if (!oldRefreshToken) {
            throw new UnauthorizedException('No refresh token provided');
        }

        const { accessToken, refreshToken } = await this.authService.refresh(oldRefreshToken);

        res.cookie('accessToken', accessToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 15 * 60 * 1000,
        });

        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'lax',
            maxAge: 30 * 24 * 60 * 60 * 1000,
        });

        return res.json({ success: true });
    }
}
```

---

## Coverage table

| Scenario | Mechanism |
|---|---|
| Normal refresh | rotation, new pair, old token revoked |
| Parallel requests (race) | Redis lock + Pub/Sub, not polling |
| Reuse after grace period | family revoke, re-login required |
| Non-existent token | 401 |
| Expired token | 401 |
| Abuse/DDoS | Throttle on top of the main logic |
| Lock stuck after a crash | TTL on the lock (5 sec), self-cleaning |

This is the full picture of best practice for refresh rotation in production with high traffic.

---

## When this is overkill

For a typical SaaS/MVP without massive concurrent traffic, this is more than needed. A simpler version is enough:

- Rotation (new pair every refresh)
- Family revoke on reuse detection
- No Redis lock, no grace period, no Pub/Sub

The race condition this solves happens roughly once in a million requests when two parallel refresh calls hit at the exact same millisecond. In the simpler version, the worst case is just one extra logout for the user — not critical for most products.

Reach for the Redis lock + Pub/Sub version specifically when:
- Traffic is genuinely high (many concurrent users hitting refresh)
- Mobile clients with unstable networks causing retry storms
- Strict security/compliance requirements around session handling

If using SQL instead of Redis (`SELECT ... FOR UPDATE` in a transaction) — this works too at low/medium traffic, but at very high traffic it holds connection pool slots and adds load to the same database serving the rest of the product, so Redis is the better choice once traffic gets large.
