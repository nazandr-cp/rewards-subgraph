import {
  EpochStarted,
  EpochFinalized,
  VaultYieldAllocated as EpochManagerVaultYieldAllocatedEvent,
  EpochDurationUpdated,
  AutomatedSystemUpdated,
} from "../generated/EpochManager/EpochManager";
import { Epoch, Vault, EpochVaultAllocation, SystemState } from "../generated/schema";
import { EPOCH_STATUS_ACTIVE, EPOCH_STATUS_COMPLETED, ZERO_BI, SYSTEM_STATE_ID } from "./utils/const";
import { log } from "@graphprotocol/graph-ts";

/**
 * @notice Handles the EpochStarted event from the EpochManager contract.
 * @dev Creates a new Epoch entity when an epoch starts.
 * @param event The EpochStarted event.
 */
export function handleEpochStarted(event: EpochStarted): void {
  const epochId = event.params.epochId.toString();
  let epoch = Epoch.load(epochId);

  if (epoch == null) {
    epoch = new Epoch(epochId);
    epoch.startTimestamp = event.params.startTime;
    epoch.endTimestamp = event.params.endTime;
    epoch.totalYieldAvailable = ZERO_BI;
    epoch.totalSubsidiesDistributed = ZERO_BI;
    epoch.status = EPOCH_STATUS_ACTIVE;
    epoch.eligibleUsers = ZERO_BI;
    epoch.save();
  } else {
    // If epoch already exists, ensure its status is active and timestamps are updated if necessary.
    // This might indicate a re-start or an out-of-order event.
    log.info("handleEpochStarted: Epoch {} already exists. Ensuring it is active and timestamps are current.", [epochId]);
    epoch.status = EPOCH_STATUS_ACTIVE; // Ensure it's marked active
    epoch.startTimestamp = event.params.startTime; // Update timestamps
    epoch.endTimestamp = event.params.endTime;
    epoch.save();
  }

  // Update SystemState with active epoch
  // This must happen regardless of whether the epoch was new or existing.
  let systemState = SystemState.load(SYSTEM_STATE_ID);
  if (systemState === null) {
    systemState = new SystemState(SYSTEM_STATE_ID);
  }
  systemState.activeEpochId = epochId;
  systemState.save();
}

/**
 * @notice Handles the EpochFinalized event from the EpochManager contract.
 * @dev Updates an existing Epoch entity when an epoch is finalized.
 * @param event The EpochFinalized event.
 */
export function handleEpochFinalized(event: EpochFinalized): void {
  const epochId = event.params.epochId.toString();
  const epoch = Epoch.load(epochId);

  if (epoch != null) {
    epoch.totalYieldAvailable = event.params.totalYieldAvailable;
    epoch.totalSubsidiesDistributed = event.params.totalSubsidiesDistributed;
    epoch.status = EPOCH_STATUS_COMPLETED;
    epoch.save();

    // Update SystemState to remove active epoch, only if this was the active one
    const systemState = SystemState.load(SYSTEM_STATE_ID);
    if (systemState != null) {
      if (systemState.activeEpochId == epochId) { // Only clear if it's the one being finalized
        systemState.activeEpochId = null;
        systemState.save();
      }
    } else {
      log.warning("handleEpochFinalized: SystemState entity not found. Cannot clear activeEpochId for epoch {}.", [epochId]);
    }
  }
  // If epoch is null, it means EpochStarted was missed or this event is out of order.
  // Depending on system design, might need error logging or specific handling.
}

/**
 * @notice Handles the VaultYieldAllocated event from the EpochManager contract.
 * @dev Creates or updates an EpochVaultAllocation entity and updates the Epoch's totalYieldAvailable.
 * @param event The VaultYieldAllocated event from EpochManager.
 */
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

  const vaultAddress = event.params.vault.toHexString();
  const vault = Vault.load(vaultAddress);
  if (vault == null) {
    log.error(
      "handleEpochManagerVaultYieldAllocated: Vault {} not found. Cannot process yield allocation for epoch {}.",
      [vaultAddress, epochId]
    );
    return;
  }

  // Update total yield available in the epoch
  epoch.totalYieldAvailable = epoch.totalYieldAvailable.plus(event.params.amount);
  epoch.save();

  // Create or update EpochVaultAllocation
  const allocationId = epochId + "-" + vaultAddress;
  let epochVaultAllocation = EpochVaultAllocation.load(allocationId);

  if (epochVaultAllocation == null) {
    epochVaultAllocation = new EpochVaultAllocation(allocationId);
    epochVaultAllocation.epoch = epochId;
    epochVaultAllocation.vault = vaultAddress;
    epochVaultAllocation.yieldAllocated = ZERO_BI;
    epochVaultAllocation.subsidiesDistributed = ZERO_BI; // Initialized to zero
  }

  epochVaultAllocation.yieldAllocated = epochVaultAllocation.yieldAllocated.plus(event.params.amount);
  // remainingYield can be calculated as yieldAllocated - subsidiesDistributed
  // This will be updated when subsidies are distributed.
  epochVaultAllocation.remainingYield = epochVaultAllocation.yieldAllocated.minus(epochVaultAllocation.subsidiesDistributed);
  epochVaultAllocation.save();
}

export function handleEpochDurationUpdated(event: EpochDurationUpdated): void {
  log.info("Epoch duration updated to: {}", [event.params.newDuration.toString()]);
}

export function handleAutomatedSystemUpdated(event: AutomatedSystemUpdated): void {
  log.info("Automated system updated to: {}", [event.params.newAutomatedSystem.toHexString()]);
}