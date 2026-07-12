/**
 * One-shot: create TxL token ATA, subscribe on-chain, activate API token
 * Run from repo root: node scripts/activate.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

const anchor = require('@coral-xyz/anchor');
const { getOrCreateAssociatedTokenAccount, getAssociatedTokenAddressSync, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID } = require('@solana/spl-token');
const { PublicKey, Connection } = require('@solana/web3.js');
const fs = require('fs');
const nacl = require('tweetnacl');
const axios = require('axios');

const IDL = JSON.parse(fs.readFileSync('./packages/txline/idl/txoracle-devnet.json', 'utf8'));
const raw = fs.readFileSync('./devnet-keeper.json', 'utf8');
const keypair = anchor.web3.Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));

const TXL_MINT = new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG');
const PROGRAM_ID = new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J');
const API_ORIGIN = 'https://txline-dev.txodds.com';

async function run() {
  const connection = new Connection('https://api.devnet.solana.com', 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  const program = new anchor.Program(IDL, provider);
  console.log('Wallet:', keypair.publicKey.toBase58());
  const bal = await connection.getBalance(keypair.publicKey);
  console.log('Balance:', bal / 1e9, 'SOL');

  // Step 1: Create ATA (Token-2022) if not exists
  console.log('\n[1] Creating TxL token ATA...');
  const ata = await getOrCreateAssociatedTokenAccount(
    connection,
    keypair,
    TXL_MINT,
    keypair.publicKey,
    false,
    'confirmed',
    { skipPreflight: false },
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  console.log('ATA:', ata.address.toBase58());

  // Step 2: PDAs
  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync([Buffer.from('token_treasury_v2')], PROGRAM_ID);
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync([Buffer.from('pricing_matrix')], PROGRAM_ID);
  const tokenTreasuryVault = getAssociatedTokenAddressSync(TXL_MINT, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);

  // Step 3: Subscribe on-chain
  console.log('\n[2] Sending subscribe tx (service level 1, 4 weeks)...');
  const txSig = await program.methods
    .subscribe(1, 4)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: TXL_MINT,
      userTokenAccount: ata.address,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();
  console.log('Subscribe tx:', txSig);

  // Step 4: Activate API token
  console.log('\n[3] Activating API token...');
  const jwtRes = await axios.post(API_ORIGIN + '/auth/guest/start');
  const jwt = jwtRes.data.token;

  const message = new TextEncoder().encode(`${txSig}::${jwt}`);
  const sigBytes = nacl.sign.detached(message, keypair.secretKey);
  const walletSignature = Buffer.from(sigBytes).toString('base64');

  const activateRes = await axios.post(
    `${API_ORIGIN}/api/token/activate`,
    { txSig, walletSignature, leagues: [] },
    { headers: { Authorization: `Bearer ${jwt}` } }
  );

  const apiToken = activateRes.data.token ?? activateRes.data;
  console.log('\n✅ API Token:', apiToken);

  // Step 5: Save to .env
  let env = fs.readFileSync('./.env', 'utf8');
  env = env.replace(/TXLINE_API_TOKEN=.*/, `TXLINE_API_TOKEN=${apiToken}`);
  fs.writeFileSync('./.env', env);
  console.log('✅ Saved TXLINE_API_TOKEN to .env');
}

run().catch(e => {
  console.error('Error:', e.message ?? e);
  if (e.response) console.error('Response:', JSON.stringify(e.response.data));
  process.exit(1);
});
