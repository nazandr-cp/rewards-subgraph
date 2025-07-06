import {
  EpochStarted,
  EpochFinalized,
  EpochFailed,
  VaultYieldAllocated as EpochManagerVaultYieldAllocatedEvent,
  AutomatedSystemUpdated,
} from "../generated/EpochManager/EpochManager";
import { Epoch, CollectionsVault, CollectionParticipation, EpochVaultAllocation } from "../generated/schema";
import { EPOCH_STATUS_ACTIVE, EPOCH_STATUS_COMPLETED, EPOCH_STATUS_FAILED, ZERO_BI } from "./utils/const";
import { log, BigInt } from "@graphprotocol/graph-ts";
import { getOrCreateSystemState, getOrCreateEpochVaultAllocation } from "./utils/getters";
import { calculateSubsidyRate, updateSubsidiesAccruedForParticipation } from "./utils/subsidies";

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

    // CRITICAL: Calculate subsidiesAccrued for all participants
    // This is the missing piece that converts accumulated seconds into claimable subsidies
    log.info("handleEpochFinalized: Starting subsidy calculation for epoch {} with totalYield={}", [
      epochId,
      event.params.totalYieldAvailable.toString()
    ]);

    calculateSubsidiesForEpoch(epoch, event.block.number, event.block.timestamp);

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
      "handleEpochManagerVaultYieldAllocated: Vault {} not found. Skipping yield allocation until vault is properly created via VaultAdded event.",
      [vaultAddress]
    );
    return;
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

  // IMMEDIATE SUBSIDY CALCULATION: Calculate subsidies as soon as yield is allocated
  // This ensures users can see their claimable subsidies without waiting for epoch finalization
  if (event.params.amount.gt(ZERO_BI)) {
    log.info("handleEpochManagerVaultYieldAllocated: Calculating immediate subsidies for vault {} with new yield allocation {}", [
      vaultAddress,
      event.params.amount.toString()
    ]);

    calculateSubsidiesForVaultAllocation(
      vault,
      epochVaultAllocation,
      event.params.amount,
      event.block.number,
      event.block.timestamp
    );
  }
}


export function handleAutomatedSystemUpdated(event: AutomatedSystemUpdated): void {
  log.info("Automated system updated to: {}", [event.params.newAutomatedSystem.toHexString()]);
}

/**
 * Calculate subsidiesAccrued for all participants when an epoch is finalized
 * This is the key function that converts accumulated seconds into claimable subsidies
 */
function calculateSubsidiesForEpoch(
  epoch: Epoch,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  log.info("calculateSubsidiesForEpoch: Starting comprehensive subsidy calculation for epoch {}", [
    epoch.id
  ]);

  if (epoch.totalYieldAvailable.equals(ZERO_BI)) {
    log.warning("calculateSubsidiesForEpoch: No yield available for epoch {}, skipping subsidy calculation", [
      epoch.id
    ]);
    return;
  }

  // Strategy: Calculate subsidies for each vault allocation in this epoch
  // Each vault allocation represents a portion of the total yield for that vault
  const epochAllocations = epoch.vaultAllocations.load();
  
  if (epochAllocations.length == 0) {
    log.warning("calculateSubsidiesForEpoch: No vault allocations found for epoch {}", [
      epoch.id
    ]);
    return;
  }

  let totalUpdatedParticipations = 0;
  let totalCalculatedSubsidies = ZERO_BI;

  log.info("calculateSubsidiesForEpoch: Processing {} vault allocations for epoch {}", [
    BigInt.fromI32(epochAllocations.length).toString(),
    epoch.id
  ]);

  for (let i = 0; i < epochAllocations.length; i++) {
    const allocation = epochAllocations[i];
    if (!allocation) continue;

    const vault = CollectionsVault.load(allocation.vault);
    if (!vault) {
      log.warning("calculateSubsidiesForEpoch: Vault {} not found for allocation", [allocation.vault]);
      continue;
    }

    log.info("calculateSubsidiesForEpoch: Processing vault {} with yieldAllocated={}", [
      vault.id,
      allocation.yieldAllocated.toString()
    ]);

    // Get all collection participations for this vault
    const participations = vault.collectionParticipations.load();
    
    if (participations.length == 0) {
      log.info("calculateSubsidiesForEpoch: No collection participations found for vault {}", [vault.id]);
      continue;
    }

    // Calculate total accumulated seconds across all participations in this vault
    let totalAccumulatedSeconds = ZERO_BI;
    const participationIds: string[] = [];
    
    for (let j = 0; j < participations.length; j++) {
      const participation = participations[j];
      if (participation) {
        participationIds.push(participation.id);
        totalAccumulatedSeconds = totalAccumulatedSeconds.plus(participation.secondsAccumulated);
      }
    }

    log.info("calculateSubsidiesForEpoch: Vault {} has {} participations with total seconds: {}", [
      vault.id,
      BigInt.fromI32(participations.length).toString(),
      totalAccumulatedSeconds.toString()
    ]);

    if (totalAccumulatedSeconds.gt(ZERO_BI) && allocation.yieldAllocated.gt(ZERO_BI)) {
      // Calculate subsidy rate for this vault allocation
      const subsidyRate = calculateSubsidyRate(allocation.yieldAllocated, totalAccumulatedSeconds);
      
      if (subsidyRate.gt(ZERO_BI)) {
        log.info("calculateSubsidiesForEpoch: Calculated subsidy rate {} for vault {}", [
          subsidyRate.toString(),
          vault.id
        ]);

        // Update subsidiesAccrued for all participations in this vault
        for (let k = 0; k < participationIds.length; k++) {
          const participationId = participationIds[k];
          updateSubsidiesAccruedForParticipation(
            participationId,
            subsidyRate,
            blockNumber,
            timestamp
          );
          totalUpdatedParticipations++;
        }
      }
    } else {
      log.info("calculateSubsidiesForEpoch: Skipping vault {} - no accumulated seconds or yield", [
        vault.id
      ]);
    }
  }

  log.info("calculateSubsidiesForEpoch: Completed for epoch {}. Updated {} participations with total subsidies calculated", [
    epoch.id,
    BigInt.fromI32(totalUpdatedParticipations).toString()
  ]);

  // Log comprehensive completion status
  log.info("SUBSIDY_CALCULATION_COMPLETE: epoch={}, vaultAllocations={}, participationsUpdated={}, status=completed", [
    epoch.id,
    BigInt.fromI32(epochAllocations.length).toString(),
    BigInt.fromI32(totalUpdatedParticipations).toString()
  ]);
}

/**
 * Calculate subsidies for a specific vault allocation immediately when yield is allocated
 * This provides real-time subsidy updates without waiting for epoch finalization
 */
function calculateSubsidiesForVaultAllocation(
  vault: CollectionsVault,
  allocation: EpochVaultAllocation,
  newYieldAmount: BigInt,
  blockNumber: BigInt,
  timestamp: BigInt
): void {
  log.info("calculateSubsidiesForVaultAllocation: Processing immediate subsidy calculation for vault {} with yield amount {}", [
    vault.id,
    newYieldAmount.toString()
  ]);

  // Get all collection participations for this vault
  const participations = vault.collectionParticipations.load();
  
  if (participations.length == 0) {
    log.info("calculateSubsidiesForVaultAllocation: No collection participations found for vault {}", [vault.id]);
    return;
  }

  // Calculate total accumulated seconds across all participations in this vault
  let totalAccumulatedSeconds = ZERO_BI;
  const participationIds: string[] = [];
  
  for (let i = 0; i < participations.length; i++) {
    const participation = participations[i];
    if (participation) {
      participationIds.push(participation.id);
      totalAccumulatedSeconds = totalAccumulatedSeconds.plus(participation.secondsAccumulated);
    }
  }

  log.info("calculateSubsidiesForVaultAllocation: Vault {} has {} participations with total seconds: {}", [
    vault.id,
    BigInt.fromI32(participations.length).toString(),
    totalAccumulatedSeconds.toString()
  ]);

  if (totalAccumulatedSeconds.gt(ZERO_BI) && newYieldAmount.gt(ZERO_BI)) {
    // Calculate subsidy rate for this new yield allocation
    const subsidyRate = calculateSubsidyRate(newYieldAmount, totalAccumulatedSeconds);
    
    if (subsidyRate.gt(ZERO_BI)) {
      log.info("calculateSubsidiesForVaultAllocation: Calculated immediate subsidy rate {} for vault {} with yield {}", [
        subsidyRate.toString(),
        vault.id,
        newYieldAmount.toString()
      ]);

      // Update subsidiesAccrued for all participations in this vault
      let updatedParticipations = 0;
      for (let j = 0; j < participationIds.length; j++) {
        const participationId = participationIds[j];
        updateSubsidiesAccruedForParticipation(
          participationId,
          subsidyRate,
          blockNumber,
          timestamp
        );
        updatedParticipations++;
      }

      log.info("calculateSubsidiesForVaultAllocation: Completed immediate calculation for vault {}. Updated {} participations", [
        vault.id,
        BigInt.fromI32(updatedParticipations).toString()
      ]);
    }
  } else {
    log.info("calculateSubsidiesForVaultAllocation: Skipping vault {} - no accumulated seconds ({}) or yield ({})", [
      vault.id,
      totalAccumulatedSeconds.toString(),
      newYieldAmount.toString()
    ]);
  }
}

