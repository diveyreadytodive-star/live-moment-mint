/**
 * Phase 0 smoke test — calls TxLINE guest auth and prints the JWT.
 * Run: npx ts-node scripts/smoke-test.ts
 */

async function main() {
  const origin = process.env.TXLINE_API_ORIGIN ?? 'https://txline-dev.txodds.com';
  const url = `${origin}/auth/guest/start`;

  console.log(`POST ${url}`);
  const res = await fetch(url, { method: 'POST' });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as { token?: string };
  if (!data.token) {
    throw new Error(`Unexpected response: ${JSON.stringify(data)}`);
  }

  console.log('JWT OK:', data.token.slice(0, 40) + '...');
  console.log('Full token:');
  console.log(data.token);
}

main().catch((err) => {
  console.error('Smoke test FAILED:', err);
  process.exit(1);
});
