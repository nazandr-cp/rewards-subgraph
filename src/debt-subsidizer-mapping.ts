import {
  MerkleRootUpdated,
  SubsidyClaimed,
  VaultAdded,
} from "../generated/DebtSubsidizer/DebtSubsidizer";
import {
  SubsidyDistribution,
  Epoch,
  DebtSubsidizer,
  VaultAddition,
  CollectionsVault,
  CollectionParticipation,
} from "../generated/schema";
import { log, Address } from "@graphprotocol/graph-ts";
import { CollectionVault } from "../generated/templates";

import { getOrCreateVault, getOrCreateAccount, getOrCreateSystemState, getOrCreateEpochVaultAllocation, getOrCreateMerkleDistribution } from "./utils/getters";
import { ZERO_BI } from "./utils/const";

export function handleVaultAdded(event: VaultAdded): void {
  const vaultAddress = event.params.vaultAddress;
  const cTokenAddress = event.params.cTokenAddress;
  const lendingManagerAddress = event.params.lendingManagerAddress;

  CollectionVault.create(vaultAddress);

  // Create or update the DebtSubsidizer entity
  let debtSubsidizer = DebtSubsidizer.load(event.address.toHexString());
  if (debtSubsidizer == null) {
    debtSubsidizer = new DebtSubsidizer(event.address.toHexString());
    debtSubsidizer.totalSubsidyPool = ZERO_BI;
    debtSubsidizer.totalSubsidiesDistributed = ZERO_BI;
    debtSubsidizer.totalSubsidiesRemaining = ZERO_BI;
    debtSubsidizer.subsidyRate = ZERO_BI;
    debtSubsidizer.maxSubsidyPerUser = ZERO_BI;
    debtSubsidizer.subsidyDuration = ZERO_BI;
    debtSubsidizer.owner = event.transaction.from;
    debtSubsidizer.createdAtBlock = event.block.number;
    debtSubsidizer.createdAtTimestamp = event.block.timestamp;
  }
  debtSubsidizer.updatedAtBlock = event.block.number;
  debtSubsidizer.updatedAtTimestamp = event.block.timestamp;
  debtSubsidizer.save();

  const vaultAdditionId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const vaultAddition = new VaultAddition(vaultAdditionId);
  vaultAddition.debtSubsidizer = debtSubsidizer.id;
  vaultAddition.vaultAddress = vaultAddress;
  vaultAddition.cTokenAddress = cTokenAddress;
  vaultAddition.lendingManagerAddress = lendingManagerAddress;
  vaultAddition.createdAtBlock = event.block.number;
  vaultAddition.createdAtTimestamp = event.block.timestamp;
  vaultAddition.transactionHash = event.transaction.hash;
  vaultAddition.save();

  const vault = getOrCreateVault(vaultAddress, cTokenAddress);
  vault.lendingManager = lendingManagerAddress.toHexString();
  vault.debtSubsidizer = debtSubsidizer.id;
  vault.createdAtBlock = event.block.number;
  vault.createdAtTimestamp = event.block.timestamp;
  vault.updatedAtBlock = event.block.number;
  vault.updatedAtTimestamp = event.block.timestamp;
  vault.save();

  log.info(
    "VaultAdded: Created CollectionVault template for vault {} with cToken {} and lendingManager {}. DebtSubsidizer: {}",
    [
      vaultAddress.toHexString(),
      cTokenAddress.toHexString(),
      lendingManagerAddress.toHexString(),
      debtSubsidizer.id,
    ]
  );
}

export function handleMerkleRootUpdated(event: MerkleRootUpdated): void {
  const eventIdBase =
    event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  const systemState = getOrCreateSystemState();
  if (systemState.activeEpochId === null) {
    log.critical(
      "handleMerkleRootUpdated: No active epoch found. Cannot process event {}.",
      [eventIdBase]
    );
    return;
  }

  const epochIdString = systemState.activeEpochId!.toString();
  let epoch = Epoch.load(epochIdString);
  if (epoch === null) {
    log.critical(
      "handleMerkleRootUpdated: Active Epoch with id {} not found for event {}. Cannot process.",
      [epochIdString, eventIdBase]
    );
    return;
  }

  // If the epoch is already completed, this merkle root update is part of the finalization process
  if (epoch.status === "COMPLETED") {
    log.info(
      "handleMerkleRootUpdated: Processing merkle root update for already completed epoch {}. This is normal during finalization.",
      [epochIdString]
    );
  }

  const vaultEntity = CollectionsVault.load(event.params.vaultAddress.toHexString());
  if (vaultEntity === null) {
    log.error(
      "handleMerkleRootUpdated: Vault {} not found. Cannot process merkle root update.",
      [event.params.vaultAddress.toHexString()]
    );
    return;
  }

  const cTokenAddress = Address.fromString(vaultEntity.cTokenMarket);
  const vault = getOrCreateVault(
    event.params.vaultAddress,
    cTokenAddress
  );

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
  if (systemState.activeEpochId === null) {
    log.critical(
      "handleSubsidyClaimed: No active epoch found. Cannot process event {}.",
      [eventIdBase]
    );
    return;
  }

  const epochIdString = systemState.activeEpochId!.toString();
  const epoch = Epoch.load(epochIdString);
  if (epoch === null) {
    log.critical(
      "handleSubsidyClaimed: Active Epoch with id {} not found for event {}. Cannot process.",
      [epochIdString, eventIdBase]
    );
    return;
  }

  const account = getOrCreateAccount(event.params.recipient);

  const vaultEntity = CollectionsVault.load(event.params.vaultAddress.toHexString());
  if (vaultEntity === null) {
    log.error(
      "handleSubsidyClaimed: Vault {} not found. Cannot process subsidy claim.",
      [event.params.vaultAddress.toHexString()]
    );
    return;
  }

  const cTokenAddress = Address.fromString(vaultEntity.cTokenMarket);
  const loadedVault = getOrCreateVault(
    event.params.vaultAddress,
    cTokenAddress
  );

  const subsidyTxId = "CLAIMTX-" + eventIdBase;
  const subsidyTx = new SubsidyDistribution(subsidyTxId);
  subsidyTx.epoch = epoch.id;
  subsidyTx.user = account.id;
  subsidyTx.collection = account.id;
  subsidyTx.vault = loadedVault.id;
  subsidyTx.debtSubsidizer = event.address.toHexString();
  subsidyTx.subsidyAmount = event.params.amount;
  subsidyTx.borrowAmountBefore = ZERO_BI;
  subsidyTx.borrowAmountAfter = ZERO_BI;
  subsidyTx.nftBalance = ZERO_BI;
  subsidyTx.weightedContribution = ZERO_BI;
  subsidyTx.gasUsed =
    event.receipt !== null ? event.receipt!.gasUsed : ZERO_BI;
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp;
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.save();

  // Update AccountSubsidy for the user
  const accountSubsidies = account.accountSubsidies.load();
  for (let i = 0; i < accountSubsidies.length; i++) {
    const subsidy = accountSubsidies[i];
    const collectionParticipation = CollectionParticipation.load(subsidy.collectionParticipation);
    if (collectionParticipation && collectionParticipation.vault == loadedVault.id) {
      const newTotal = subsidy.secondsClaimed.plus(event.params.amount);
      subsidy.secondsClaimed = newTotal;
      subsidy.subsidiesClaimed = subsidy.subsidiesClaimed.plus(event.params.amount);
      subsidy.updatedAtBlock = event.block.number;
      subsidy.updatedAtTimestamp = event.block.timestamp;
      subsidy.save();
    }
  }

  epoch.totalSubsidiesDistributed = epoch.totalSubsidiesDistributed.plus(
    event.params.amount
  );
  epoch.save();

  const vaultAllocation = getOrCreateEpochVaultAllocation(epoch.id, loadedVault.id);

  vaultAllocation.subsidiesDistributed = vaultAllocation.subsidiesDistributed.plus(event.params.amount);
  if (vaultAllocation.yieldAllocated.gt(ZERO_BI)) {
    const newRemainingYield = vaultAllocation.yieldAllocated.minus(vaultAllocation.subsidiesDistributed);
    vaultAllocation.remainingYield = newRemainingYield.lt(ZERO_BI) ? ZERO_BI : newRemainingYield;
  } else {
    const newRemainingYield = vaultAllocation.remainingYield.minus(event.params.amount);
    vaultAllocation.remainingYield = newRemainingYield.lt(ZERO_BI) ? ZERO_BI : newRemainingYield;
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

  const testData = `{"user": "${event.params.recipient.toHexString()}", "vault": "${event.params.vaultAddress.toHexString()}", "amount": "${event.params.amount.toString()}", "epoch": "${epoch.id}"}`;
  log.info("E2E_TEST_DATA: SUBSIDY_CLAIM - {}", [testData]);
}
