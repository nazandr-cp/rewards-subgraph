import {
  MerkleRootUpdated,
  SubsidyClaimed,
} from "../generated/DebtSubsidizer/DebtSubsidizer";
import {
  SubsidyDistribution,
  Epoch,
} from "../generated/schema";
import { BigInt, log, Address } from "@graphprotocol/graph-ts";

import { getOrCreateVault, getOrCreateAccount, getOrCreateSystemState, getOrCreateEpochVaultAllocation, getOrCreateMerkleDistribution } from "./utils/getters";
import { ADDRESS_ZERO_STR } from "./utils/const";

export function handleMerkleRootUpdated(event: MerkleRootUpdated): void {
  const eventIdBase =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  const systemState = getOrCreateSystemState();
  const activeEpochId: string | null = systemState.activeEpochId;
  if (activeEpochId == null) {
    log.critical(
      "handleMerkleRootUpdated: No active epoch found. Cannot process event {}.",
      [eventIdBase]
    );
    return;
  }

  const epoch = Epoch.load(activeEpochId as string);
  if (epoch == null) {
    log.critical(
      "handleMerkleRootUpdated: Active Epoch with id {} not found for event {}. Cannot process.",
      [activeEpochId as string, eventIdBase]
    );
    return; // Critical: Cannot proceed if epoch entity doesn't exist
  }

  const vault = getOrCreateVault(
    event.params.vaultAddress,
    Address.fromString(ADDRESS_ZERO_STR)
  );

  // --- Create MerkleDistribution Entity ---
  const merkleDistributionId = epoch.id + "-" + vault.id;
  const merkleDistribution = getOrCreateMerkleDistribution(merkleDistributionId, epoch.id, vault.id);

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

  const systemState = getOrCreateSystemState();
  const activeEpochId: string | null = systemState.activeEpochId;
  if (activeEpochId == null) {
    log.critical(
      "handleSubsidyClaimed: No active epoch found. Cannot process event {}.",
      [eventIdBase]
    );
    return;
  }

  const epoch = Epoch.load(activeEpochId as string);
  if (epoch == null) {
    log.critical(
      "handleSubsidyClaimed: Active Epoch with id {} not found for event {}. Cannot process.",
      [activeEpochId as string, eventIdBase]
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
  const vaultAllocation = getOrCreateEpochVaultAllocation(epoch.id, loadedVault.id);

  vaultAllocation.subsidiesDistributed = vaultAllocation.subsidiesDistributed.plus(event.params.amount);
  if (vaultAllocation.yieldAllocated.gt(BigInt.fromI32(0))) {
    vaultAllocation.remainingYield = vaultAllocation.yieldAllocated.minus(vaultAllocation.subsidiesDistributed);
  } else {
    vaultAllocation.remainingYield = vaultAllocation.remainingYield.minus(event.params.amount);
  }
  vaultAllocation.updatedAtBlock = event.block.number;
  vaultAllocation.updatedAtTimestamp = event.block.timestamp;
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
