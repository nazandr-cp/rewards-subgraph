import {
  EpochStarted,
  EpochFinalized,
  VaultYieldAllocated as EpochManagerVaultYieldAllocatedEvent,
} from "../generated/EpochManager/EpochManager"; // EpochManager import removed as it's not used directly
import { Epoch, Vault, EpochVaultAllocation } from "../generated/schema"; // Account import removed
import { EPOCH_STATUS_ACTIVE, EPOCH_STATUS_COMPLETED, ZERO_BI } from "./utils/const";
// BigInt, Bytes, store were removed as they are not directly used in this version of the file.
// If they are needed by future logic, they can be re-added.

/**
 * @notice Handles the EpochStarted event from the EpochManager contract.
 * @dev Creates a new Epoch entity when an epoch starts.
 * @param event The EpochStarted event.
 */
export function handleEpochStarted(event: EpochStarted): void {
  const epochId = event.params.epochId.toString();
  let epoch = Epoch.load(epochId); // Keep as let if it might be reassigned, though in this logic it's not.

  if (epoch == null) {
    epoch = new Epoch(epochId);
    epoch.startTimestamp = event.params.startTime;
    epoch.endTimestamp = event.params.endTime;
    epoch.totalYieldAvailable = ZERO_BI;
    epoch.totalSubsidiesDistributed = ZERO_BI;
    epoch.status = EPOCH_STATUS_ACTIVE;
    epoch.eligibleUsers = ZERO_BI; // This will be updated by off-chain logic or other event handlers
    // subsidyTransactions and vaultAllocations are derived fields
    epoch.save();
  }
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
    epoch.totalYieldAvailable = event.params.totalYieldAvailable; // This might be the final accumulated yield
    epoch.totalSubsidiesDistributed = event.params.totalSubsidiesDistributed;
    epoch.status = EPOCH_STATUS_COMPLETED;
    epoch.save();
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
    // This shouldn't happen if EpochStarted is processed first.
    // Consider creating a placeholder epoch or logging an error.
    return;
  }

  const vaultAddress = event.params.vault.toHexString();
  const vault = Vault.load(vaultAddress);
  if (vault == null) {
    // Vault should ideally exist, created by RewardsController's VaultAdded handler.
    // If not, this allocation cannot be properly associated.
    // For now, we'll proceed, but this indicates a potential data integrity issue or ordering dependency.
    // A robust system might create a placeholder Vault or log this.
    // Let's assume for now that the Vault entity will exist.
    // If it's critical, one might need to ensure Vault entities are created first.
    // For this example, we'll skip if vault is not found to prevent errors.
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