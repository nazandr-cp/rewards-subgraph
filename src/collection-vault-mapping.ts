import {
  CollectionDeposit as CollectionDepositEvent,
  CollectionWithdraw as CollectionWithdrawEvent,
  VaultYieldAllocatedToEpoch as VaultYieldAllocatedToEpochEvent,
  CollectionYieldAppliedForEpoch as CollectionYieldAppliedForEpochEvent,
} from "../generated/templates/CollectionVault/CollectionVault";
import { log, Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  CollectionsVault,
  Epoch,
  CollectionYieldApplication,
  CollectionYieldAccrual,
  SubsidyDistribution,
  CTokenMarket,
  EpochVaultAllocation,
  CollectionDeposit
} from "../generated/schema";

import { getOrCreateCollectionVault, getOrCreateEpochVaultAllocation, getOrCreateAccount } from "./utils/getters";
import { ZERO_BI, BIGINT_1E18 } from "./utils/const";

function getAddressFromParameter(param: ethereum.EventParam): Address {
  return param.value.toAddress();
}

function getBigIntFromParameter(param: ethereum.EventParam): BigInt {
  return param.value.toBigInt();
}

export function handleCollectionDeposit(event: CollectionDepositEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;

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
    actualCTokens = event.params.cTokenAmount;
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

  // Update Account statistics
  const account = getOrCreateAccount(event.params.receiver);
  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();

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

  // Create CollectionDeposit entity for E2E testing
  const depositId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const deposit = new CollectionDeposit(depositId);
  deposit.depositor = event.params.caller;
  deposit.collection = collectionAddress;
  deposit.vault = vaultAddress;
  deposit.amount = assets;
  deposit.shares = shares;
  deposit.timestamp = event.block.timestamp;
  deposit.blockNumber = event.block.number;
  deposit.transactionHash = event.transaction.hash;
  deposit.save();

  // Export test data for E2E integration
  const testData = `{"depositor": "${event.params.caller.toHexString()}", "collection": "${collectionAddress.toHexString()}", "vault": "${vaultAddress.toHexString()}", "amount": "${assets.toString()}", "shares": "${shares.toString()}"}`;
  log.info("E2E_TEST_DATA: DEPOSIT - {}", [testData]);
}

export function handleDepositForCollection(event: CollectionDepositEvent): void {
  handleCollectionDeposit(event);
}

export function handleCollectionWithdraw(event: CollectionWithdrawEvent): void {
  const vaultAddress = event.address;
  const collectionAddress = event.params.collectionAddress;
  const shares = event.params.shares;
  const assets = event.params.assets;

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
    actualCTokensWithdraw = event.params.cTokenAmount;
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
  const epochVaultAllocation = getOrCreateEpochVaultAllocation(epochId, vaultAddress);

  epochVaultAllocation.yieldAllocated = epochVaultAllocation.yieldAllocated.plus(amountAllocated);
  epochVaultAllocation.remainingYield = epochVaultAllocation.yieldAllocated.minus(epochVaultAllocation.subsidiesDistributed);
  epochVaultAllocation.updatedAtBlock = event.block.number;
  epochVaultAllocation.updatedAtTimestamp = event.block.timestamp;
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

}

export function handleCollectionYieldAccrued(event: ethereum.Event): void {
  if (event.parameters.length < 5) {
    log.error("handleCollectionYieldAccrued: Insufficient parameters. Expected 5, got {}", [
      event.parameters.length.toString()
    ]);
    return;
  }

  const collectionAddress = getAddressFromParameter(event.parameters[0]);
  const yieldAmount = getBigIntFromParameter(event.parameters[1]);
  const globalDepositIndex = getBigIntFromParameter(event.parameters[2]);
  const lastGlobalDepositIndex = getBigIntFromParameter(event.parameters[3]);
  const totalAccrued = getBigIntFromParameter(event.parameters[4]);

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
  accrual.cumulativeYield = totalAccrued;
  accrual.sourceType = "";
  accrual.sourceTransaction = Bytes.empty();
  accrual.save();
}

export function handleCollectionYieldAppliedForEpoch(event: CollectionYieldAppliedForEpochEvent): void {
  const epochId = event.params.epochId.toString();
  const vaultAddress = event.address.toHexString();
  const collectionAddress = event.params.collection.toHexString();
  const yieldApplied = event.params.yieldAdded; // Assuming yieldAdded is the yieldApplied for the epoch

  log.info(
    "handleCollectionYieldAppliedForEpoch: epochId {}, vault {}, collection {}, yieldApplied {}",
    [epochId, vaultAddress, collectionAddress, yieldApplied.toString()]
  );


  // Update EpochVaultAllocation only if it exists
  const epochVaultAllocationId = epochId + "-" + vaultAddress;
  const epochVaultAllocation = EpochVaultAllocation.load(epochVaultAllocationId);

  if (epochVaultAllocation != null) {
    epochVaultAllocation.subsidiesDistributed = epochVaultAllocation.subsidiesDistributed.plus(yieldApplied);
    epochVaultAllocation.remainingYield = epochVaultAllocation.yieldAllocated.minus(epochVaultAllocation.subsidiesDistributed);
    epochVaultAllocation.updatedAtBlock = event.block.number;
    epochVaultAllocation.updatedAtTimestamp = event.block.timestamp;
    epochVaultAllocation.save();

    log.info(
      "handleCollectionYieldAppliedForEpoch: Updated EpochVaultAllocation {}: subsidiesDistributed {}, remainingYield {}",
      [
        epochVaultAllocationId,
        epochVaultAllocation.subsidiesDistributed.toString(),
        epochVaultAllocation.remainingYield.toString(),
      ]
    );
  } else {
    log.warning(
      "handleCollectionYieldAppliedForEpoch: EpochVaultAllocation {} not found for epoch {} and vault {}. Cannot update subsidiesDistributed.",
      [epochVaultAllocationId, epochId, vaultAddress]
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
    application.recipientCount = ZERO_BI;
    application.averageYieldPerUser = ZERO_BI;
    application.processingGasUsed = ZERO_BI;
    application.save();

    log.info("handleCollectionYieldAppliedForEpoch: Created CollectionYieldApplication entity {}", [applicationEntityId]);
  }
}


export function handleYieldBatchRepaid(event: ethereum.Event): void {
  // YieldBatchRepaid(uint256,indexed address)
  // event.params: totalYieldRepaid, collection

  const totalYieldRepaid = getBigIntFromParameter(event.parameters[0]);
  const recipient = getAddressFromParameter(event.parameters[1]);

  log.info("YieldBatchRepaid: totalYieldRepaid {}, recipient {}", [
    totalYieldRepaid.toString(),
    recipient.toHexString()
  ]);

  // Update recipient's totalYieldEarned since this is actual yield distribution
  const account = getOrCreateAccount(recipient);
  account.totalYieldEarned = account.totalYieldEarned.plus(totalYieldRepaid);
  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();

  const subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const subsidyTx = new SubsidyDistribution(subsidyTxId);
  subsidyTx.epoch = "";
  subsidyTx.user = recipient.toHexString();
  subsidyTx.collection = "";
  subsidyTx.vault = event.address.toHexString();
  subsidyTx.subsidyAmount = totalYieldRepaid;
  subsidyTx.borrowAmountBefore = ZERO_BI;
  subsidyTx.borrowAmountAfter = ZERO_BI;
  let gasUsed = ZERO_BI;
  const receipt = event.receipt;
  if (receipt != null) {
    gasUsed = receipt.gasUsed;
  }
  subsidyTx.gasUsed = gasUsed;
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp;
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.debtSubsidizer = "";
  subsidyTx.nftBalance = ZERO_BI;
  subsidyTx.weightedContribution = ZERO_BI;
  subsidyTx.save();
}
