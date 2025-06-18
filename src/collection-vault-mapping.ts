import {
  CollectionDeposit as CollectionDepositEvent,
  CollectionWithdraw as CollectionWithdrawEvent,
  VaultYieldAllocatedToEpoch as VaultYieldAllocatedToEpochEvent,
  CollectionYieldAppliedForEpoch as CollectionYieldAppliedForEpochEvent,
} from "../generated/templates/CollectionVault/CollectionVault";
import { log, Address, ethereum } from "@graphprotocol/graph-ts"; // Removed BigInt from here
import { CollectionsVault, Epoch, EpochVaultAllocation, CollectionYieldApplication, CollectionYieldAccrual, SubsidyDistribution, CTokenMarket } from "../generated/schema";

import { getOrCreateCollectionVault } from "./utils/getters";
import { ZERO_BI, BIGINT_1E18 } from "./utils/const";

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;
  // const totalCTokensFromEvent = event.params.cTokenAmount; // This is shares, not actual cTokens

  const vaultEntity = CollectionsVault.load(vaultAddress.toHex());
  if (!vaultEntity) {
    log.error("handleCollectionDeposit: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketAddress = Address.fromString(vaultEntity.cTokenMarket);
  const cTokenMarket = CTokenMarket.load(cTokenMarketAddress.toHexString());

  let actualCTokens = ZERO_BI;
  if (cTokenMarket != null && cTokenMarket.exchangeRate != ZERO_BI) {
    actualCTokens = assets.times(BIGINT_1E18).div(cTokenMarket.exchangeRate);
  } else {
    log.warning("handleCollectionDeposit: CTokenMarket {} not found or exchangeRate is zero for vault {}. cTokenAmount will be based on shares (event.params.cTokenAmount).", [
      cTokenMarketAddress.toHexString(),
      vaultAddress.toHex()
    ]);
    actualCTokens = event.params.cTokenAmount; // Fallback to event shares if exchange rate unavailable
  }

  const vault = vaultEntity;
  vault.totalShares = vault.totalShares.plus(shares);
  vault.totalDeposits = vault.totalDeposits.plus(assets);
  vault.totalCTokens = vault.totalCTokens.plus(actualCTokens); // Use calculated actual cTokens
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp;
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}, totalCTokens {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
    vault.totalCTokens.toString()
  ]);

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketAddress
  );

  collVault.principalShares = collVault.principalShares.plus(shares);
  collVault.principalDeposited = collVault.principalDeposited.plus(assets);
  collVault.totalCTokens = collVault.totalCTokens.plus(actualCTokens); // Use calculated actual cTokens
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp;
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
  // const totalCTokensFromEvent = event.params.cTokenAmount; // This is shares, not actual cTokens

  const vaultEntityWithdraw = CollectionsVault.load(vaultAddress.toHex());
  if (!vaultEntityWithdraw) {
    log.error("handleCollectionWithdraw: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketAddressWithdraw = Address.fromString(
    vaultEntityWithdraw.cTokenMarket
  );
  const cTokenMarketWithdraw = CTokenMarket.load(cTokenMarketAddressWithdraw.toHexString());

  let actualCTokensWithdraw = ZERO_BI;
  if (cTokenMarketWithdraw != null && cTokenMarketWithdraw.exchangeRate != ZERO_BI) {
    actualCTokensWithdraw = assets.times(BIGINT_1E18).div(cTokenMarketWithdraw.exchangeRate);
  } else {
    log.warning("handleCollectionWithdraw: CTokenMarket {} not found or exchangeRate is zero for vault {}. cTokenAmount will be based on shares (event.params.cTokenAmount).", [
      cTokenMarketAddressWithdraw.toHexString(),
      vaultAddress.toHex()
    ]);
    actualCTokensWithdraw = event.params.cTokenAmount; // Fallback to event shares
  }

  const vault = vaultEntityWithdraw;
  vault.totalShares = vault.totalShares.minus(shares);
  vault.totalDeposits = vault.totalDeposits.minus(assets);
  vault.totalCTokens = vault.totalCTokens.minus(actualCTokensWithdraw); // Use calculated actual cTokens
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp;
  vault.save();
  log.info("Updated Vault {}: totalShares {}, totalDeposits {}, totalCTokens {}", [
    vault.id,
    vault.totalShares.toString(),
    vault.totalDeposits.toString(),
    vault.totalCTokens.toString()
  ]);

  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketAddressWithdraw
  );
  collVault.principalShares = collVault.principalShares.minus(shares);
  collVault.principalDeposited = collVault.principalDeposited.minus(assets);
  collVault.totalCTokens = collVault.totalCTokens.minus(actualCTokensWithdraw); // Use calculated actual cTokens
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp;
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
    log.error(
      "handleVaultYieldAllocatedToEpoch: Epoch {} not found for vault {}. Allocation of {} cannot be processed.",
      [epochId, vaultAddress, amountAllocated.toString()]
    );
    return;
  }

  const vault = CollectionsVault.load(vaultAddress);
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

export function handleCollectionYieldAccrued(event: ethereum.Event): void {
  // CollectionYieldAccrued(indexed address,uint256,uint256,uint256,uint256)
  // event.params: collection, yieldAmount, globalDepositIndex, lastGlobalDepositIndex, totalAccrued
  
  if (event.parameters.length < 5) {
    log.error("handleCollectionYieldAccrued: Insufficient parameters. Expected 5, got {}", [
      event.parameters.length.toString()
    ]);
    return;
  }
  
  const collectionAddress = event.parameters[0].value.toAddress();
  const yieldAmount = event.parameters[1].value.toBigInt();
  const globalDepositIndex = event.parameters[2].value.toBigInt();
  const lastGlobalDepositIndex = event.parameters[3].value.toBigInt();
  const totalAccrued = event.parameters[4].value.toBigInt();
  
  const vaultAddress = event.address;
  
  log.info("CollectionYieldAccrued: vault {}, collection {}, yieldAmount {}, globalDepositIndex {}, lastGlobalDepositIndex {}, totalAccrued {}", [
    vaultAddress.toHexString(),
    collectionAddress.toHexString(),
    yieldAmount.toString(),
    globalDepositIndex.toString(),
    lastGlobalDepositIndex.toString(),
    totalAccrued.toString()
  ]);

  // Load the Vault to get its cTokenMarket address
  const vaultEntity = CollectionsVault.load(vaultAddress.toHex());
  if (!vaultEntity) {
    log.error("handleCollectionYieldAccrued: Vault {} not found. Cannot proceed.", [
      vaultAddress.toHex(),
    ]);
    return;
  }
  const cTokenMarketForVault = Address.fromString(vaultEntity.cTokenMarket);

  // Update CollectionVault with new yield information
  const collVault = getOrCreateCollectionVault(
    vaultAddress,
    collectionAddress,
    cTokenMarketForVault
  );

  collVault.globalDepositIndex = globalDepositIndex;
  collVault.lastGlobalDepositIndex = lastGlobalDepositIndex;
  collVault.yieldAccrued = totalAccrued;
  collVault.updatedAtBlock = event.block.number;
  collVault.updatedAtTimestamp = event.block.timestamp;
  collVault.save();

  const accrualId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const accrual = new CollectionYieldAccrual(accrualId);
  accrual.collection = collectionAddress.toHexString();
  accrual.yieldAmount = yieldAmount;
  accrual.globalDepositIndex = globalDepositIndex;
  accrual.blockNumber = event.block.number;
  accrual.timestamp = event.block.timestamp;
  accrual.transactionHash = event.transaction.hash;
  accrual.save();
}

/**
 * @notice Handles the CollectionYieldAppliedForEpoch event from the CollectionsVault contract.
 * @dev Updates the `remainingYield` and `subsidiesDistributed` fields in an `EpochVaultAllocation` entity.
 *      Also creates a `CollectionYieldApplication` entity for historical record.
 * @param event The CollectionYieldAppliedForEpoch event.
 * Event signature: event CollectionYieldAppliedForEpoch(uint256 indexed epochId, address indexed collection, uint16 yieldSharePercentage, uint256 yieldAdded, uint256 newTotalDeposits);
 * Note: The ABI in CollectionsVault.json has `yieldAdded` and `newTotalDeposits`. The task description mentions `yieldApplied`. Assuming `yieldAdded` is the correct parameter for `yieldApplied`.
 * The `vault` is `event.address`.
 */
export function handleCollectionYieldAppliedForEpoch(event: CollectionYieldAppliedForEpochEvent): void {
  const epochId = event.params.epochId.toString();
  const vaultAddress = event.address.toHexString();
  const collectionAddress = event.params.collection.toHexString();
  const yieldApplied = event.params.yieldAdded; // Assuming yieldAdded is the yieldApplied for the epoch

  log.info(
    "handleCollectionYieldAppliedForEpoch: epochId {}, vault {}, collection {}, yieldApplied {}",
    [epochId, vaultAddress, collectionAddress, yieldApplied.toString()]
  );

  
    // Update EpochVaultAllocation
    const epochVaultAllocationId = epochId + "-" + vaultAddress;
    const epochVaultAllocation = EpochVaultAllocation.load(epochVaultAllocationId); // Changed to const
  
    if (epochVaultAllocation == null) {
      log.warning(
        "handleCollectionYieldAppliedForEpoch: EpochVaultAllocation {} not found for epoch {} and vault {}. Cannot update subsidiesDistributed.",
        [epochVaultAllocationId, epochId, vaultAddress]
      );
      // Optionally create it, but it should ideally exist from VaultYieldAllocatedToEpoch or EpochManagerVaultYieldAllocated
      // For now, we will skip updating if it doesn't exist, as it implies a missing prior event.
    } else {
      epochVaultAllocation.subsidiesDistributed = epochVaultAllocation.subsidiesDistributed.plus(yieldApplied);
      epochVaultAllocation.remainingYield = epochVaultAllocation.yieldAllocated.minus(epochVaultAllocation.subsidiesDistributed);
      epochVaultAllocation.save();
    log.info(
      "handleCollectionYieldAppliedForEpoch: Updated EpochVaultAllocation {}: subsidiesDistributed {}, remainingYield {}",
      [
        epochVaultAllocationId,
        epochVaultAllocation.subsidiesDistributed.toString(),
        epochVaultAllocation.remainingYield.toString(),
      ]
    );
  }

  // Create CollectionYieldApplication entity for historical record
  const applicationEntityId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  let application = CollectionYieldApplication.load(applicationEntityId);
  if (application == null) {
    application = new CollectionYieldApplication(applicationEntityId);
    application.epochId = event.params.epochId;
    application.collection = collectionAddress; // Storing collection address string
    application.yieldApplied = yieldApplied;
    application.blockNumber = event.block.number;
    application.timestamp = event.block.timestamp; // Corrected: Use BigInt directly
    application.transactionHash = event.transaction.hash;
    application.save();

    log.info("handleCollectionYieldAppliedForEpoch: Created CollectionYieldApplication entity {}", [applicationEntityId]);
  }
}


export function handleYieldBatchRepaid(event: ethereum.Event): void {
  // YieldBatchRepaid(uint256,indexed address)
  // event.params: totalYieldRepaid, collection

  const totalYieldRepaid = event.parameters[0].value.toBigInt();
  const recipient = event.parameters[1].value.toAddress();

  log.info("YieldBatchRepaid: totalYieldRepaid {}, recipient {}", [
    totalYieldRepaid.toString(),
    recipient.toHexString()
  ]);

  const subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const subsidyTx = new SubsidyDistribution(subsidyTxId);
  subsidyTx.epoch = "";
  subsidyTx.user = recipient.toHexString();
  subsidyTx.collection = "";
  subsidyTx.vault = event.address.toHexString();
  subsidyTx.subsidyAmount = totalYieldRepaid;
  subsidyTx.borrowAmountBefore = ZERO_BI;
  subsidyTx.borrowAmountAfter = ZERO_BI;
  subsidyTx.gasUsed = event.receipt != null ? event.receipt!.gasUsed : ZERO_BI;
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp;
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.save();
}
