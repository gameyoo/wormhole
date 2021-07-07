use solitaire::*;

use solana_program::{
    program::invoke_signed,
    pubkey::Pubkey,
};
use solitaire::{
    processors::seeded::Seeded,
    CreationLamports::Exempt,
};

use crate::{
    accounts::{
        Bridge,
        GuardianSet,
        GuardianSetDerivationData,
    },
    types::{
        GovernancePayloadGuardianSetChange,
        GovernancePayloadSetMessageFee,
        GovernancePayloadTransferFees,
        GovernancePayloadUpgrade,
    },
    vaa::{
        ClaimableVAA,
        DeserializePayload,
    },
    Error::{
        InvalidFeeRecipient,
        InvalidGovernanceKey,
        InvalidGuardianSetUpgrade,
    },
    CHAIN_ID_SOLANA,
};

// Confirm that a ClaimableVAA came from the correct chain, signed by the right emitter.
fn verify_claim<'a, T>(vaa: &ClaimableVAA<'a, T>) -> Result<()>
where
    T: DeserializePayload,
{
    let expected_emitter = std::env!("EMITTER_ADDRESS");
    let current_emitter = format!(
        "{}",
        Pubkey::new_from_array(vaa.message.meta().emitter_address)
    );

    // Fail if the emitter is not the known governance key, or the emitting chain is not Solana.
    if expected_emitter != current_emitter || vaa.message.meta().emitter_chain != CHAIN_ID_SOLANA {
        Err(InvalidGovernanceKey.into())
    } else {
        Ok(())
    }
}

#[derive(FromAccounts)]
pub struct UpgradeContract<'b> {
    /// Payer for account creation (vaa-claim)
    pub payer: Signer<Info<'b>>,

    /// Upgrade VAA
    pub vaa: ClaimableVAA<'b, GovernancePayloadUpgrade>,

    /// PDA authority for the loader
    pub upgrade_authority: Derive<Info<'b>, "upgrade">,

    /// Spill address for the upgrade excess lamports
    pub spill: Info<'b>,
}

impl<'b> InstructionContext<'b> for UpgradeContract<'b> {
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct UpgradeContractData {}

pub fn upgrade_contract(
    ctx: &ExecutionContext,
    accs: &mut UpgradeContract,
    _data: UpgradeContractData,
) -> Result<()> {
    verify_claim(&accs.vaa)?;

    accs.vaa.claim(ctx, accs.payer.key)?;

    let upgrade_ix = solana_program::bpf_loader_upgradeable::upgrade(
        ctx.program_id,
        &accs.vaa.message.new_contract,
        accs.upgrade_authority.key,
        accs.spill.key,
    );

    let _seeds = accs.upgrade_authority.self_seeds(None);
    invoke_signed(&upgrade_ix, ctx.accounts, &[])?;

    Ok(())
}

#[derive(FromAccounts)]
pub struct UpgradeGuardianSet<'b> {
    /// Payer for account creation (vaa-claim)
    pub payer: Mut<Signer<Info<'b>>>,

    /// Bridge config
    pub bridge: Mut<Bridge<'b, { AccountState::Initialized }>>,

    /// GuardianSet change VAA
    pub vaa: ClaimableVAA<'b, GovernancePayloadGuardianSetChange>,

    /// Old guardian set
    pub guardian_set_old: GuardianSet<'b, { AccountState::Initialized }>,

    /// New guardian set
    pub guardian_set_new: Mut<GuardianSet<'b, { AccountState::Uninitialized }>>,
}

impl<'b> InstructionContext<'b> for UpgradeGuardianSet<'b> {
    fn verify(&self, _program_id: &Pubkey) -> Result<()> {
        if self.guardian_set_old.index != self.vaa.new_guardian_set_index - 1 {
            return Err(InvalidGuardianSetUpgrade.into());
        }

        if self.bridge.guardian_set_index != self.vaa.new_guardian_set_index - 1 {
            return Err(InvalidGuardianSetUpgrade.into());
        }

        Ok(())
    }
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct UpgradeGuardianSetData {}

pub fn upgrade_guardian_set(
    ctx: &ExecutionContext,
    accs: &mut UpgradeGuardianSet,
    _data: UpgradeGuardianSetData,
) -> Result<()> {
    verify_claim(&accs.vaa)?;

    accs.vaa.claim(ctx, accs.payer.key)?;

    // Set expiration time for the old set
    accs.guardian_set_old.expiration_time =
        accs.vaa.meta().vaa_time + accs.bridge.config.guardian_set_expiration_time;

    // Initialize new guardian Set
    accs.guardian_set_new.index = accs.vaa.new_guardian_set_index;
    accs.guardian_set_new.creation_time = accs.vaa.meta().vaa_time;
    accs.guardian_set_new.keys = accs.vaa.new_guardian_set.clone();

    // Create new guardian set
    // This is done after populating it to properly allocate space according to key vec length.
    accs.guardian_set_new.create(
        &GuardianSetDerivationData {
            index: accs.guardian_set_new.index,
        },
        ctx,
        accs.payer.key,
        Exempt,
    )?;

    // Set guardian set index
    accs.bridge.guardian_set_index = accs.vaa.new_guardian_set_index;

    Ok(())
}

#[derive(FromAccounts)]
pub struct SetFees<'b> {
    /// Payer for account creation (vaa-claim)
    pub payer: Mut<Signer<Info<'b>>>,

    /// Bridge config
    pub bridge: Mut<Bridge<'b, { AccountState::Initialized }>>,

    /// Governance VAA
    pub vaa: ClaimableVAA<'b, GovernancePayloadSetMessageFee>,
}

impl<'b> InstructionContext<'b> for SetFees<'b> {
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct SetFeesData {}

pub fn set_fees(ctx: &ExecutionContext, accs: &mut SetFees, _data: SetFeesData) -> Result<()> {
    verify_claim(&accs.vaa)?;

    accs.vaa.claim(ctx, accs.payer.key)?;

    accs.bridge.config.fee = accs.vaa.fee.as_u64();
    accs.bridge.config.fee_persistent = accs.vaa.persisted_fee.as_u64();

    Ok(())
}

#[derive(FromAccounts)]
pub struct TransferFees<'b> {
    /// Payer for account creation (vaa-claim)
    pub payer: Mut<Signer<Info<'b>>>,

    /// Bridge config
    pub bridge: Bridge<'b, { AccountState::Initialized }>,

    /// Governance VAA
    pub vaa: ClaimableVAA<'b, GovernancePayloadTransferFees>,

    /// Account collecting tx fees
    pub fee_collector: Mut<Derive<Info<'b>, "fee_collector">>,

    /// Fee recipient
    pub recipient: Mut<Info<'b>>,
}

impl<'b> InstructionContext<'b> for TransferFees<'b> {
    fn verify(&self, _program_id: &Pubkey) -> Result<()> {
        if self.vaa.to != self.recipient.key.to_bytes() {
            return Err(InvalidFeeRecipient.into());
        }

        Ok(())
    }
}

#[derive(BorshDeserialize, BorshSerialize, Default)]
pub struct TransferFeesData {}

pub fn transfer_fees(
    ctx: &ExecutionContext,
    accs: &mut TransferFees,
    _data: TransferFeesData,
) -> Result<()> {
    verify_claim(&accs.vaa)?;

    accs.vaa.claim(ctx, accs.payer.key)?;

    // Transfer fees
    let transfer_ix = solana_program::system_instruction::transfer(
        accs.fee_collector.key,
        accs.recipient.key,
        accs.vaa.amount.as_u64(),
    );

    let seeds = accs.fee_collector.self_bumped_seeds(None, ctx.program_id);
    let seeds: Vec<&[u8]> = seeds.iter().map(|item| item.as_slice()).collect();
    let seeds = seeds.as_slice();
    invoke_signed(&transfer_ix, ctx.accounts, &[seeds])?;

    Ok(())
}