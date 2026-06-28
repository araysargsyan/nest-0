// test/auth-refresh.race.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/modules/app.module';

// Insert your valid refresh token here
const VALID_REFRESH_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJqb2huLmRvZUBleGFtcGxlLmNvbSIsIm5hbWUiOiJKb2huIiwic3VybmFtZSI6IkRvZSIsImlhdCI6MTc4MTkwNjAzMSwiZXhwIjoxNzgxOTA3MjMxfQ.w_ErSmCx4tDgbTQxZhGFJqkFY4DQN6Bwge8_-ftqoeg';

describe('Race condition on /auth/refresh', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('parallel refresh requests must return identical token pairs', async () => {
    const server = app.getHttpServer();
    const [res1, res2] = await Promise.all([
      request(server)
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${VALID_REFRESH_TOKEN}`])
        .expect(200),
      request(server)
        .post('/auth/refresh')
        .set('Cookie', [`refreshToken=${VALID_REFRESH_TOKEN}`])
        .expect(200),
    ]);
    const payload1 = typeof res1.body === 'object' ? res1.body : JSON.parse(res1.text);
    const payload2 = typeof res2.body === 'object' ? res2.body : JSON.parse(res2.text);
    expect(payload1.refreshToken).toBeDefined();
    expect(payload2.refreshToken).toBeDefined();
    expect(payload1.accessToken).toBeDefined();
    expect(payload2.accessToken).toBeDefined();
    expect(payload1.refreshToken).toEqual(payload2.refreshToken);
    expect(payload1.accessToken).toEqual(payload2.accessToken);
  });
});
