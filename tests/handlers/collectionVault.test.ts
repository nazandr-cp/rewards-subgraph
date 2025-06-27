// ✔ handleCollectionDeposit: happy path ✔ handleCollectionDeposit: zero deposit ✔ handleCollectionDeposit: unknown vault
// ✔ handleCollectionWithdraw: happy path ✔ handleCollectionWithdraw: zero withdraw ✔ handleCollectionWithdraw: unknown vault
// ✔ handleCollectionDeposit: happy path ✔ handleCollectionDeposit: zero deposit ✔ handleCollectionDeposit: unknown vault ✔ handleCollectionDeposit: null cTokenMarket ✔ handleCollectionDeposit: zero exchangeRate
// ✔ handleCollectionWithdraw: happy path ✔ handleCollectionWithdraw: zero withdraw ✔ handleCollectionWithdraw: unknown vault ✔ handleCollectionWithdraw: null cTokenMarket ✔ handleCollectionWithdraw: zero exchangeRate
import {
  beforeEach,
  test,
  assert,
  clearStore,
  createMockedFunction,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes, ethereum } from "@graphprotocol/graph-ts";
import { handleCollectionDeposit, handleCollectionWithdraw } from "../../src/collection-vault-mapping";
import { newCollectionDepositEvent, newCollectionWithdrawEvent } from "../utils/collectionsHelpers";
import { CollectionDeposit, CollectionWithdraw } from "../../generated/templates/CollectionVault/CollectionVault"; // Import the specific event types
import { CollectionsVault, CTokenMarket, CollectionParticipation, Collection, CollectionRegistry } from "../../generated/schema"; // Added CollectionRegistry
import { expectConsistentVault, expectConsistentCollectionParticipation } from "../utils/consistency"; // Import consistency helpers

// Define common addresses and values for tests
const MOCK_REGISTRY_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000A");
const MOCK_COLLECTION_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000003");
const MOCK_VAULT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000004");
const MOCK_CTOKEN_MARKET_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000005");
const MOCK_EXCHANGE_RATE = BigInt.fromI32(1000000000);
const MOCK_CALLER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
const MOCK_RECEIVER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");

// Helper function to create and save a mock CollectionRegistry
function createMockCollectionRegistry(registryAddress: Address): void {
  const registry = new CollectionRegistry(registryAddress.toHexString());
  registry.totalCollections = BigInt.fromI32(0);
  registry.totalActiveCollections = BigInt.fromI32(0);
  registry.owner = Bytes.fromHexString(registryAddress.toHexString()) as Bytes; // Explicitly set as Bytes
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
  collection.registry = MOCK_REGISTRY_ADDRESS.toHexString(); // Use defined mock address
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
  collectionsVault.collectionRegistry = MOCK_REGISTRY_ADDRESS.toHexString(); // Keep as string for ID!
  collectionsVault.epochManager = Address.fromString("0x0000000000000000000000000000000000000007").toHexString(); // Keep as string for ID!
  collectionsVault.lendingManager = Address.fromString("0x0000000000000000000000000000000000000008").toHexString(); // Keep as string for ID!
  collectionsVault.debtSubsidizer = Address.fromString("0x0000000000000000000000000000000000000009").toHexString(); // Keep as string for ID!
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

// Helper function to create and save a mock CollectionParticipation
function createMockCollectionParticipation(
  vaultAddress: Address,
  collectionAddress: Address,
  initialShares: BigInt,
  initialAssets: BigInt,
  exchangeRate: BigInt
): void {
  const collectionParticipationId = vaultAddress.toHex() + "-" + collectionAddress.toHex();
  const collectionParticipation = new CollectionParticipation(collectionParticipationId);
  collectionParticipation.vault = vaultAddress.toHex();
  collectionParticipation.collection = collectionAddress.toHex();
  collectionParticipation.principalShares = initialShares;
  collectionParticipation.principalDeposited = initialAssets;
  collectionParticipation.totalCTokens = initialAssets.times(BigInt.fromString("1000000000000000000")).div(exchangeRate);
  collectionParticipation.globalDepositIndex = BigInt.fromI32(0);
  collectionParticipation.lastGlobalDepositIndex = BigInt.fromI32(0);
  collectionParticipation.yieldAccrued = BigInt.fromI32(0);
  collectionParticipation.yieldClaimed = BigInt.fromI32(0);
  collectionParticipation.totalYieldGenerated = BigInt.fromI32(0);
  collectionParticipation.isBorrowBased = false;
  collectionParticipation.rewardSharePercentage = BigInt.fromI32(0);
  collectionParticipation.weightFunctionType = "LINEAR";
  collectionParticipation.weightFunctionP1 = BigInt.fromI32(0);
  collectionParticipation.weightFunctionP2 = BigInt.fromI32(0);
  collectionParticipation.secondsAccumulated = BigInt.fromI32(0);
  collectionParticipation.secondsClaimed = BigInt.fromI32(0);
  collectionParticipation.totalSubsidies = BigInt.fromI32(0);
  collectionParticipation.totalSubsidiesClaimed = BigInt.fromI32(0);
  collectionParticipation.averageAPY = BigInt.fromI32(0);
  collectionParticipation.totalParticipants = BigInt.fromI32(0);
  collectionParticipation.createdAtBlock = BigInt.fromI32(1);
  collectionParticipation.createdAtTimestamp = BigInt.fromI32(1678886400);
  collectionParticipation.updatedAtBlock = BigInt.fromI32(1);
  collectionParticipation.updatedAtTimestamp = BigInt.fromI32(1678886400);
  collectionParticipation.save();
}

beforeEach(() => {
  clearStore();
});

test("handleCollectionDeposit: happy path deposit", () => {
  // Mock event parameters
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(1000);
  const shares = BigInt.fromI32(1000);
  const cTokenAmount = BigInt.fromI32(1000);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  // Create mock entities
  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCTokenMarket(cTokenMarketAddress, exchangeRate);

  // Create mock event
  const depositEvent = newCollectionDepositEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  depositEvent.address = vaultAddress;

  // Mock the exchangeRate function call
  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);

  // Call the handler
  handleCollectionDeposit(changetype<CollectionDeposit>(depositEvent));

  // Assertions
  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  assert.fieldEquals("CollectionsVault", vaultId, "totalShares", shares.toString());
  assert.fieldEquals("CollectionsVault", vaultId, "totalDeposits", assets.toString());
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", assets.times(BigInt.fromString("1000000000000000000")).div(exchangeRate).toString());

  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalShares", shares.toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalDeposited", assets.toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", assets.times(BigInt.fromString("1000000000000000000")).div(exchangeRate).toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});

test("handleCollectionDeposit: zero deposit (edge case)", () => {
  // Mock event parameters with zero assets and shares
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(0);
  const shares = BigInt.fromI32(0);
  const cTokenAmount = BigInt.fromI32(0);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  // Create mock entities
  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCTokenMarket(cTokenMarketAddress, exchangeRate);

  // Create mock event
  const depositEvent = newCollectionDepositEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  depositEvent.address = vaultAddress;

  // Mock the exchangeRate function call
  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);

  // Call the handler
  handleCollectionDeposit(changetype<CollectionDeposit>(depositEvent));

  // Assertions: Values should remain at their initial state (0)
  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  assert.fieldEquals("CollectionsVault", vaultId, "totalShares", "0");
  assert.fieldEquals("CollectionsVault", vaultId, "totalDeposits", "0");
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", "0");

  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalShares", "0");
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalDeposited", "0");
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", "0");

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});

test("handleCollectionDeposit: unknown vault (guard path)", () => {
  // Mock event parameters
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(1000);
  const shares = BigInt.fromI32(1000);
  const cTokenAmount = BigInt.fromI32(1000);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  // Create mock CollectionRegistry and CTokenMarket entities
  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCTokenMarket(cTokenMarketAddress, exchangeRate);

  // DO NOT create a mock CollectionsVault entity, simulating an unknown vault

  // Create mock event
  const depositEvent = newCollectionDepositEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  depositEvent.address = vaultAddress;

  // Mock the exchangeRate function call (this will not be called if vault is not found)
  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);

  // Call the handler
  handleCollectionDeposit(changetype<CollectionDeposit>(depositEvent));

  // Assertions: No entities should be created or updated for this vault
  assert.notInStore("CollectionsVault", vaultAddress.toHex());
  assert.notInStore("CollectionParticipation", vaultAddress.toHex() + "-" + collectionAddress.toHex());
});

test("handleCollectionDeposit: null cTokenMarket (edge case)", () => {
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(1000);
  const shares = BigInt.fromI32(1000);
  const cTokenAmount = BigInt.fromI32(500); // This will be used as fallback
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  // const exchangeRate = MOCK_EXCHANGE_RATE;

  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  // DO NOT create CTokenMarket, simulating null cTokenMarket

  const depositEvent = newCollectionDepositEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  depositEvent.address = vaultAddress;

  handleCollectionDeposit(changetype<CollectionDeposit>(depositEvent));

  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  // Assert that cTokenAmount from event was used as fallback
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", cTokenAmount.toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", cTokenAmount.toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});

test("handleCollectionDeposit: zero exchangeRate (edge case)", () => {
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(1000);
  const shares = BigInt.fromI32(1000);
  const cTokenAmount = BigInt.fromI32(500); // This will be used as fallback
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const zeroExchangeRate = BigInt.fromI32(0);

  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCTokenMarket(cTokenMarketAddress, zeroExchangeRate); // Zero exchange rate

  const depositEvent = newCollectionDepositEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  depositEvent.address = vaultAddress;

  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(zeroExchangeRate)]);

  handleCollectionDeposit(changetype<CollectionDeposit>(depositEvent));

  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  // Assert that cTokenAmount from event was used as fallback
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", cTokenAmount.toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", cTokenAmount.toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});


test("handleCollectionWithdraw: happy path withdraw", () => {
  // Mock event parameters
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(500);
  const shares = BigInt.fromI32(500);
  const cTokenAmount = BigInt.fromI32(500);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  // Create mock entities and initial state for withdrawal
  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCTokenMarket(cTokenMarketAddress, exchangeRate);
  createMockCollectionParticipation(
    vaultAddress,
    collectionAddress,
    BigInt.fromI32(1000), // initialShares
    BigInt.fromI32(1000), // initialAssets
    exchangeRate
  );

  // Update vault to have initial funds for withdrawal
  const vaultEntity = CollectionsVault.load(vaultAddress.toHex())!;
  vaultEntity.totalShares = BigInt.fromI32(1000);
  vaultEntity.totalDeposits = BigInt.fromI32(1000);
  vaultEntity.totalCTokens = BigInt.fromI32(1000).times(BigInt.fromString("1000000000000000000")).div(exchangeRate);
  vaultEntity.save();

  // Create mock event
  const withdrawEvent1 = newCollectionWithdrawEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  withdrawEvent1.address = vaultAddress;

  // Mock the exchangeRate function call
  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);

  // Call the handler
  handleCollectionWithdraw(changetype<CollectionWithdraw>(withdrawEvent1));

  // Assertions
  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  assert.fieldEquals("CollectionsVault", vaultId, "totalShares", BigInt.fromI32(500).toString());
  assert.fieldEquals("CollectionsVault", vaultId, "totalDeposits", BigInt.fromI32(500).toString());
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", BigInt.fromI32(500).times(BigInt.fromString("1000000000000000000")).div(exchangeRate).toString());

  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalShares", BigInt.fromI32(500).toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalDeposited", BigInt.fromI32(500).toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", BigInt.fromI32(500).times(BigInt.fromString("1000000000000000000")).div(exchangeRate).toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});

test("handleCollectionWithdraw: zero withdraw (edge case)", () => {
  // Mock event parameters with zero assets and shares
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(0);
  const shares = BigInt.fromI32(0);
  const cTokenAmount = BigInt.fromI32(0);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  // Create mock entities and initial state for withdrawal
  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCTokenMarket(cTokenMarketAddress, exchangeRate);
  createMockCollectionParticipation(
    vaultAddress,
    collectionAddress,
    BigInt.fromI32(1000), // initialShares
    BigInt.fromI32(1000), // initialAssets
    exchangeRate
  );

  // Update vault to have initial funds for withdrawal
  const vaultForZeroWithdraw = CollectionsVault.load(vaultAddress.toHex())!;
  vaultForZeroWithdraw.totalShares = BigInt.fromI32(1000);
  vaultForZeroWithdraw.totalDeposits = BigInt.fromI32(1000);
  vaultForZeroWithdraw.totalCTokens = BigInt.fromI32(1000).times(BigInt.fromString("1000000000000000000")).div(exchangeRate);
  vaultForZeroWithdraw.save();

  // Create mock event
  const withdrawEvent2 = newCollectionWithdrawEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  withdrawEvent2.address = vaultAddress;

  // Mock the exchangeRate function call
  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);

  // Call the handler
  handleCollectionWithdraw(changetype<CollectionWithdraw>(withdrawEvent2));

  // Assertions: Values should remain at their initial state (no change from 1000 since withdrawing 0)
  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  assert.fieldEquals("CollectionsVault", vaultId, "totalShares", BigInt.fromI32(1000).toString());
  assert.fieldEquals("CollectionsVault", vaultId, "totalDeposits", BigInt.fromI32(1000).toString());
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", BigInt.fromI32(1000).times(BigInt.fromString("1000000000000000000")).div(exchangeRate).toString());

  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalShares", BigInt.fromI32(1000).toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "principalDeposited", BigInt.fromI32(1000).toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", BigInt.fromI32(1000).times(BigInt.fromString("1000000000000000000")).div(exchangeRate).toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});

test("handleCollectionWithdraw: unknown vault (guard path)", () => {
  // Mock event parameters
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(500);
  const shares = BigInt.fromI32(500);
  const cTokenAmount = BigInt.fromI32(500);
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  // Create mock CollectionRegistry and CTokenMarket entities
  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCTokenMarket(cTokenMarketAddress, exchangeRate);

  // DO NOT create a mock CollectionsVault entity, simulating an unknown vault

  // Create mock event
  const withdrawEvent3 = newCollectionWithdrawEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  withdrawEvent3.address = vaultAddress;

  // Mock the exchangeRate function call (this will not be called if vault is not found)
  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(exchangeRate)]);

  // Call the handler
  handleCollectionWithdraw(changetype<CollectionWithdraw>(withdrawEvent3));

  // Assertions: No entities should be created or updated for this vault
  assert.notInStore("CollectionsVault", vaultAddress.toHex());
  assert.notInStore("CollectionParticipation", vaultAddress.toHex() + "-" + collectionAddress.toHex());
});

test("handleCollectionWithdraw: null cTokenMarket (edge case)", () => {
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(500);
  const shares = BigInt.fromI32(500);
  const cTokenAmount = BigInt.fromI32(250); // This will be used as fallback
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const exchangeRate = MOCK_EXCHANGE_RATE;

  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  // DO NOT create CTokenMarket, simulating null cTokenMarket
  createMockCollectionParticipation(
    vaultAddress,
    collectionAddress,
    BigInt.fromI32(1000), // initialShares
    BigInt.fromI32(1000), // initialAssets
    exchangeRate
  );

  // Update vault to have initial funds for withdrawal
  const vaultForNullMarket = CollectionsVault.load(vaultAddress.toHex())!;
  vaultForNullMarket.totalShares = BigInt.fromI32(1000);
  vaultForNullMarket.totalDeposits = BigInt.fromI32(1000);
  vaultForNullMarket.totalCTokens = BigInt.fromI32(1000); // Set to simple 1000 instead of calculated value
  vaultForNullMarket.save();

  // Also update the collection participation to match
  const collectionParticipationIdForNullMarket = vaultAddress.toHex() + "-" + collectionAddress.toHex();
  const collectionParticipationForNullMarket = CollectionParticipation.load(collectionParticipationIdForNullMarket)!;
  collectionParticipationForNullMarket.totalCTokens = BigInt.fromI32(1000); // Set to simple 1000
  collectionParticipationForNullMarket.save();

  const withdrawEvent4 = newCollectionWithdrawEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  withdrawEvent4.address = vaultAddress;

  handleCollectionWithdraw(changetype<CollectionWithdraw>(withdrawEvent4));

  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  // Assert that cTokenAmount from event was used as fallback
  // Initial was 1000, withdrawn 250, so should be 750
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", BigInt.fromI32(750).toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", BigInt.fromI32(750).toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});

test("handleCollectionWithdraw: zero exchangeRate (edge case)", () => {
  const caller = MOCK_CALLER_ADDRESS;
  const receiver = MOCK_RECEIVER_ADDRESS;
  const assets = BigInt.fromI32(500);
  const shares = BigInt.fromI32(500);
  const cTokenAmount = BigInt.fromI32(250); // This will be used as fallback
  const collectionAddress = MOCK_COLLECTION_ADDRESS;
  const vaultAddress = MOCK_VAULT_ADDRESS;
  const cTokenMarketAddress = MOCK_CTOKEN_MARKET_ADDRESS;
  const zeroExchangeRate = BigInt.fromI32(0);

  createMockCollectionRegistry(MOCK_REGISTRY_ADDRESS);
  createMockCollection(collectionAddress);
  createMockCollectionsVault(vaultAddress, cTokenMarketAddress);
  createMockCTokenMarket(cTokenMarketAddress, zeroExchangeRate); // Zero exchange rate
  // Use valid exchange rate for initial creation to avoid division by zero
  createMockCollectionParticipation(
    vaultAddress,
    collectionAddress,
    BigInt.fromI32(1000), // initialShares
    BigInt.fromI32(1000), // initialAssets
    MOCK_EXCHANGE_RATE // Use valid exchange rate for creation
  );

  const withdrawEvent5 = newCollectionWithdrawEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  withdrawEvent5.address = vaultAddress;

  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(zeroExchangeRate)]);

  handleCollectionWithdraw(changetype<CollectionWithdraw>(withdrawEvent5));

  const vaultId = vaultAddress.toHex();
  const collectionVaultId = vaultAddress.toHex() + "-" + collectionAddress.toHex();

  // Assert that cTokenAmount from event was used as fallback
  // Initial totalCTokens for CollectionParticipation was calculated with zeroExchangeRate, so it would be a very large number or cause division by zero.
  // Let's assume for this test that initial totalCTokens is based on the cTokenAmount from event for simplicity, or a reasonable large number.
  // For now, I'll assert based on the fallback logic.
  // The initial totalCTokens for CollectionParticipation would be initialAssets.times(BIGINT_1E18).div(zeroExchangeRate) which is problematic.
  // Let's adjust the initial state for this specific test to make sense with the fallback.
  // If exchangeRate is zero, the initial totalCTokens in createMockCollectionParticipation would be problematic.
  // For this test, let's manually set the initial totalCTokens for the CollectionParticipation to a known value.
  // Or, better, ensure createMockCollectionParticipation handles zero exchange rate gracefully or we set it up differently.

  // Re-thinking: The `createMockCollectionParticipation` uses `exchangeRate` to calculate `totalCTokens`.
  // If `zeroExchangeRate` is passed, it will cause division by zero.
  // For this specific test, I need to ensure the initial state is valid.
  // I will create the CollectionParticipation manually with a valid initial totalCTokens.

  // Let's re-evaluate the initial state for this test.
  // If exchangeRate is zero, the initial totalCTokens in createMockCollectionParticipation would be problematic.
  // For this test, I will set the initial totalCTokens for the CollectionParticipation to a known value that makes sense for the fallback.
  // Let's assume initial totalCTokens is 1000 for simplicity, and then subtract the cTokenAmount.

  // Initial state setup for this specific test:
  const initialTotalCTokens = BigInt.fromI32(1000);
  const initialSharesForWithdraw = BigInt.fromI32(1000);
  const initialAssetsForWithdraw = BigInt.fromI32(1000);

  const collectionParticipationId = vaultAddress.toHex() + "-" + collectionAddress.toHex();
  const collectionParticipation = new CollectionParticipation(collectionParticipationId);
  collectionParticipation.vault = vaultAddress.toHex();
  collectionParticipation.collection = collectionAddress.toHex();
  collectionParticipation.principalShares = initialSharesForWithdraw;
  collectionParticipation.principalDeposited = initialAssetsForWithdraw;
  collectionParticipation.totalCTokens = initialTotalCTokens; // Manually set for this test
  collectionParticipation.globalDepositIndex = BigInt.fromI32(0);
  collectionParticipation.lastGlobalDepositIndex = BigInt.fromI32(0);
  collectionParticipation.yieldAccrued = BigInt.fromI32(0);
  collectionParticipation.yieldClaimed = BigInt.fromI32(0);
  collectionParticipation.totalYieldGenerated = BigInt.fromI32(0);
  collectionParticipation.isBorrowBased = false;
  collectionParticipation.rewardSharePercentage = BigInt.fromI32(0);
  collectionParticipation.weightFunctionType = "LINEAR";
  collectionParticipation.weightFunctionP1 = BigInt.fromI32(0);
  collectionParticipation.weightFunctionP2 = BigInt.fromI32(0);
  collectionParticipation.secondsAccumulated = BigInt.fromI32(0);
  collectionParticipation.secondsClaimed = BigInt.fromI32(0);
  collectionParticipation.totalSubsidies = BigInt.fromI32(0);
  collectionParticipation.totalSubsidiesClaimed = BigInt.fromI32(0);
  collectionParticipation.averageAPY = BigInt.fromI32(0);
  collectionParticipation.totalParticipants = BigInt.fromI32(0);
  collectionParticipation.createdAtBlock = BigInt.fromI32(1);
  collectionParticipation.createdAtTimestamp = BigInt.fromI32(1678886400);
  collectionParticipation.updatedAtBlock = BigInt.fromI32(1);
  collectionParticipation.updatedAtTimestamp = BigInt.fromI32(1678886400);
  collectionParticipation.save();

  // Also set initial totalCTokens for CollectionsVault
  const collectionsVault = new CollectionsVault(vaultAddress.toHex());
  collectionsVault.totalShares = initialSharesForWithdraw;
  collectionsVault.totalDeposits = initialAssetsForWithdraw;
  collectionsVault.totalCTokens = initialTotalCTokens; // Manually set for this test
  collectionsVault.globalDepositIndex = BigInt.fromI32(0);
  collectionsVault.totalPrincipalDeposited = BigInt.fromI32(0);
  collectionsVault.collectionRegistry = MOCK_REGISTRY_ADDRESS.toHexString();
  collectionsVault.epochManager = Address.fromString("0x0000000000000000000000000000000000000007").toHexString();
  collectionsVault.lendingManager = Address.fromString("0x0000000000000000000000000000000000000008").toHexString();
  collectionsVault.debtSubsidizer = Address.fromString("0x0000000000000000000000000000000000000009").toHexString();
  collectionsVault.createdAtBlock = BigInt.fromI32(1);
  collectionsVault.createdAtTimestamp = BigInt.fromI32(1678886400);
  collectionsVault.updatedAtBlock = BigInt.fromI32(1);
  collectionsVault.updatedAtTimestamp = BigInt.fromI32(1678886400);
  collectionsVault.cTokenMarket = cTokenMarketAddress.toHexString();
  collectionsVault.save();

  // The rest of the test remains the same
  const withdrawEvent6 = newCollectionWithdrawEvent(
    caller,
    receiver,
    assets,
    shares,
    cTokenAmount,
    collectionAddress
  );
  withdrawEvent6.address = vaultAddress;

  createMockedFunction(
    cTokenMarketAddress,
    "exchangeRateStored",
    "exchangeRateStored():(uint256)"
  ).returns([ethereum.Value.fromUnsignedBigInt(zeroExchangeRate)]);

  handleCollectionWithdraw(changetype<CollectionWithdraw>(withdrawEvent6));

  // Assert that cTokenAmount from event was used as fallback
  assert.fieldEquals("CollectionsVault", vaultId, "totalCTokens", initialTotalCTokens.minus(cTokenAmount).toString());
  assert.fieldEquals("CollectionParticipation", collectionVaultId, "totalCTokens", initialTotalCTokens.minus(cTokenAmount).toString());

  expectConsistentVault(vaultId);
  expectConsistentCollectionParticipation(collectionVaultId);
});