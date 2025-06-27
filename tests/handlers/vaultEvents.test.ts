import {
  beforeEach,
  test,
  assert,
  clearStore,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import {
  VaultYieldAllocatedToEpoch as VaultYieldAllocatedToEpochEvent,
  CollectionYieldAppliedForEpoch as CollectionYieldAppliedForEpochEvent,
} from "../../generated/templates/CollectionVault/CollectionVault";
import {
  handleVaultYieldAllocatedToEpoch,
  handleCollectionYieldAccrued,
  handleCollectionYieldAppliedForEpoch,
  handleYieldBatchRepaid,
} from "../../src/collection-vault-mapping";
import {
  newVaultYieldAllocatedToEpochEvent,
  newCollectionYieldAccruedEvent,
  newCollectionYieldAppliedForEpochEvent,
  newYieldBatchRepaidEvent,
} from "../utils/collectionsHelpers";
import {
  CollectionsVault,
  Epoch,
  CTokenMarket,
  Collection,
  CollectionRegistry,
  EpochVaultAllocation,
} from "../../generated/schema";
import { CollectionYieldApplication } from "../../generated/schema";

// Define common addresses and values for tests
const MOCK_REGISTRY_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000A");
const MOCK_COLLECTION_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000003");
const MOCK_VAULT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000004");
const MOCK_CTOKEN_MARKET_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000005");
const MOCK_EXCHANGE_RATE = BigInt.fromI32(1000000000);
// const MOCK_CALLER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
const MOCK_RECEIVER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");
const MOCK_EPOCH_MANAGER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000006");
const MOCK_DEBT_SUBSIDIZER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000009");

// Helper function to create and save a mock CollectionRegistry
function createMockCollectionRegistry(registryAddress: Address): void {
  const registry = new CollectionRegistry(registryAddress.toHexString());
  registry.totalCollections = BigInt.fromI32(0);
  registry.totalActiveCollections = BigInt.fromI32(0);
  registry.owner = Bytes.fromHexString(registryAddress.toHexString()) as Bytes;
  registry.createdAtBlock = BigInt.fromI32(1);
  registry.createdAtTimestamp = BigInt.fromI32(1678886400);
  registry.updatedAtBlock = BigInt.fromI32(1);
  registry.updatedAtTimestamp = BigInt.fromI32(1678886400);
  registry.save();
}

// Helper function to create and save a mock Collection
function createMockCollection(collectionAddress: Address): void {
  const collection = new Collection(collectionAddress.toHexString());
  collection.contractAddress = Bytes.fromHexString(collectionAddress.toHexString()) as Bytes;
  collection.name = "Mock Collection";
  collection.symbol = "MOCK";
  collection.totalSupply = BigInt.fromI32(0);
  collection.collectionType = "ERC721";
  collection.registry = MOCK_REGISTRY_ADDRESS.toHexString();
  collection.isActive = true;
  collection.yieldSharePercentage = BigInt.fromI32(0);
  collection.weightFunctionType = "LINEAR";
  collection.weightFunctionP1 = BigInt.fromI32(0);
  collection.weightFunctionP2 = BigInt.fromI32(0);
  collection.minBorrowAmount = BigInt.fromI32(0);
  collection.maxBorrowAmount = BigInt.fromI32(0);
  collection.totalNFTsDeposited = BigInt.fromI32(0);
  collection.totalBorrowVolume = BigInt.fromI32(0);
  collection.totalYieldGenerated = BigInt.fromI32(0);
  collection.totalSubsidiesReceived = BigInt.fromI32(0);
  collection.registeredAtBlock = BigInt.fromI32(1);
  collection.registeredAtTimestamp = BigInt.fromI32(1678886400);
  collection.updatedAtBlock = BigInt.fromI32(1);
  collection.updatedAtTimestamp = BigInt.fromI32(1678886400);
  collection.save();
}

// Helper function to create and save a mock CollectionsVault
function createMockCollectionsVault(
  vaultAddress: Address,
  cTokenMarketAddress: Address
): void {
  const collectionsVault = new CollectionsVault(vaultAddress.toHex());
  collectionsVault.totalShares = BigInt.fromI32(0);
  collectionsVault.totalDeposits = BigInt.fromI32(0);
  collectionsVault.totalCTokens = BigInt.fromI32(0);
  collectionsVault.globalDepositIndex = BigInt.fromI32(0);
  collectionsVault.totalPrincipalDeposited = BigInt.fromI32(0);
  collectionsVault.collectionRegistry = MOCK_REGISTRY_ADDRESS.toHexString();
  collectionsVault.epochManager = MOCK_EPOCH_MANAGER_ADDRESS.toHexString();
  collectionsVault.lendingManager = Address.fromString("0x0000000000000000000000000000000000000008").toHexString();
  collectionsVault.debtSubsidizer = MOCK_DEBT_SUBSIDIZER_ADDRESS.toHexString();
  collectionsVault.createdAtBlock = BigInt.fromI32(1);
  collectionsVault.createdAtTimestamp = BigInt.fromI32(1678886400);
  collectionsVault.updatedAtBlock = BigInt.fromI32(1);
  collectionsVault.updatedAtTimestamp = BigInt.fromI32(1678886400);
  collectionsVault.cTokenMarket = cTokenMarketAddress.toHexString();
  collectionsVault.save();
}

// Helper function to create and save a mock CTokenMarket
function createMockCTokenMarket(
  cTokenMarketAddress: Address,
  exchangeRate: BigInt
): void {
  const cTokenMarket = new CTokenMarket(cTokenMarketAddress.toHexString());
  cTokenMarket.symbol = "cETH";
  cTokenMarket.name = "Compound Ether";
  cTokenMarket.decimals = 8;
  cTokenMarket.totalSupply = BigInt.fromI32(0);
  cTokenMarket.totalBorrows = BigInt.fromI32(0);
  cTokenMarket.totalReserves = BigInt.fromI32(0);
  cTokenMarket.exchangeRate = exchangeRate;
  cTokenMarket.interestAccumulated = BigInt.fromI32(0);
  cTokenMarket.cashPrior = BigInt.fromI32(0);
  cTokenMarket.borrowIndex = BigInt.fromI32(0);
  cTokenMarket.collateralFactor = BigInt.fromI32(0);
  cTokenMarket.liquidationIncentive = BigInt.fromI32(0);
  cTokenMarket.reserveFactor = BigInt.fromI32(0);
  cTokenMarket.baseRatePerBlock = BigInt.fromI32(0);
  cTokenMarket.multiplierPerBlock = BigInt.fromI32(0);
  cTokenMarket.jumpMultiplierPerBlock = BigInt.fromI32(0);
  cTokenMarket.kink = BigInt.fromI32(0);
  cTokenMarket.lastExchangeRateTimestamp = BigInt.fromI32(1678886400);
  cTokenMarket.updatedAtBlock = BigInt.fromI32(1);
  cTokenMarket.updatedAtTimestamp = BigInt.fromI32(1678886400);
  cTokenMarket.save();
}

// Helper function to create and save a mock Epoch
function createMockEpoch(epochId: BigInt): void {
  const epoch = new Epoch(epochId.toString());
  epoch.epochNumber = epochId;
  epoch.startTimestamp = BigInt.fromI32(1678886400);
  epoch.endTimestamp = BigInt.fromI32(1678886400 + 86400); // 1 day later
  epoch.totalYieldAvailable = BigInt.fromI32(0);
  epoch.totalYieldDistributed = BigInt.fromI32(0);
  epoch.totalSubsidiesDistributed = BigInt.fromI32(0);
  epoch.createdAtBlock = BigInt.fromI32(1);
  epoch.createdAtTimestamp = BigInt.fromI32(1678886400);
  epoch.updatedAtBlock = BigInt.fromI32(1);
  epoch.updatedAtTimestamp = BigInt.fromI32(1678886400);
  epoch.epochManager = MOCK_EPOCH_MANAGER_ADDRESS.toHexString();
  epoch.status = "ACTIVE";
  epoch.totalYieldAllocated = BigInt.fromI32(0);
  epoch.remainingYield = BigInt.fromI32(0);
  epoch.totalEligibleUsers = BigInt.fromI32(0);
  epoch.totalParticipatingCollections = BigInt.fromI32(0);
  epoch.participantCount = BigInt.fromI32(0);
  epoch.save();
}

// Helper function to create and save a mock EpochVaultAllocation
function createMockEpochVaultAllocation(
  epochId: BigInt,
  vaultAddress: Address,
  yieldAllocated: BigInt,
  subsidiesDistributed: BigInt
): void {
  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  const allocation = new EpochVaultAllocation(allocationId);
  allocation.epoch = epochId.toString();
  allocation.vault = vaultAddress.toHexString();
  allocation.yieldAllocated = yieldAllocated;
  allocation.subsidiesDistributed = subsidiesDistributed;
  allocation.remainingYield = yieldAllocated.minus(subsidiesDistributed);
  allocation.participantCount = BigInt.fromI32(0);
  allocation.averageSubsidyPerUser = BigInt.fromI32(0);
  allocation.utilizationRate = BigInt.fromI32(0);
  allocation.createdAtBlock = BigInt.fromI32(1);
  allocation.createdAtTimestamp = BigInt.fromI32(1678886400);
  allocation.updatedAtBlock = BigInt.fromI32(1);
  allocation.updatedAtTimestamp = BigInt.fromI32(1678886400);
  allocation.participantCount = BigInt.fromI32(0);
  allocation.save();
}

beforeEach(() => {
  clearStore();
});

// Tests for handleVaultYieldAllocatedToEpoch
test("handleVaultYieldAllocatedToEpoch: happy path", () => {
  const epochId = BigInt.fromI32(1);
  const amount = BigInt.fromI32(1000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  createMockEpoch(epochId);
  createMockCollectionsVault(vaultAddress, MOCK_CTOKEN_MARKET_ADDRESS);

  const event = newVaultYieldAllocatedToEpochEvent(epochId, amount);
  event.address = vaultAddress;

  handleVaultYieldAllocatedToEpoch(changetype<VaultYieldAllocatedToEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  const allocation = EpochVaultAllocation.load(allocationId);
  if (allocation) {
    allocation.participantCount = BigInt.fromI32(0);
    allocation.save();
  }
  assert.fieldEquals("EpochVaultAllocation", allocationId, "epoch", epochId.toString());
  assert.fieldEquals("EpochVaultAllocation", allocationId, "vault", vaultAddress.toHexString());
  assert.fieldEquals("EpochVaultAllocation", allocationId, "yieldAllocated", amount.toString());
  assert.fieldEquals("EpochVaultAllocation", allocationId, "subsidiesDistributed", "0");
  assert.fieldEquals("EpochVaultAllocation", allocationId, "remainingYield", amount.toString());
});

test("handleVaultYieldAllocatedToEpoch: existing allocation", () => {
  const epochId = BigInt.fromI32(1);
  const initialAmount = BigInt.fromI32(500);
  const additionalAmount = BigInt.fromI32(700);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  createMockEpoch(epochId);
  createMockCollectionsVault(vaultAddress, MOCK_CTOKEN_MARKET_ADDRESS);
  createMockEpochVaultAllocation(epochId, vaultAddress, initialAmount, BigInt.fromI32(0));

  const event = newVaultYieldAllocatedToEpochEvent(epochId, additionalAmount);
  event.address = vaultAddress;

  handleVaultYieldAllocatedToEpoch(changetype<VaultYieldAllocatedToEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  assert.fieldEquals("EpochVaultAllocation", allocationId, "yieldAllocated", initialAmount.plus(additionalAmount).toString());
  assert.fieldEquals("EpochVaultAllocation", allocationId, "remainingYield", initialAmount.plus(additionalAmount).toString());
});

test("handleVaultYieldAllocatedToEpoch: unknown epoch (guard path)", () => {
  const epochId = BigInt.fromI32(1);
  const amount = BigInt.fromI32(1000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  // DO NOT create mock epoch
  createMockCollectionsVault(vaultAddress, MOCK_CTOKEN_MARKET_ADDRESS);

  const event = newVaultYieldAllocatedToEpochEvent(epochId, amount);
  event.address = vaultAddress;

  handleVaultYieldAllocatedToEpoch(changetype<VaultYieldAllocatedToEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  assert.notInStore("EpochVaultAllocation", allocationId);
});

test("handleVaultYieldAllocatedToEpoch: unknown vault (guard path)", () => {
  const epochId = BigInt.fromI32(1);
  const amount = BigInt.fromI32(1000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  createMockEpoch(epochId);
  // DO NOT create mock vault

  const event = newVaultYieldAllocatedToEpochEvent(epochId, amount);
  event.address = vaultAddress;

  handleVaultYieldAllocatedToEpoch(changetype<VaultYieldAllocatedToEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  assert.notInStore("EpochVaultAllocation", allocationId);
});

// Tests for handleCollectionYieldAccrued
test("handleCollectionYieldAccrued: happy path", () => {
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const yieldAmount = BigInt.fromI32(500);
  const globalDepositIndex = BigInt.fromI32(100);
  const lastGlobalDepositIndex = BigInt.fromI32(50);
  const totalAccrued = BigInt.fromI32(1000);
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;

  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCollection(collectionAddress);
  createMockCTokenMarket(cTokenMarketAddress, MOCK_EXCHANGE_RATE);

  const event = newCollectionYieldAccruedEvent(
    collectionAddress,
    yieldAmount,
    globalDepositIndex,
    lastGlobalDepositIndex,
    totalAccrued
  );
  event.address = vaultAddress;

  handleCollectionYieldAccrued(event);

  const collVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();
  assert.fieldEquals("CollectionParticipation", collVaultId, "globalDepositIndex", globalDepositIndex.toString());
  assert.fieldEquals("CollectionParticipation", collVaultId, "lastGlobalDepositIndex", lastGlobalDepositIndex.toString());
  assert.fieldEquals("CollectionParticipation", collVaultId, "yieldAccrued", totalAccrued.toString());

  const accrualId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  assert.fieldEquals("CollectionYieldAccrual", accrualId, "collection", collectionAddress.toHexString());
  assert.fieldEquals("CollectionYieldAccrual", accrualId, "yieldAmount", yieldAmount.toString());
  assert.fieldEquals("CollectionYieldAccrual", accrualId, "globalDepositIndex", globalDepositIndex.toString());
});

test("handleCollectionYieldAccrued: unknown vault (guard path)", () => {
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const yieldAmount = BigInt.fromI32(500);
  const globalDepositIndex = BigInt.fromI32(100);
  const lastGlobalDepositIndex = BigInt.fromI32(50);
  const totalAccrued = BigInt.fromI32(1000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  // DO NOT create mock vault
  createMockCollection(collectionAddress);

  const event = newCollectionYieldAccruedEvent(
    collectionAddress,
    yieldAmount,
    globalDepositIndex,
    lastGlobalDepositIndex,
    totalAccrued
  );
  event.address = vaultAddress;

  handleCollectionYieldAccrued(event);

  const collVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();
  assert.notInStore("CollectionParticipation", collVaultId);
  assert.notInStore("CollectionYieldAccrual", event.transaction.hash.toHex() + "-" + event.logIndex.toString());
});

test("handleCollectionYieldAccrued: zero yield amount (edge case)", () => {
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const yieldAmount = BigInt.fromI32(0);
  const globalDepositIndex = BigInt.fromI32(100);
  const lastGlobalDepositIndex = BigInt.fromI32(50);
  const totalAccrued = BigInt.fromI32(0);
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;

  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCollection(collectionAddress);
  createMockCTokenMarket(cTokenMarketAddress, MOCK_EXCHANGE_RATE);

  const event = newCollectionYieldAccruedEvent(
    collectionAddress,
    yieldAmount,
    globalDepositIndex,
    lastGlobalDepositIndex,
    totalAccrued
  );
  event.address = vaultAddress;

  handleCollectionYieldAccrued(event);

  const collVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();
  assert.fieldEquals("CollectionParticipation", collVaultId, "yieldAccrued", "0");
  const accrualId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  assert.fieldEquals("CollectionYieldAccrual", accrualId, "yieldAmount", "0");
});

// Tests for handleCollectionYieldAppliedForEpoch
test("handleCollectionYieldAppliedForEpoch: happy path", () => {
  const epochId = BigInt.fromI32(1);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const yieldSharePercentage = BigInt.fromI32(100);
  const yieldAdded = BigInt.fromI32(500);
  const newTotalDeposits = BigInt.fromI32(10000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  createMockEpoch(epochId);
  createMockCollectionsVault(vaultAddress, MOCK_CTOKEN_MARKET_ADDRESS);
  createMockEpochVaultAllocation(epochId, vaultAddress, BigInt.fromI32(1000), BigInt.fromI32(0));

  const event = newCollectionYieldAppliedForEpochEvent(
    epochId,
    collectionAddress,
    yieldSharePercentage,
    yieldAdded,
    newTotalDeposits
  );
  event.address = vaultAddress;

  handleCollectionYieldAppliedForEpoch(changetype<CollectionYieldAppliedForEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  assert.fieldEquals("EpochVaultAllocation", allocationId, "subsidiesDistributed", yieldAdded.toString());
  assert.fieldEquals("EpochVaultAllocation", allocationId, "remainingYield", BigInt.fromI32(1000).minus(yieldAdded).toString());

  const applicationId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const application = CollectionYieldApplication.load(applicationId);
  if (application) {
    application.recipientCount = BigInt.fromI32(0);
    application.save();
  }
  assert.fieldEquals("CollectionYieldApplication", applicationId, "epochId", epochId.toString());
  assert.fieldEquals("CollectionYieldApplication", applicationId, "collection", collectionAddress.toHexString());
  assert.fieldEquals("CollectionYieldApplication", applicationId, "yieldApplied", yieldAdded.toString());
});

test("handleCollectionYieldAppliedForEpoch: unknown EpochVaultAllocation (guard path)", () => {
  const epochId = BigInt.fromI32(1);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const yieldSharePercentage = BigInt.fromI32(100);
  const yieldAdded = BigInt.fromI32(500);
  const newTotalDeposits = BigInt.fromI32(10000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  createMockEpoch(epochId);
  createMockCollectionsVault(vaultAddress, MOCK_CTOKEN_MARKET_ADDRESS);
  // DO NOT create mock EpochVaultAllocation

  const event = newCollectionYieldAppliedForEpochEvent(
    epochId,
    collectionAddress,
    yieldSharePercentage,
    yieldAdded,
    newTotalDeposits
  );
  event.address = vaultAddress;

  handleCollectionYieldAppliedForEpoch(changetype<CollectionYieldAppliedForEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  assert.notInStore("EpochVaultAllocation", allocationId); // Should not be created or updated
  const applicationId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const application = CollectionYieldApplication.load(applicationId);
  if (application) {
    application.recipientCount = BigInt.fromI32(0);
    application.save();
  }
  assert.fieldEquals("CollectionYieldApplication", applicationId, "yieldApplied", yieldAdded.toString()); // Application should still be created
});

test("handleCollectionYieldAppliedForEpoch: zero yield applied (edge case)", () => {
  const epochId = BigInt.fromI32(1);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const yieldSharePercentage = BigInt.fromI32(100);
  const yieldAdded = BigInt.fromI32(0);
  const newTotalDeposits = BigInt.fromI32(10000);
  const vaultAddress = MOCK_VAULT_ADDRESS;

  createMockEpoch(epochId);
  createMockCollectionsVault(vaultAddress, MOCK_CTOKEN_MARKET_ADDRESS);
  createMockEpochVaultAllocation(epochId, vaultAddress, BigInt.fromI32(1000), BigInt.fromI32(0));

  const event = newCollectionYieldAppliedForEpochEvent(
    epochId,
    collectionAddress,
    yieldSharePercentage,
    yieldAdded,
    newTotalDeposits
  );
  event.address = vaultAddress;

  handleCollectionYieldAppliedForEpoch(changetype<CollectionYieldAppliedForEpochEvent>(event));

  const allocationId = epochId.toString() + "-" + vaultAddress.toHexString();
  assert.fieldEquals("EpochVaultAllocation", allocationId, "subsidiesDistributed", "0");
  assert.fieldEquals("EpochVaultAllocation", allocationId, "remainingYield", BigInt.fromI32(1000).toString());

  const applicationId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
  const application = CollectionYieldApplication.load(applicationId);
  if (application) {
    application.recipientCount = BigInt.fromI32(0);
    application.save();
  }
  assert.fieldEquals("CollectionYieldApplication", applicationId, "yieldApplied", "0");
});

// Tests for handleYieldBatchRepaid
test("handleYieldBatchRepaid: happy path", () => {
  const totalYieldRepaid = BigInt.fromI32(2000);
  const recipient = MOCK_RECEIVER_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;

  const event = newYieldBatchRepaidEvent(totalYieldRepaid, recipient);
  event.address = vaultAddress;

  // Create a proper transaction receipt with gasUsed
  const receiptLogs: ethereum.Log[] = [];
  const receipt = new ethereum.TransactionReceipt(
    Bytes.fromHexString("0x1234567890123456789012345678901234567890123456789012345678901234"), // transactionHash (32 bytes)
    BigInt.fromI32(0), // transactionIndex
    Bytes.fromHexString("0x1234567890123456789012345678901234567890123456789012345678901234"), // blockHash (32 bytes)
    BigInt.fromI32(1), // blockNumber
    BigInt.fromI32(100000), // gasUsed - this is what we want to test
    BigInt.fromI32(100000), // cumulativeGasUsed
    Address.zero(), // contractAddress
    receiptLogs, // logs
    BigInt.fromI32(1), // status
    Bytes.empty(), // root
    Bytes.empty() // logsBloom
  );
  event.receipt = receipt;

  handleYieldBatchRepaid(event);

  const subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "user", recipient.toHexString());
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "vault", vaultAddress.toHexString());
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "subsidyAmount", totalYieldRepaid.toString());
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "gasUsed", "100000");
});

test("handleYieldBatchRepaid: zero yield repaid (edge case)", () => {
  const totalYieldRepaid = BigInt.fromI32(0);
  const recipient = MOCK_RECEIVER_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;

  const event = newYieldBatchRepaidEvent(totalYieldRepaid, recipient);
  event.address = vaultAddress;
  // Don't set event.receipt to simulate null receipt

  handleYieldBatchRepaid(event);

  const subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "subsidyAmount", "0");
});

test("handleYieldBatchRepaid: null receipt (edge case)", () => {
  const totalYieldRepaid = BigInt.fromI32(2000);
  const recipient = MOCK_RECEIVER_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;

  const event = newYieldBatchRepaidEvent(totalYieldRepaid, recipient);
  event.address = vaultAddress;
  // event.receipt is null by default for newMockEvent()

  handleYieldBatchRepaid(event);

  const subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "gasUsed", "1"); // Default when no receipt is provided
});