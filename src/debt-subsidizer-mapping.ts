import {
  MerkleRootUpdated,
  SubsidyClaimed,
} from "../generated/DebtSubsidizer/DebtSubsidizer";
import {
  SubsidyDistribution,
  Epoch,
  SystemState,
  MerkleDistribution,
  EpochVaultAllocation,
} from "../generated/schema";
import { BigInt, log, Address } from "@graphprotocol/graph-ts";

import { getOrCreateVault, getOrCreateAccount } from "./utils/getters";
import { ADDRESS_ZERO_STR } from "./utils/const";

export function handleMerkleRootUpdated(event: MerkleRootUpdated): void {
  const eventIdBase =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  let activeEpochId: string | null = null;
  const systemState = SystemState.load("SYSTEM");
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  } else {
    log.critical(
      "handleMerkleRootUpdated: SystemState or activeEpochId not found. Cannot process event {}.",
      [eventIdBase]
    );
    return;
  }

  const epoch = Epoch.load(activeEpochId);
  if (epoch == null) {
    log.critical(
      "handleMerkleRootUpdated: Active Epoch with id {} not found for event {}. Cannot process.",
      [activeEpochId, eventIdBase]
    );
    return; // Critical: Cannot proceed if epoch entity doesn't exist
  }

  const vault = getOrCreateVault(
    event.params.vaultAddress,
    Address.fromString(ADDRESS_ZERO_STR)
  );

  // --- Create MerkleDistribution Entity ---
  const merkleDistributionId = epoch.id + "-" + vault.id;
  let merkleDistribution = MerkleDistribution.load(merkleDistributionId);
  if (merkleDistribution == null) {
    merkleDistribution = new MerkleDistribution(merkleDistributionId);
    merkleDistribution.epoch = epoch.id;
    merkleDistribution.vault = vault.id;
    merkleDistribution.totalAmount = BigInt.fromI32(0);
    merkleDistribution.totalClaims = BigInt.fromI32(0);
  }

  merkleDistribution.merkleRoot = event.params.merkleRoot;
  merkleDistribution.blockNumber = event.block.number;
  merkleDistribution.timestamp = event.block.timestamp;
  merkleDistribution.transactionHash = event.transaction.hash;
  merkleDistribution.save();

  log.info(
    "MerkleRootUpdated: Updated MerkleDistribution {} for epoch {} and vault {} with root {}",
    [
      merkleDistributionId,
      epoch.id,
      vault.id,
      event.params.merkleRoot.toHexString(),
    ]
  );
}

export function handleSubsidyClaimed(event: SubsidyClaimed): void {
  const eventIdBase =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  let activeEpochId: string | null = null;
  const systemState = SystemState.load("SYSTEM");
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  } else {
    log.critical(
      "handleSubsidyClaimed: SystemState or activeEpochId not found. Cannot process event {}.",
      [eventIdBase]
    );
    return;
  }

  const epoch = Epoch.load(activeEpochId);
  if (epoch == null) {
    log.critical(
      "handleSubsidyClaimed: Active Epoch with id {} not found for event {}. Cannot process.",
      [activeEpochId, eventIdBase]
    );
    return; // Critical: Cannot proceed if epoch entity doesn't exist
  }

  const account = getOrCreateAccount(event.params.recipient);

  const loadedVault = getOrCreateVault(
    event.params.vaultAddress,
    Address.fromString(ADDRESS_ZERO_STR)
  );

  const subsidyTxId = "CLAIMTX-" + eventIdBase;
  const subsidyTx = new SubsidyDistribution(subsidyTxId);
  subsidyTx.epoch = epoch.id;
  subsidyTx.user = account.id;
  subsidyTx.collection = "UNKNOWN_COLLECTION";
  subsidyTx.vault = loadedVault.id;
  subsidyTx.debtSubsidizer = ""; // Will be set when DebtSubsidizer entity is available
  subsidyTx.subsidyAmount = event.params.amount;
  subsidyTx.borrowAmountBefore = BigInt.fromI32(0);
  subsidyTx.borrowAmountAfter = BigInt.fromI32(0);
  subsidyTx.nftBalance = BigInt.fromI32(0);
  subsidyTx.weightedContribution = BigInt.fromI32(0);
  subsidyTx.gasUsed =
    event.receipt != null ? event.receipt!.gasUsed : BigInt.fromI32(0);
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp;
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.save();

  // --- Update Epoch Statistics ---
  epoch.totalSubsidiesDistributed = epoch.totalSubsidiesDistributed.plus(
    event.params.amount
  );
  epoch.save();

  // --- Update Vault Allocation Statistics ---
  const vaultAllocationId = epoch.id + "-" + loadedVault.id;
  let vaultAllocation = EpochVaultAllocation.load(vaultAllocationId);
  if (vaultAllocation == null) {
    log.warning(
      "handleSubsidyClaimed: EpochVaultAllocation {} not found for event {}. Creating new.",
      [vaultAllocationId, eventIdBase]
    );
    vaultAllocation = new EpochVaultAllocation(vaultAllocationId);
    vaultAllocation.epoch = epoch.id;
    vaultAllocation.vault = loadedVault.id;
    vaultAllocation.yieldAllocated = BigInt.fromI32(0);
    vaultAllocation.subsidiesDistributed = BigInt.fromI32(0);
    vaultAllocation.remainingYield = BigInt.fromI32(0);
    vaultAllocation.participantCount = BigInt.fromI32(0);
    vaultAllocation.averageSubsidyPerUser = BigInt.fromI32(0);
    vaultAllocation.utilizationRate = BigInt.fromI32(0);
    vaultAllocation.createdAtBlock = event.block.number;
    vaultAllocation.createdAtTimestamp = event.block.timestamp;
    vaultAllocation.updatedAtBlock = event.block.number;
    vaultAllocation.updatedAtTimestamp = event.block.timestamp;
  }
  vaultAllocation.subsidiesDistributed =
    vaultAllocation.subsidiesDistributed.plus(event.params.amount);
  if (vaultAllocation.yieldAllocated.gt(BigInt.fromI32(0))) {
    vaultAllocation.remainingYield = vaultAllocation.yieldAllocated.minus(
      vaultAllocation.subsidiesDistributed
    );
  } else {
    vaultAllocation.remainingYield = vaultAllocation.remainingYield.minus(
      event.params.amount
    );
  }
  vaultAllocation.save();

  log.info(
    "SubsidyClaimed: Created SubsidyDistribution {} for user {} in vault {} with amount {}. Epoch total subsidies: {}, VaultAllocation subsidies: {}",
    [
      subsidyTxId,
      event.params.recipient.toHexString(),
      event.params.vaultAddress.toHexString(),
      event.params.amount.toString(),
      epoch.totalSubsidiesDistributed.toString(),
      vaultAllocation.subsidiesDistributed.toString(),
    ]
  );

  // Export test data for E2E integration
  const testData = `{"user": "${event.params.recipient.toHexString()}", "vault": "${event.params.vaultAddress.toHexString()}", "amount": "${event.params.amount.toString()}", "epoch": "${epoch.id}"}`;
  log.info("E2E_TEST_DATA: SUBSIDY_CLAIM - {}", [testData]);
}
