import * as anchor from "@coral-xyz/anchor";
import { Program, BN } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

describe("moment-mint", () => {
  // Configure the client to use the local cluster.
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Load program from workspace
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const program = anchor.workspace.MomentMint as Program<any>;

  const FIXTURE_ID = "test-fixture-001";
  const SEQ = 1;
  const seqBn = new BN(SEQ);

  let momentPda: PublicKey;
  let momentBump: number;

  before(async () => {
    [momentPda, momentBump] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("moment"),
        Buffer.from(FIXTURE_ID),
        seqBn.toArrayLike(Buffer, "le", 8),
      ],
      program.programId,
    );
  });

  it("open_moment_window creates Moment PDA correctly", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const openTs = new BN(nowSec);
    const closeTs = new BN(nowSec + 300); // 5 min window

    const tx = await program.methods
      .openMomentWindow(
        FIXTURE_ID,
        seqBn,
        openTs,
        closeTs,
        0, // GOAL
        "https://example.com/metadata/test.json",
      )
      .accounts({
        moment: momentPda,
        authority: provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    console.log("openMomentWindow tx:", tx);

    const account = await (program.account as any).moment.fetch(momentPda);
    assert.equal(account.fixtureId, FIXTURE_ID);
    assert.equal(account.seq.toNumber(), SEQ);
    assert.equal(account.kind, 0);
    assert.equal(account.status, 0); // STATUS_OPEN
    assert.equal(account.mintCount.toNumber(), 0);
    assert.equal(
      account.authority.toBase58(),
      provider.wallet.publicKey.toBase58(),
    );
  });

  it("mint_moment increments mint_count during open window", async () => {
    const tx = await program.methods
      .mintMoment()
      .accounts({
        moment: momentPda,
        minter: provider.wallet.publicKey,
      })
      .rpc();

    console.log("mintMoment tx:", tx);

    const account = await (program.account as any).moment.fetch(momentPda);
    assert.equal(account.mintCount.toNumber(), 1);
  });

  it("void_moment sets status to VOID", async () => {
    const tx = await program.methods
      .voidMoment()
      .accounts({
        moment: momentPda,
        authority: provider.wallet.publicKey,
      })
      .rpc();

    console.log("voidMoment tx:", tx);

    const account = await (program.account as any).moment.fetch(momentPda);
    assert.equal(account.status, 2); // STATUS_VOID
  });
});
