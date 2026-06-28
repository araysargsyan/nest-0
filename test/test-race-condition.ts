/**
 * Race Condition Test for /api/auth/refresh
 *
 * This script:
 *  1. Registers a new test user
 *  2. Sends 3 parallel GET /api/auth/refresh requests using the same refreshToken
 *  3. Parses the Set-Cookie headers, extracting accessToken and refreshToken
 *  4. Compares them — all 3 responses MUST contain identical tokens
 *
 * Run:      npx ts-node test/test-race-condition.ts
 * Condition: NestJS must be running on http://localhost:4400
 */

import * as http from 'http';

const API_BASE = 'http://localhost:4400';

interface HttpResponse {
  statusCode: number | undefined;
  headers: http.IncomingHttpHeaders;
  cookies: string[];
  body: any;
}

// ───────────────────── HTTP helper ─────────────────────
function makeRequest(
  url: string,
  method: string,
  headers: Record<string, string> = {},
  body: any = null,
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const options: http.RequestOptions = {
      hostname: u.hostname,
      port: u.port,
      path: u.pathname + u.search,
      method,
      headers: { 'Content-Type': 'application/json', ...headers },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        const cookies = (res.headers['set-cookie'] as string[]) || [];
        let parsedBody: any = null;
        try {
          parsedBody = data ? JSON.parse(data) : null;
        } catch {
          parsedBody = data;
        }
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          cookies,
          body: parsedBody,
        });
      });
    });

    req.on('error', (err) => reject(err));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// ───────────────────── Cookie parser ─────────────────────
function extractCookieValue(cookiesArr: string[], name: string): string | null {
  for (const cookie of cookiesArr) {
    const match = cookie.match(new RegExp(`^${name}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

// ───────────────────── Main ─────────────────────
async function run() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║          RACE CONDITION TEST — /api/auth/refresh        ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');

  // ── Step 1: Register ──
  const uniqueId = Math.random().toString(36).substring(2, 8);
  const email = `race_test_${uniqueId}@example.com`;

  console.log(`[1/4] Registering user: ${email}`);
  let signUpRes: HttpResponse;
  try {
    signUpRes = await makeRequest(
      `${API_BASE}/api/auth/sign-up`,
      'POST',
      {},
      {
        email,
        password: 'Test_password_123',
        name: `Race_${uniqueId}`,
        surname: 'Tester',
      },
    );
  } catch (err: any) {
    console.error(
      `\n❌ Failed to connect to ${API_BASE}. Is NestJS running?\n   Error: ${err.message}`,
    );
    process.exit(1);
  }

  if (signUpRes.statusCode !== 201) {
    console.error(
      `\n❌ Registration failed (status ${signUpRes.statusCode}):`,
      signUpRes.body,
    );
    process.exit(1);
  }

  const refreshToken = signUpRes.body.refreshToken;
  if (!refreshToken) {
    console.error('\n❌ Sign-up response does not contain refreshToken:', signUpRes.body);
    process.exit(1);
  }
  console.log('   ✅ User created, refreshToken received.');

  // ── Step 2: Parallel requests ──
  const N = 3;
  console.log(`\n[2/4] Sending ${N} parallel GET /api/auth/refresh requests...`);

  const cookieHeader = { Cookie: `refreshToken=${refreshToken}` };

  const results = await Promise.all(
    Array.from({ length: N }, () =>
      makeRequest(`${API_BASE}/api/auth/refresh`, 'GET', cookieHeader),
    ),
  );

  // ── Step 3: Parse cookies ──
  console.log('\n[3/4] Results:');
  console.log('─'.repeat(60));

  const parsed = results.map((res, i) => {
    const rt = extractCookieValue(res.cookies, 'refreshToken');
    const at = extractCookieValue(res.cookies, 'accessToken');
    const tag = `   Request #${i + 1}`;

    if (res.statusCode === 200) {
      console.log(`${tag}: ✅ 200 OK`);
      console.log(`          refreshToken = ${rt ? rt.substring(0, 30) + '...' : '(not found)'}`);
      console.log(`          accessToken  = ${at ? at.substring(0, 30) + '...' : '(not found)'}`);
    } else {
      console.log(`${tag}: ❌ ${res.statusCode} — ${JSON.stringify(res.body)}`);
    }

    return { statusCode: res.statusCode, refreshToken: rt, accessToken: at };
  });

  // ── Step 4: Analysis ──
  console.log('');
  console.log('─'.repeat(60));
  console.log('[4/4] ANALYSIS:');
  console.log('');

  const successes = parsed.filter((p) => p.statusCode === 200);
  const failures = parsed.filter((p) => p.statusCode !== 200);

  if (successes.length === 0) {
    console.log('❌ FAIL — All requests returned an error. Race condition not resolved.');
    process.exit(1);
  }

  // All successful responses must have identical cookies
  const uniqueRT = new Set(successes.map((s) => s.refreshToken));
  const uniqueAT = new Set(successes.map((s) => s.accessToken));

  const allSameRT = uniqueRT.size === 1 && !uniqueRT.has(null);
  const allSameAT = uniqueAT.size === 1 && !uniqueAT.has(null);

  if (successes.length === N && allSameRT && allSameAT) {
    console.log('🎉 SUCCESS — All 3 requests returned 200 with IDENTICAL tokens!');
    console.log('   Redis Lock + Pub/Sub + Grace Period are working correctly.');
    console.log('   Race condition RESOLVED. ✅');
  } else if (successes.length === N && (!allSameRT || !allSameAT)) {
    console.log('❌ FAIL — All 3 requests returned 200, but tokens DIFFER!');
    console.log('   This means the race condition is NOT resolved — each request');
    console.log('   generated its own set of tokens instead of reusing one.');
    if (!allSameRT) console.log('   ↳ refreshToken differs between responses');
    if (!allSameAT) console.log('   ↳ accessToken differs between responses');
  } else {
    console.log(
      `⚠️  PARTIAL — ${successes.length}/${N} requests succeeded, ${failures.length} failed.`,
    );
    if (allSameRT && allSameAT) {
      console.log('   Successful responses contain identical tokens — locking works.');
      console.log('   However, some requests failed — possibly timeout or reuse detection.');
    } else {
      console.log('   Additionally, the tokens in successful responses differ.');
      console.log('   Race condition is NOT resolved.');
    }
  }

  console.log('');
}

run();
