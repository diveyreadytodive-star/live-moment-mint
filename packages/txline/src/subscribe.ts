/**
 * On-chain subscribe + token activate flow.
 * Run this once to get an API token, then save it to .env as TXLINE_API_TOKEN.
 */
import * as anchor from '@coral-xyz/anchor';
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from '@solana/spl-token';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getGuestJwt, activateApiToken } from './auth';

const DEVNET_CONFIG = {
  rpcUrl: 'https://api.devnet.solana.com',
  apiOrigin: 'https://txline-dev.txodds.com',
  programId: new PublicKey('6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J'),
  txlTokenMint: new PublicKey('4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG'),
};

const SERVICE_LEVEL_ID = 1;
const DURATION_WEEKS = 4;

export async function subscribeAndActivate(keypair: anchor.web3.Keypair): Promise<string> {
  const { rpcUrl, apiOrigin, programId, txlTokenMint } = DEVNET_CONFIG;

  const connection = new anchor.web3.Connection(rpcUrl, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  anchor.setProvider(provider);

  // Load IDL at runtime (will be populated after anchor build)
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const idl = require('../idl/txoracle-devnet.json');
  const program = new anchor.Program(idl, provider);

  const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('token_treasury_v2')],
    programId,
  );
  const tokenTreasuryVault = getAssociatedTokenAddressSync(
    txlTokenMint,
    tokenTreasuryPda,
    true,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
  const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('pricing_matrix')],
    programId,
  );
  const userTokenAccount = getAssociatedTokenAddressSync(
    txlTokenMint,
    keypair.publicKey,
    false,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );

  console.log('Sending subscribe tx...');
  const txSig = await (program.methods as any)
    .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
    .accounts({
      user: keypair.publicKey,
      pricingMatrix: pricingMatrixPda,
      tokenMint: txlTokenMint,
      userTokenAccount,
      tokenTreasuryVault,
      tokenTreasuryPda,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log('Subscribe tx:', txSig);

  const jwt = await getGuestJwt(apiOrigin);
  const apiToken = await activateApiToken(apiOrigin, jwt, txSig, keypair);
  console.log('API token activated:', apiToken);
  return apiToken;
}
