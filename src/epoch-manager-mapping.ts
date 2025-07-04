import {
  EpochStarted,
  EpochFinalized,
  EpochFailed,
  VaultYieldAllocated as EpochManagerVaultYieldAllocatedEvent,
  AutomatedSystemUpdated,
} from "../generated/EpochManager/EpochManager";
import { Epoch, CollectionsVault } from "../generated/schema";
import { EPOCH_STATUS_ACTIVE, EPOCH_STATUS_COMPLETED, EPOCH_STATUS_FAILED, ZERO_BI } from "./utils/const";
import { log } from "@graphprotocol/graph-ts";
import { getOrCreateSystemState, getOrCreateEpochVaultAllocation } from "./utils/getters";

export function handleEpochStarted(event: EpochStarted): void {
  const epochId = event.params.epochId.toString();
  let epoch = Epoch.load(epochId);

  if (epoch == null) {
    epoch = new Epoch(epochId);
    epoch.epochNumber = event.params.epochId;
    epoch.startTimestamp = event.params.startTime;
    epoch.endTimestamp = event.params.endTime;
    epoch.totalYieldAvailable = ZERO_BI;
    epoch.totalYieldAllocated = ZERO_BI;
    epoch.totalYieldDistributed = ZERO_BI;
    epoch.remainingYield = ZERO_BI;
    epoch.totalSubsidiesDistributed = ZERO_BI;
    epoch.totalEligibleUsers = ZERO_BI;
    epoch.totalParticipatingCollections = ZERO_BI;
    epoch.status = EPOCH_STATUS_ACTIVE;
    epoch.createdAtBlock = event.block.number;
    epoch.createdAtTimestamp = event.block.timestamp;
    epoch.updatedAtBlock = event.block.number;
    epoch.updatedAtTimestamp = event.block.timestamp;
    epoch.epochManager = event.address.toHexString();
    epoch.save();

    log.info("handleEpochStarted: Created new epoch {} with startTime={}, endTime={}", [
      epochId,
      event.params.startTime.toString(),
      event.params.endTime.toString()
    ]);
  } else {
    log.info("handleEpochStarted: Epoch {} already exists. Ensuring it is active and timestamps are current.", [epochId]);
    epoch.status = EPOCH_STATUS_ACTIVE;
    epoch.startTimestamp = event.params.startTime;
    epoch.endTimestamp = event.params.endTime;
    epoch.updatedAtBlock = event.block.number;
    epoch.updatedAtTimestamp = event.block.timestamp;
    epoch.epochManager = event.address.toHexString();
    epoch.save();
  }

  // Update system state with new active epoch
  const systemState = getOrCreateSystemState();
  systemState.activeEpochId = event.params.epochId;
  systemState.lastUpdatedBlock = event.block.number;
  systemState.lastUpdatedTimestamp = event.block.timestamp;
  systemState.save();

  log.info("handleEpochStarted: System state updated - activeEpochId set to {}", [epochId]);

  const testData = `{"epochId": "${epochId}", "eventType": "STARTED", "startTime": "${event.params.startTime.toString()}", "endTime": "${event.params.endTime.toString()}"}`;
  log.info("E2E_TEST_DATA: EPOCH - {}", [testData]);
}


export function handleEpochFinalized(event: EpochFinalized): void {
  const epochId = event.params.epochId.toString();
  const epoch = Epoch.load(epochId);

  if (epoch != null) {
    epoch.totalYieldAvailable = event.params.totalYieldAvailable;
    epoch.totalSubsidiesDistributed = event.params.totalSubsidiesDistributed;
    epoch.status = EPOCH_STATUS_COMPLETED;
    epoch.updatedAtBlock = event.block.number;
    epoch.updatedAtTimestamp = event.block.timestamp;
    epoch.processingCompletedTimestamp = event.block.timestamp;
    if (!epoch.epochManager) {
      epoch.epochManager = event.address.toHexString();
    }
    epoch.save();

    // Update system state - keep the active epoch ID until a new epoch is started
    // This prevents merkle distributions from being rejected due to missing active epoch
    const systemState = getOrCreateSystemState();
    systemState.lastUpdatedBlock = event.block.number;
    systemState.lastUpdatedTimestamp = event.block.timestamp;
    systemState.save();

    log.info("handleEpochFinalized: Epoch {} finalized with totalYieldAvailable={}, totalSubsidiesDistributed={}", [
      epochId,
      event.params.totalYieldAvailable.toString(),
      event.params.totalSubsidiesDistributed.toString()
    ]);

    const testData = `{"epochId": "${epochId}", "eventType": "FINALIZED", "totalYieldAvailable": "${event.params.totalYieldAvailable.toString()}", "totalSubsidiesDistributed": "${event.params.totalSubsidiesDistributed.toString()}"}`;
    log.info("E2E_TEST_DATA: EPOCH - {}", [testData]);
  } else {
    log.error("handleEpochFinalized: Epoch {} not found. Cannot finalize.", [epochId]);
  }
}

export function handleEpochFailed(event: EpochFailed): void {
  const epochId = event.params.epochId.toString();
  const epoch = Epoch.load(epochId);

  if (epoch == null) {
    log.warning(
      "handleEpochFailed: Epoch {} not found. Cannot mark as failed.",
      [epochId]
    );
    return;
  }

  epoch.status = EPOCH_STATUS_FAILED;
  epoch.endTimestamp = event.block.timestamp;
  epoch.save();

  log.info("handleEpochFailed: Epoch {} has been marked as FAILED at timestamp {}.", [
    epochId,
    event.block.timestamp.toString(),
  ]);
}

export function handleEpochManagerVaultYieldAllocated(event: EpochManagerVaultYieldAllocatedEvent): void {
  const epochId = event.params.epochId.toString();
  const epoch = Epoch.load(epochId);

  if (epoch == null) {
    log.error(
      "handleEpochManagerVaultYieldAllocated: Epoch {} not found. Cannot process yield allocation for vault {}.",
      [epochId, event.params.vault.toHexString()]
    );
    return;
  }
  if (!epoch.epochManager) {
    epoch.epochManager = event.address.toHexString();
  }

  const vaultAddress = event.params.vault.toHexString();
  let vault = CollectionsVault.load(vaultAddress);
  if (vault == null) {
    log.warning(
      "handleEpochManagerVaultYieldAllocated: Vault {} not found. Creating stub.",
      [vaultAddress]
    );
    vault = new CollectionsVault(vaultAddress);
    vault.cTokenMarket = "";
    vault.totalShares = ZERO_BI;
    vault.totalDeposits = ZERO_BI;
    vault.totalCTokens = ZERO_BI;
    vault.globalDepositIndex = ZERO_BI;
    vault.totalPrincipalDeposited = ZERO_BI;
    vault.collectionRegistry = "";
    vault.epochManager = "";
    vault.lendingManager = "";
    vault.debtSubsidizer = "";
    vault.createdAtBlock = event.block.number;
    vault.createdAtTimestamp = event.block.timestamp;
    vault.updatedAtBlock = event.block.number;
    vault.updatedAtTimestamp = event.block.timestamp;
    vault.save();
  }

  if (event.params.amount.gt(ZERO_BI)) {
    epoch.totalYieldAvailable = epoch.totalYieldAvailable.plus(event.params.amount);
    epoch.remainingYield = epoch.totalYieldAvailable.minus(epoch.totalYieldDistributed);
    if (epoch.remainingYield.lt(ZERO_BI)) {
      epoch.remainingYield = ZERO_BI;
    }
  }
  epoch.save();

  const epochVaultAllocation = getOrCreateEpochVaultAllocation(epochId, vaultAddress);

  epochVaultAllocation.yieldAllocated = epochVaultAllocation.yieldAllocated.plus(event.params.amount);
  const newRemainingYield = epochVaultAllocation.yieldAllocated.minus(epochVaultAllocation.subsidiesDistributed);
  epochVaultAllocation.remainingYield = newRemainingYield.lt(ZERO_BI) ? ZERO_BI : newRemainingYield;
  epochVaultAllocation.updatedAtBlock = event.block.number;
  epochVaultAllocation.updatedAtTimestamp = event.block.timestamp;
  epochVaultAllocation.save();
}


export function handleAutomatedSystemUpdated(event: AutomatedSystemUpdated): void {
  log.info("Automated system updated to: {}", [event.params.newAutomatedSystem.toHexString()]);
}

