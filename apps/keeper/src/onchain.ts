/**
 * On-chain helpers — calls the Anchor moment-mint program on Solana devnet.
 * Phase 3: openMomentWindow, voidMoment.
 */
import * as anchor from '@coral-xyz/anchor';
import { Connection, PublicKey } from '@solana/web3.js';
import fs from 'fs';
import path from 'path';

const PROGRAM_ID_STR = process.env.MOMENTO_PROGRAM_ID ?? '';
const RPC = process.env.SOLANA_RPC_URL ?? 'https://api.devnet.solana.com';

let _program: anchor.Program | null = null;

export function getProgram(keeperKeypairPath: string): anchor.Program {
  if (_program) return _program;

  const raw = fs.readFileSync(path.resolve(keeperKeypairPath));
  const keypair = anchor.web3.Keypair.fromSecretKey(
    Uint8Array.from(JSON.parse(raw.toString())),
  );
  const connection = new Connection(RPC, 'confirmed');
  const wallet = new anchor.Wallet(keypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  anchor.setProvider(provider);

  // Prefer committed IDL, fallback to build target
  const idlPaths = [
    path.resolve(__dirname, '../../../programs/moment-mint/idl/moment_mint.json'),
    path.resolve(__dirname, '../../../programs/moment-mint/target/idl/moment_mint.json'),
  ];
  const idlPath = idlPaths.find(p => fs.existsSync(p));
  if (!idlPath) throw new Error('moment_mint IDL not found');
  const idl = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
  const programId = new PublicKey(PROGRAM_ID_STR);
  _program = new anchor.Program(idl, provider);
  return _program;
}

export async function onChainOpenWindow(
  keeperPath: string,
  _momentDbId: number,
  fixtureId: string,
  seq: number,
  openTs: number,
  closeTs: number,
  kind: 'GOAL' | 'RESULT',
  metadataUri: string,
): Promise<string | null> {
  if (!PROGRAM_ID_STR) {
    console.log('[onchain] MOMENTO_PROGRAM_ID not set, skipping on-chain call');
    return null;
  }
  try {
    const program = getProgram(keeperPath);
    const kindNum = kind === 'GOAL' ? 0 : 1;
    const seqBn = new anchor.BN(seq);

    const [momentPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('moment'),
        Buffer.from(fixtureId),
        seqBn.toArrayLike(Buffer, 'le', 8),
      ],
      program.programId,
    );

    const txSig = await (program.methods as any)
      .openMomentWindow(
        fixtureId,
        seqBn,
        new anchor.BN(openTs),
        new anchor.BN(closeTs),
        kindNum,
        metadataUri,
      )
      .accounts({
        moment: momentPda,
        authority: program.provider.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .rpc();

    console.log(
      `[onchain] openMomentWindow tx=${txSig} pda=${momentPda.toBase58()}`,
    );
    return momentPda.toBase58();
  } catch (err) {
    console.error('[onchain] openMomentWindow failed:', err);
    return null;
  }
}

export async function onChainVoidMoment(
  keeperPath: string,
  fixtureId: string,
  seq: number,
): Promise<boolean> {
  if (!PROGRAM_ID_STR) return false;
  try {
    const program = getProgram(keeperPath);
    const seqBn = new anchor.BN(seq);

    const [momentPda] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('moment'),
        Buffer.from(fixtureId),
        seqBn.toArrayLike(Buffer, 'le', 8),
      ],
      program.programId,
    );

    const txSig = await (program.methods as any)
      .voidMoment()
      .accounts({
        moment: momentPda,
        authority: program.provider.publicKey,
      })
      .rpc();

    console.log(`[onchain] voidMoment tx=${txSig} pda=${momentPda.toBase58()}`);
    return true;
  } catch (err) {
    console.error('[onchain] voidMoment failed:', err);
    return false;
  }
}
