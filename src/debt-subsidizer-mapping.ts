import {
  TrustedSignerUpdated,
  MerkleRootUpdated,
  SubsidyClaimed,
} from "../generated/DebtSubsidizer/DebtSubsidizer";
import {
  SubsidyTransaction,
  Account,
  Vault,
  TrustedSignerUpdate,
  Epoch,
  SystemState,
  MerkleDistribution,
  EpochVaultAllocation,
} from "../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";

export function handleTrustedSignerUpdated(event: TrustedSignerUpdated): void {
  const updateId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const signerUpdate = new TrustedSignerUpdate(updateId);

  signerUpdate.oldSigner = event.params.oldSigner;
  signerUpdate.newSigner = event.params.newSigner;
  signerUpdate.blockNumber = event.block.number;
  signerUpdate.timestamp = event.block.timestamp;
  signerUpdate.transactionHash = event.transaction.hash;
  signerUpdate.save();
}

export function handleMerkleRootUpdated(event: MerkleRootUpdated): void {
  const eventIdBase = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  let activeEpochId: string | null = null;
  const systemState = SystemState.load("SYSTEM");
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  } else {
    log.critical("handleMerkleRootUpdated: SystemState or activeEpochId not found. Cannot process event {}.", [eventIdBase]);
    return;
  }

  const epoch = Epoch.load(activeEpochId);
  if (epoch == null) {
    log.critical("handleMerkleRootUpdated: Active Epoch with id {} not found for event {}. Cannot process.", [activeEpochId, eventIdBase]);
    return; // Critical: Cannot proceed if epoch entity doesn't exist
  }

  // --- Load/Create Vault ---
  let vault = Vault.load(event.params.vaultAddress.toHexString());
  if (vault == null) {
    log.warning("handleMerkleRootUpdated: Vault {} not found. Creating minimal vault for event {}.", [
      event.params.vaultAddress.toHexString(),
      eventIdBase
    ]);
    vault = new Vault(event.params.vaultAddress.toHexString());
    vault.cTokenMarket = "UNKNOWN_CTOKEN_MARKET_ID_MERKLE";
    vault.totalShares = BigInt.fromI32(0);
    vault.totalDeposits = BigInt.fromI32(0);
    vault.totalCTokens = BigInt.fromI32(0);
    vault.globalDepositIndex = BigInt.fromI32(0);
    vault.totalPrincipalDeposited = BigInt.fromI32(0);
    vault.updatedAtBlock = event.block.number;
    vault.updatedAtTimestamp = event.block.timestamp.toI64();
    vault.save();
  }

  // --- Create MerkleDistribution Entity ---
  const merkleDistributionId = epoch.id + "-" + vault.id;
  let merkleDistribution = MerkleDistribution.load(merkleDistributionId);
  if (merkleDistribution == null) {
    merkleDistribution = new MerkleDistribution(merkleDistributionId);
    merkleDistribution.epoch = epoch.id;
    merkleDistribution.vault = vault.id;
  }

  merkleDistribution.merkleRoot = event.params.merkleRoot;
  merkleDistribution.blockNumber = event.block.number;
  merkleDistribution.timestamp = event.block.timestamp;
  merkleDistribution.transactionHash = event.transaction.hash;
  merkleDistribution.save();

  log.info("MerkleRootUpdated: Updated MerkleDistribution {} for epoch {} and vault {} with root {}", [
    merkleDistributionId,
    epoch.id,
    vault.id,
    event.params.merkleRoot.toHexString()
  ]);
}

export function handleSubsidyClaimed(event: SubsidyClaimed): void {
  const eventIdBase = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  let activeEpochId: string | null = null;
  const systemState = SystemState.load("SYSTEM");
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  } else {
    log.critical("handleSubsidyClaimed: SystemState or activeEpochId not found. Cannot process event {}.", [eventIdBase]);
    return;
  }

  const epoch = Epoch.load(activeEpochId);
  if (epoch == null) {
    log.critical("handleSubsidyClaimed: Active Epoch with id {} not found for event {}. Cannot process.", [activeEpochId, eventIdBase]);
    return; // Critical: Cannot proceed if epoch entity doesn't exist
  }

  // --- Load/Create Account ---
  let account = Account.load(event.params.recipient.toHexString());
  if (account == null) {
    account = new Account(event.params.recipient.toHexString());
    account.totalSecondsClaimed = BigInt.fromI32(0);
    account.save();
  }

  // --- Load Vault (must exist) ---
  const loadedVault = Vault.load(event.params.vaultAddress.toHexString());
  if (loadedVault == null) {
    log.critical("handleSubsidyClaimed: Vault {} not found for event {}. Cannot process.", [
        event.params.vaultAddress.toHexString(),
        eventIdBase
    ]);
    return;
  }
  
  const subsidyTxId = "CLAIMTX-" + eventIdBase;
  const subsidyTx = new SubsidyTransaction(subsidyTxId);
  subsidyTx.epoch = epoch.id;
  subsidyTx.user = account.id;
  subsidyTx.collection = event.params.collection.toHexString();
  subsidyTx.vault = loadedVault.id;
  subsidyTx.subsidyAmount = event.params.amount;
  subsidyTx.borrowAmountBefore = BigInt.fromI32(0);
  subsidyTx.borrowAmountAfter = BigInt.fromI32(0);
  subsidyTx.gasUsed = event.receipt != null ? event.receipt!.gasUsed : BigInt.fromI32(0);
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp;
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.save();

  // --- Update Epoch Statistics ---
  epoch.totalSubsidiesDistributed = epoch.totalSubsidiesDistributed.plus(event.params.amount);
  epoch.save();

  // --- Update Vault Allocation Statistics ---
  const vaultAllocationId = epoch.id + "-" + loadedVault.id;
  let vaultAllocation = EpochVaultAllocation.load(vaultAllocationId);
  if (vaultAllocation == null) {
    log.warning("handleSubsidyClaimed: EpochVaultAllocation {} not found for event {}. Creating new.", [
        vaultAllocationId,
        eventIdBase
    ]);
    vaultAllocation = new EpochVaultAllocation(vaultAllocationId);
    vaultAllocation.epoch = epoch.id;
    vaultAllocation.vault = loadedVault.id;
    vaultAllocation.yieldAllocated = BigInt.fromI32(0);
    vaultAllocation.subsidiesDistributed = BigInt.fromI32(0);
    vaultAllocation.remainingYield = BigInt.fromI32(0);
  }
  vaultAllocation.subsidiesDistributed = vaultAllocation.subsidiesDistributed.plus(event.params.amount);
  if (vaultAllocation.yieldAllocated.gt(BigInt.fromI32(0))) {
    vaultAllocation.remainingYield = vaultAllocation.yieldAllocated.minus(vaultAllocation.subsidiesDistributed);
  } else {
    vaultAllocation.remainingYield = vaultAllocation.remainingYield.minus(event.params.amount);
  }
  vaultAllocation.save();

  log.info("SubsidyClaimed: Created SubsidyTransaction {} for user {} in vault {} with amount {}. Epoch total subsidies: {}, VaultAllocation subsidies: {}", [
    subsidyTxId,
    event.params.recipient.toHexString(), // Changed from user to recipient
    event.params.vaultAddress.toHexString(), // Changed from vault to vaultAddress
    event.params.amount.toString(),
    epoch.totalSubsidiesDistributed.toString(),
    vaultAllocation.subsidiesDistributed.toString()
  ]);
}