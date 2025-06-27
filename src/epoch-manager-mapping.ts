import {
  EpochStarted,
  EpochFinalized,
  EpochProcessingStarted,
  EpochFailed,
  VaultYieldAllocated as EpochManagerVaultYieldAllocatedEvent,
  EpochDurationUpdated,
  AutomatedSystemUpdated,
} from "../generated/EpochManager/EpochManager";
import { Epoch, CollectionsVault, EpochVaultAllocation, SystemState } from "../generated/schema";
import { EPOCH_STATUS_ACTIVE, EPOCH_STATUS_PROCESSING, EPOCH_STATUS_COMPLETED, ZERO_BI, SYSTEM_STATE_ID } from "./utils/const";
import { log } from "@graphprotocol/graph-ts";

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
    epoch.participantCount = ZERO_BI;
    epoch.epochManager = event.address.toHexString();
    epoch.save();
  } else {
    log.info("handleEpochStarted: Epoch {} already exists. Ensuring it is active and timestamps are current.", [epochId]);
    epoch.status = EPOCH_STATUS_ACTIVE;
    epoch.startTimestamp = event.params.startTime;
    epoch.endTimestamp = event.params.endTime;
    epoch.epochManager = event.address.toHexString();
    epoch.save();
  }

  let systemState = SystemState.load(SYSTEM_STATE_ID);
  if (systemState === null) {
    systemState = new SystemState(SYSTEM_STATE_ID);
    systemState.totalVaults = ZERO_BI;
    systemState.totalCollections = ZERO_BI;
    systemState.totalUsers = ZERO_BI;
    systemState.totalValueLocked = ZERO_BI;
    systemState.totalYieldDistributed = ZERO_BI;
    systemState.totalSubsidiesDistributed = ZERO_BI;
    systemState.systemUtilizationRate = ZERO_BI;
    systemState.averageAPY = ZERO_BI;
    systemState.lastUpdatedBlock = event.block.number;
    systemState.lastUpdatedTimestamp = event.block.timestamp;
  }
  systemState.activeEpochId = epochId;
  systemState.save();

  // Export test data for E2E integration
  const testData = `{"epochId": "${epochId}", "eventType": "STARTED", "startTime": "${event.params.startTime.toString()}", "endTime": "${event.params.endTime.toString()}"}`;
  log.info("E2E_TEST_DATA: EPOCH - {}", [testData]);
}

export function handleEpochProcessingStarted(event: EpochProcessingStarted): void {
  const epochId = event.params.epochId.toString();
  let epoch = Epoch.load(epochId);

  if (epoch == null) {
    log.warning(
      "handleEpochProcessingStarted: Epoch {} not found. Creating stub.",
      [epochId]
    );
    epoch = new Epoch(epochId);
    epoch.epochNumber = event.params.epochId;
    epoch.startTimestamp = ZERO_BI;
    epoch.endTimestamp = ZERO_BI;
    epoch.totalYieldAvailable = ZERO_BI;
    epoch.totalYieldAllocated = ZERO_BI;
    epoch.totalYieldDistributed = ZERO_BI;
    epoch.remainingYield = ZERO_BI;
    epoch.totalSubsidiesDistributed = ZERO_BI;
    epoch.totalEligibleUsers = ZERO_BI;
    epoch.totalParticipatingCollections = ZERO_BI;
    epoch.createdAtBlock = event.block.number;
    epoch.createdAtTimestamp = event.block.timestamp;
    epoch.updatedAtBlock = event.block.number;
    epoch.updatedAtTimestamp = event.block.timestamp;
    epoch.participantCount = ZERO_BI;
    epoch.epochManager = event.address.toHexString();
  }

  epoch.status = EPOCH_STATUS_PROCESSING;
  epoch.processingStartedTimestamp = event.block.timestamp;
  epoch.save();
}

export function handleEpochFinalized(event: EpochFinalized): void {
  const epochId = event.params.epochId.toString();
  const epoch = Epoch.load(epochId);

  if (epoch != null) {
    epoch.totalYieldAvailable = event.params.totalYieldAvailable;
    epoch.totalSubsidiesDistributed = event.params.totalSubsidiesDistributed;
    epoch.status = EPOCH_STATUS_COMPLETED;
    if (!epoch.epochManager) {
      epoch.epochManager = event.address.toHexString();
    }
    epoch.save();

    const systemState = SystemState.load(SYSTEM_STATE_ID);
    if (systemState != null) {
      if (systemState.activeEpochId == epochId) {
        systemState.activeEpochId = null;
        systemState.save();
      }
    } else {
      log.warning("handleEpochFinalized: SystemState entity not found. Cannot clear activeEpochId for epoch {}.", [epochId]);
    }

    // Export test data for E2E integration
    const testData = `{"epochId": "${epochId}", "eventType": "FINALIZED", "totalYieldAvailable": "${event.params.totalYieldAvailable.toString()}", "totalSubsidiesDistributed": "${event.params.totalSubsidiesDistributed.toString()}"}`;
    log.info("E2E_TEST_DATA: EPOCH - {}", [testData]);
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

  epoch.status = "FAILED";
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

  epoch.totalYieldAvailable = epoch.totalYieldAvailable.plus(event.params.amount);
  epoch.save();

  const allocationId = epochId + "-" + vaultAddress;
  let epochVaultAllocation = EpochVaultAllocation.load(allocationId);

  if (epochVaultAllocation == null) {
    epochVaultAllocation = new EpochVaultAllocation(allocationId);
    epochVaultAllocation.epoch = epochId;
    epochVaultAllocation.vault = vaultAddress;
    epochVaultAllocation.yieldAllocated = ZERO_BI;
    epochVaultAllocation.subsidiesDistributed = ZERO_BI;
    epochVaultAllocation.remainingYield = ZERO_BI;
    epochVaultAllocation.participantCount = ZERO_BI;
    epochVaultAllocation.averageSubsidyPerUser = ZERO_BI;
    epochVaultAllocation.utilizationRate = ZERO_BI;
    epochVaultAllocation.createdAtBlock = event.block.number;
    epochVaultAllocation.createdAtTimestamp = event.block.timestamp;
    epochVaultAllocation.updatedAtBlock = event.block.number;
    epochVaultAllocation.updatedAtTimestamp = event.block.timestamp;
  }

  epochVaultAllocation.yieldAllocated = epochVaultAllocation.yieldAllocated.plus(event.params.amount);
  epochVaultAllocation.remainingYield = epochVaultAllocation.yieldAllocated.minus(epochVaultAllocation.subsidiesDistributed);
  epochVaultAllocation.save();
}

export function handleEpochDurationUpdated(event: EpochDurationUpdated): void {
  log.info("Epoch duration updated to: {}", [event.params.newDuration.toString()]);
}

export function handleAutomatedSystemUpdated(event: AutomatedSystemUpdated): void {
  log.info("Automated system updated to: {}", [event.params.newAutomatedSystem.toHexString()]);
}

