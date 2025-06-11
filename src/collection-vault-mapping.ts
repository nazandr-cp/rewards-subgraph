import {
  CollectionDeposit as CollectionDepositEvent,
  CollectionWithdraw as CollectionWithdrawEvent,
  VaultYieldAllocatedToEpoch as VaultYieldAllocatedToEpochEvent, // Added new event
} from "../generated/templates/CollectionVault/CollectionVault";
import { log, Address } from "@graphprotocol/graph-ts";
import { Vault, Epoch, EpochVaultAllocation } from "../generated/schema"; // Added Epoch, EpochVaultAllocation

import { getOrCreateVault, getOrCreateCollectionVault } from "./utils/getters";
import { ZERO_BI } from "./utils/const"; // Added ZERO_BI

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;
  const totalCTokens = event.params.cTokenAmount;

  // Load the Vault to get its cTokenMarket address
  const vaultEntity = Vault.load(vaultAddress.toHex());
  if (!vaultEntity) {
    log.error("handleCollectionDeposit: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketForVault = Address.fromString(vaultEntity.cTokenMarket);

  const vault = getOrCreateVault(vaultAddress, cTokenMarketForVault);
  vault.totalShares = vault.totalShares.plus(shares);
  vault.totalDeposits = vault.totalDeposits.plus(assets);
  vault.totalCTokens = vault.totalCTokens.plus(totalCTokens);
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
  ]);

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketForVault
  );

  collVault.principalShares = collVault.principalShares.plus(shares);
  collVault.principalDeposited = collVault.principalDeposited.plus(assets);
  collVault.cTokenAmount = collVault.cTokenAmount.plus(totalCTokens);
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();

  log.info(
    "CollectionDeposit: collectionVaultId {}, caller {}, receiver {}, assets {}, shares {}, new principalDeposited {}",
    [
      collVault.id,
      event.params.caller.toHexString(),
      event.params.receiver.toHexString(),
      assets.toString(),
      shares.toString(),
      collVault.principalDeposited.toString(),
    ]
  );
}

export function handleCollectionWithdraw(event: CollectionWithdrawEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;
  const totalCTokens = event.params.cTokenAmount;

  // Load the Vault to get its cTokenMarket address
  const vaultEntityWithdraw = Vault.load(vaultAddress.toHex());
  if (!vaultEntityWithdraw) {
    log.error("handleCollectionWithdraw: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketForVaultWithdraw = Address.fromString(
    vaultEntityWithdraw.cTokenMarket
  );

  const vault = getOrCreateVault(vaultAddress, cTokenMarketForVaultWithdraw);
  vault.totalShares = vault.totalShares.minus(shares);
  vault.totalDeposits = vault.totalDeposits.minus(assets);
  vault.totalCTokens = vault.totalCTokens.minus(totalCTokens);
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp.toI64();
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
  ]);

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketForVaultWithdraw
  );
  collVault.principalShares = collVault.principalShares.minus(shares);
  collVault.principalDeposited = collVault.principalDeposited.minus(assets);
  collVault.cTokenAmount = collVault.cTokenAmount.minus(totalCTokens);
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp.toI64();
  collVault.save();
  log.info(
    "CollectionWithdraw: collectionVaultId {}, caller {}, receiver {}, assets {}, shares {}, new principalDeposited {}",
    [
      collVault.id,
      event.params.caller.toHexString(),
      event.params.receiver.toHexString(),
      assets.toString(),
      shares.toString(),
      collVault.principalDeposited.toString(),
    ]
  );
}

/**
 * @notice Handles the VaultYieldAllocatedToEpoch event from the CollectionsVault contract.
 * @dev Creates or updates an EpochVaultAllocation entity when a vault allocates its yield to an epoch.
 *      This event is emitted by CollectionsVault itself, distinct from EpochManager's VaultYieldAllocated.
 *      This handler assumes Epoch entities are created by EpochManager's EpochStarted event.
 * @param event The VaultYieldAllocatedToEpoch event.
 */
export function handleVaultYieldAllocatedToEpoch(event: VaultYieldAllocatedToEpochEvent): void {
  const epochId = event.params.epochId.toString();
  const vaultAddress = event.address.toHexString(); // event.address is the CollectionsVault address
  const amountAllocated = event.params.amount;

  const epoch = Epoch.load(epochId);
  if (epoch == null) {
    log.warning(
      "handleVaultYieldAllocatedToEpoch: Epoch {} not found for vault {}. Allocation of {} might be orphaned.",
      [epochId, vaultAddress, amountAllocated.toString()]
    );
    // Depending on strictness, could return or create a placeholder Epoch.
    // For now, we'll proceed, assuming EpochStarted will eventually create it.
    // If an Epoch entity is strictly required, this handler should ensure it exists or log an error and return.
    return; // Or handle error more gracefully
  }

  const vault = Vault.load(vaultAddress);
  if (vault == null) {
    log.warning(
      "handleVaultYieldAllocatedToEpoch: Vault {} not found for epoch {}. Allocation of {} might be orphaned.",
      [vaultAddress, epochId, amountAllocated.toString()]
    );
    // Similar to Epoch, Vault should exist.
    return; // Or handle error
  }

  // Create or update EpochVaultAllocation
  // The ID for EpochVaultAllocation is epoch.id + "-" + vault.id
  const allocationId = epochId + "-" + vaultAddress;
  let epochVaultAllocation = EpochVaultAllocation.load(allocationId);

  if (epochVaultAllocation == null) {
    epochVaultAllocation = new EpochVaultAllocation(allocationId);
    epochVaultAllocation.epoch = epochId;
    epochVaultAllocation.vault = vaultAddress;
    epochVaultAllocation.yieldAllocated = ZERO_BI;
    epochVaultAllocation.subsidiesDistributed = ZERO_BI; // Initialized to zero
  }

  epochVaultAllocation.yieldAllocated = epochVaultAllocation.yieldAllocated.plus(amountAllocated);
  // remainingYield is yieldAllocated - subsidiesDistributed.
  // It will be updated when subsidies are processed and `subsidiesDistributed` is updated.
  epochVaultAllocation.remainingYield = epochVaultAllocation.yieldAllocated.minus(
    epochVaultAllocation.subsidiesDistributed
  );
  epochVaultAllocation.save();

  log.info(
    "VaultYieldAllocatedToEpoch: Vault {} allocated {} to Epoch {}. New total allocation for this pair: {}",
    [
      vaultAddress,
      amountAllocated.toString(),
      epochId,
      epochVaultAllocation.yieldAllocated.toString(),
    ]
  );

  // Also, update the Epoch's totalYieldAvailable if this event is the source of truth for it
  // or if EpochManager.VaultYieldAllocated is not guaranteed to cover this.
  // The current EpochManager.VaultYieldAllocated handler already updates epoch.totalYieldAvailable.
  // If this event from CollectionsVault is *in addition* or *instead of* the EpochManager one for this purpose,
  // then update epoch.totalYieldAvailable here too.
  // Based on the plan, EpochManager.VaultYieldAllocated seems to be the primary one for epoch.totalYieldAvailable.
  // This event (VaultYieldAllocatedToEpoch from CollectionsVault) primarily confirms the vault's own accounting.
  // So, we primarily focus on EpochVaultAllocation here.
}
