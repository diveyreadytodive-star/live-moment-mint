/**
 * One-time script: subscribe on-chain + activate TxLINE API token.
 * Run: pnpm --filter keeper subscribe
 * Output: save the printed API token to .env as TXLINE_API_TOKEN
 */
import 'dotenv/config';
import * as anchor from '@coral-xyz/anchor';
import fs from 'fs';
import path from 'path';
import { subscribeAndActivate } from '@momento/txline';

const KEEPER_WALLET_PATH = process.env.KEEPER_WALLET_PATH ?? './devnet-keeper.json';

async function main() {
  const raw = fs.readFileSync(path.resolve(KEEPER_WALLET_PATH));
  const secretKey = Uint8Array.from(JSON.parse(raw.toString()));
  const keypair = anchor.web3.Keypair.fromSecretKey(secretKey);

  console.log('Subscribing with wallet:', keypair.publicKey.toBase58());
  const apiToken = await subscribeAndActivate(keypair);
  console.log('\n✅ Save this to .env:');
  console.log(`TXLINE_API_TOKEN=${apiToken}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
