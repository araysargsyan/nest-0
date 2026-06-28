import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '@modules/app.module';
import { useContainer } from 'class-validator';
import cookieParser from 'cookie-parser';
import { PrismaService } from '@modules/shared/prisma/prisma.service';

// Set global Jest timeout for E2E tests (20 seconds)
jest.setTimeout(20000);

function extractCookieValue(cookiesHeader: string | string[] | undefined, name: string): string | null {
  if (!cookiesHeader) return null;
  const cookies = Array.isArray(cookiesHeader) ? cookiesHeader : [cookiesHeader];
  for (const cookie of cookies) {
    const match = cookie.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

describe('Authentication (e2e)', () => {
  let app: INestApplication;
  let server: any;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    
    // Enable cookie parsing middleware
    app.use(cookieParser());
    
    // Enable class-validator to use the NestJS DI container to resolve custom validation constraints
    useContainer(app.select(AppModule), { fallbackOnErrors: true });

    // Retrieve PrismaService instance from the application context
    prisma = app.get(PrismaService);

    await app.init();
    server = app.getHttpServer();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/auth/sign-in (POST)', () => {
    it('should return 400 on empty body', async () => {
      try {
        await request(server)
          .post('/auth/sign-in')
          .send({})
          .expect(400);

        process.stdout.write('\n   🎉 SUCCESS — /auth/sign-in (POST) returned 400 on empty body validation! ✅\n\n');
      } catch (error) {
        process.stdout.write('\n   ❌ FAILURE — /auth/sign-in (POST) failed to return 400 on empty body! 🚨\n\n');
        throw error;
      }
    });
  });

  describe('Race condition on /auth/refresh (GET)', () => {
    it('parallel refresh requests must return identical token pairs', async () => {
      const email = `race_test_${Math.random().toString(36).substring(2, 9)}@example.com`;

      try {
        const server = app.getHttpServer();

        // 1. Sign up a new user dynamically to get a valid, unexpired refresh token cookie
        const signUpRes = await request(server)
          .post('/auth/sign-up')
          .send({
            email,
            password: 'Test_password_123',
            name: 'Race',
            surname: 'Tester',
          })
          .expect(201);

        const setCookieHeader = signUpRes.headers['set-cookie'];
        const initialCookies: string[] = Array.isArray(setCookieHeader)
          ? setCookieHeader
          : typeof setCookieHeader === 'string'
            ? [setCookieHeader]
            : [];

        // 2. Perform 3 parallel GET /auth/refresh requests using the valid cookies
        const [res1, res2, res3] = await Promise.all([
          request(server)
            .get('/auth/refresh')
            .set('Cookie', initialCookies)
            .expect(200),
          request(server)
            .get('/auth/refresh')
            .set('Cookie', initialCookies)
            .expect(200),
          request(server)
            .get('/auth/refresh')
            .set('Cookie', initialCookies)
            .expect(200),
        ]);

        // 3. Extract the new refresh and access tokens from the response cookies
        const refToken1 = extractCookieValue(res1.headers['set-cookie'], 'refreshToken');
        const refToken2 = extractCookieValue(res2.headers['set-cookie'], 'refreshToken');
        const refToken3 = extractCookieValue(res3.headers['set-cookie'], 'refreshToken');
        const accToken1 = extractCookieValue(res1.headers['set-cookie'], 'accessToken');
        const accToken2 = extractCookieValue(res2.headers['set-cookie'], 'accessToken');
        const accToken3 = extractCookieValue(res3.headers['set-cookie'], 'accessToken');

        expect(refToken1).not.toBeNull();
        expect(refToken2).not.toBeNull();
        expect(refToken3).not.toBeNull();
        expect(accToken1).not.toBeNull();
        expect(accToken2).not.toBeNull();
        expect(accToken3).not.toBeNull();

        // 4. Assert that all 3 parallel requests got the exact same new token pairs
        expect(refToken1).toEqual(refToken2);
        expect(refToken1).toEqual(refToken3);
        expect(accToken1).toEqual(accToken2);
        expect(accToken1).toEqual(accToken3);

        process.stdout.write('\n   🎉 SUCCESS — All 3 requests returned 200 with IDENTICAL tokens!');
        process.stdout.write('\n   Redis Lock + Pub/Sub + Grace Period are working correctly.');
        process.stdout.write('\n   Race condition RESOLVED. ✅\n\n');
      } catch (error) {
        process.stdout.write('\n   ❌ FAILURE — Parallel refresh requests returned mismatching tokens or failed! 🚨\n\n');
        throw error;
      } finally {
        // 5. Clean up the registered test user by unique email index to prevent hangs
        try {
          await prisma.user.delete({
            where: { email },
          });
        } catch (e) {
          process.stdout.write(`\n   ⚠️ Warn: Database E2E user cleanup failed: ${e}\n`);
        }
      }
    });
  });
});
