use anchor_lang::prelude::*;

declare_id!("CL6e7FZkgQ6GLwYbmcsz4kwi2hZzzWoP7ckWgSbvF7ja");

pub const GOAL: u8 = 0;
pub const RESULT: u8 = 1;

pub const STATUS_OPEN: u8 = 0;
pub const STATUS_CLOSED: u8 = 1;
pub const STATUS_VOID: u8 = 2;

#[program]
pub mod moment_mint {
    use super::*;

    /// Called by keeper to open a minting window for a moment.
    pub fn open_moment_window(
        ctx: Context<OpenMomentWindow>,
        fixture_id: String,
        seq: u64,
        open_ts: i64,
        close_ts: i64,
        kind: u8,
        metadata_uri: String,
    ) -> Result<()> {
        let moment = &mut ctx.accounts.moment;
        moment.authority = ctx.accounts.authority.key();
        moment.fixture_id = fixture_id;
        moment.seq = seq;
        moment.open_ts = open_ts;
        moment.close_ts = close_ts;
        moment.kind = kind;
        moment.metadata_uri = metadata_uri;
        moment.mint_count = 0;
        moment.status = STATUS_OPEN;
        Ok(())
    }

    /// Called by anyone to mint an NFT during the open window.
    pub fn mint_moment(ctx: Context<MintMoment>) -> Result<()> {
        let moment = &mut ctx.accounts.moment;
        let clock = Clock::get()?;
        let now = clock.unix_timestamp;

        require!(moment.status == STATUS_OPEN, MomentoError::WindowNotOpen);
        require!(now >= moment.open_ts, MomentoError::WindowNotOpen);
        require!(now <= moment.close_ts, MomentoError::WindowClosed);

        moment.mint_count += 1;
        // TODO: CPI to mpl-core to create asset (stretch)
        // For MVP, just increment count and emit event
        emit!(MintEvent {
            fixture_id: moment.fixture_id.clone(),
            seq: moment.seq,
            minter: ctx.accounts.minter.key(),
            mint_count: moment.mint_count,
        });
        Ok(())
    }

    /// Called by keeper to void a moment (e.g., VAR cancellation).
    pub fn void_moment(ctx: Context<VoidMoment>) -> Result<()> {
        let moment = &mut ctx.accounts.moment;
        moment.status = STATUS_VOID;
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(fixture_id: String, seq: u64)]
pub struct OpenMomentWindow<'info> {
    #[account(
        init,
        payer = authority,
        space = Moment::space(&fixture_id),
        seeds = [b"moment", fixture_id.as_bytes(), &seq.to_le_bytes()],
        bump
    )]
    pub moment: Account<'info, Moment>,
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintMoment<'info> {
    #[account(mut, constraint = moment.status == STATUS_OPEN)]
    pub moment: Account<'info, Moment>,
    pub minter: Signer<'info>,
}

#[derive(Accounts)]
pub struct VoidMoment<'info> {
    #[account(
        mut,
        has_one = authority,
    )]
    pub moment: Account<'info, Moment>,
    pub authority: Signer<'info>,
}

#[account]
pub struct Moment {
    pub authority: Pubkey,
    pub fixture_id: String,
    pub seq: u64,
    pub open_ts: i64,
    pub close_ts: i64,
    pub kind: u8,
    pub metadata_uri: String,
    pub mint_count: u64,
    pub status: u8,
}

impl Moment {
    pub fn space(fixture_id: &str) -> usize {
        8 +                    // discriminator
        32 +                   // authority
        4 + fixture_id.len() + // fixture_id string
        8 +                    // seq
        8 +                    // open_ts
        8 +                    // close_ts
        1 +                    // kind
        4 + 200 +              // metadata_uri (max 200 chars)
        8 +                    // mint_count
        1                      // status
    }
}

#[event]
pub struct MintEvent {
    pub fixture_id: String,
    pub seq: u64,
    pub minter: Pubkey,
    pub mint_count: u64,
}

#[error_code]
pub enum MomentoError {
    #[msg("Minting window is not open yet")]
    WindowNotOpen,
    #[msg("Minting window has closed")]
    WindowClosed,
}
