import { beforeEach, test, assert, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  handleCollectionRegistered,
  handleYieldShareUpdated,
  handleWeightFunctionUpdated,
  handleVaultAddedToCollection,
  handleVaultRemovedFromCollection,
  handleCollectionRemoved,
  handleCollectionReactivated,
} from "../../src/collection-registry-mapping";
import {
  CollectionRegistered,
  YieldShareUpdated,
  WeightFunctionUpdated,
  VaultAddedToCollection,
  VaultRemovedFromCollection,
  CollectionRemoved,
  CollectionReactivated,
} from "../../generated/CollectionRegistry/CollectionRegistry";
import {
  newCollectionRegisteredEvent,
  newYieldShareUpdatedEvent,
  newWeightFunctionUpdatedEvent,
  newVaultAddedToCollectionEvent,
  newVaultRemovedFromCollectionEvent,
  newCollectionRemovedEvent,
  newCollectionReactivatedEvent,
} from "../utils/tokenHelpers";
import {
  CollectionRegistry,
  Collection,
  SystemState,
} from "../../generated/schema";

// Test constants
const REGISTRY_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
const COLLECTION_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");
const VAULT_ADDRESS_1 = Address.fromString("0x0000000000000000000000000000000000000003");
const VAULT_ADDRESS_2 = Address.fromString("0x0000000000000000000000000000000000000004");

beforeEach(() => {
  clearStore();
  
  // Initialize SystemState
  const systemState = new SystemState("SYSTEM");
  systemState.totalVaults = BigInt.fromI32(0);
  systemState.totalUsers = BigInt.fromI32(0);
  systemState.totalCollections = BigInt.fromI32(0);
  systemState.totalValueLocked = BigInt.fromI32(0);
  systemState.systemUtilizationRate = BigInt.fromI32(0);
  systemState.averageAPY = BigInt.fromI32(0);
  systemState.lastUpdatedBlock = BigInt.fromI32(0);
  systemState.lastUpdatedTimestamp = BigInt.fromI32(0);
  systemState.save();
});

test("handleCollectionRegistered: creates new registry and collection on first registration", () => {
  const event = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    1, // EXPONENTIAL
    BigInt.fromI32(100),
    BigInt.fromI32(200),
    25 // 25% yield share
  );

  // Set the registry address on the event
  const mockEvent = changetype<CollectionRegistered>(event);
  mockEvent.address = REGISTRY_ADDRESS;

  handleCollectionRegistered(mockEvent);

  // Check CollectionRegistry entity
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalCollections", "1");
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalActiveCollections", "1");
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "owner", mockEvent.transaction.from.toHexString());

  // Check Collection entity
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "contractAddress", COLLECTION_ADDRESS.toHexString());
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "collectionType", "ERC721");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "isActive", "true");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "yieldSharePercentage", "25");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionType", "EXPONENTIAL");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionP1", "100");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionP2", "200");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "registry", REGISTRY_ADDRESS.toHexString());

  // Check SystemState update
  assert.fieldEquals("SystemState", "SYSTEM", "totalCollections", "1");
});

test("handleCollectionRegistered: handles ERC1155 and LINEAR weight function", () => {
  const event = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    1, // ERC1155
    0, // LINEAR
    BigInt.fromI32(50),
    BigInt.fromI32(0),
    10 // 10% yield share
  );

  const mockEvent = changetype<CollectionRegistered>(event);
  mockEvent.address = REGISTRY_ADDRESS;

  handleCollectionRegistered(mockEvent);

  // Check Collection entity with different parameters
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "collectionType", "ERC1155");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionType", "LINEAR");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "yieldSharePercentage", "10");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionP1", "50");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionP2", "0");
});

test("handleCollectionRegistered: increments registry counts for multiple collections", () => {
  // First collection
  const event1 = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockEvent1 = changetype<CollectionRegistered>(event1);
  mockEvent1.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockEvent1);

  // Second collection
  const secondCollection = Address.fromString("0x0000000000000000000000000000000000000005");
  const event2 = newCollectionRegisteredEvent(
    secondCollection,
    1, // ERC1155
    1, // EXPONENTIAL
    BigInt.fromI32(200),
    BigInt.fromI32(100),
    30
  );
  const mockEvent2 = changetype<CollectionRegistered>(event2);
  mockEvent2.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockEvent2);

  // Check registry counts
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalCollections", "2");
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalActiveCollections", "2");
  assert.fieldEquals("SystemState", "SYSTEM", "totalCollections", "2");
});

test("handleYieldShareUpdated: updates existing collection yield share", () => {
  // First create a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  // Update yield share
  const updateEvent = newYieldShareUpdatedEvent(COLLECTION_ADDRESS, 20, 35);
  const mockUpdateEvent = changetype<YieldShareUpdated>(updateEvent);
  handleYieldShareUpdated(mockUpdateEvent);

  // Check updated yield share
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "yieldSharePercentage", "35");
});

test("handleWeightFunctionUpdated: updates existing collection weight function", () => {
  // First create a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  // Update weight function
  const updateEvent = newWeightFunctionUpdatedEvent(
    COLLECTION_ADDRESS,
    1, // EXPONENTIAL
    BigInt.fromI32(300),
    BigInt.fromI32(150)
  );
  const mockUpdateEvent = changetype<WeightFunctionUpdated>(updateEvent);
  handleWeightFunctionUpdated(mockUpdateEvent);

  // Check updated weight function
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionType", "EXPONENTIAL");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionP1", "300");
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "weightFunctionP2", "150");
});

test("handleVaultAddedToCollection: adds vault to collection vaults array", () => {
  // First create a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  // Add vault to collection
  const addVaultEvent = newVaultAddedToCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_1);
  const mockAddVaultEvent = changetype<VaultAddedToCollection>(addVaultEvent);
  handleVaultAddedToCollection(mockAddVaultEvent);

  // Load collection and check vaults array
  const collection = Collection.load(COLLECTION_ADDRESS.toHexString())!;
  assert.assertTrue(collection.vaults.length == 1);
  assert.bytesEquals(collection.vaults[0], VAULT_ADDRESS_1);
});

test("handleVaultAddedToCollection: adds multiple vaults to collection", () => {
  // First create a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  // Add first vault
  const addVault1Event = newVaultAddedToCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_1);
  const mockAddVault1Event = changetype<VaultAddedToCollection>(addVault1Event);
  handleVaultAddedToCollection(mockAddVault1Event);

  // Add second vault
  const addVault2Event = newVaultAddedToCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_2);
  const mockAddVault2Event = changetype<VaultAddedToCollection>(addVault2Event);
  handleVaultAddedToCollection(mockAddVault2Event);

  // Load collection and check vaults array
  const collection = Collection.load(COLLECTION_ADDRESS.toHexString())!;
  assert.assertTrue(collection.vaults.length == 2);
  assert.bytesEquals(collection.vaults[0], VAULT_ADDRESS_1);
  assert.bytesEquals(collection.vaults[1], VAULT_ADDRESS_2);
});

test("handleVaultRemovedFromCollection: removes vault from collection vaults array", () => {
  // First create a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  // Add two vaults
  const addVault1Event = newVaultAddedToCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_1);
  const mockAddVault1Event = changetype<VaultAddedToCollection>(addVault1Event);
  handleVaultAddedToCollection(mockAddVault1Event);

  const addVault2Event = newVaultAddedToCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_2);
  const mockAddVault2Event = changetype<VaultAddedToCollection>(addVault2Event);
  handleVaultAddedToCollection(mockAddVault2Event);

  // Remove first vault
  const removeVaultEvent = newVaultRemovedFromCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_1);
  const mockRemoveVaultEvent = changetype<VaultRemovedFromCollection>(removeVaultEvent);
  handleVaultRemovedFromCollection(mockRemoveVaultEvent);

  // Load collection and check vaults array
  const collection = Collection.load(COLLECTION_ADDRESS.toHexString())!;
  assert.assertTrue(collection.vaults.length == 1);
  assert.bytesEquals(collection.vaults[0], VAULT_ADDRESS_2);
});

test("handleCollectionRemoved: deactivates collection and decrements active count", () => {
  // First create a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  // Remove collection
  const removeEvent = newCollectionRemovedEvent(COLLECTION_ADDRESS);
  const mockRemoveEvent = changetype<CollectionRemoved>(removeEvent);
  mockRemoveEvent.address = REGISTRY_ADDRESS;
  handleCollectionRemoved(mockRemoveEvent);

  // Check collection is deactivated
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "isActive", "false");

  // Check registry active count decremented
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalActiveCollections", "0");
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalCollections", "1"); // Total count unchanged
});

test("handleCollectionReactivated: reactivates collection and increments active count", () => {
  // First create and remove a collection
  const registerEvent = newCollectionRegisteredEvent(
    COLLECTION_ADDRESS,
    0, // ERC721
    0, // LINEAR
    BigInt.fromI32(100),
    BigInt.fromI32(50),
    20
  );
  const mockRegisterEvent = changetype<CollectionRegistered>(registerEvent);
  mockRegisterEvent.address = REGISTRY_ADDRESS;
  handleCollectionRegistered(mockRegisterEvent);

  const removeEvent = newCollectionRemovedEvent(COLLECTION_ADDRESS);
  const mockRemoveEvent = changetype<CollectionRemoved>(removeEvent);
  mockRemoveEvent.address = REGISTRY_ADDRESS;
  handleCollectionRemoved(mockRemoveEvent);

  // Reactivate collection
  const reactivateEvent = newCollectionReactivatedEvent(COLLECTION_ADDRESS);
  const mockReactivateEvent = changetype<CollectionReactivated>(reactivateEvent);
  mockReactivateEvent.address = REGISTRY_ADDRESS;
  handleCollectionReactivated(mockReactivateEvent);

  // Check collection is reactivated
  assert.fieldEquals("Collection", COLLECTION_ADDRESS.toHexString(), "isActive", "true");

  // Check registry active count incremented
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalActiveCollections", "1");
  assert.fieldEquals("CollectionRegistry", REGISTRY_ADDRESS.toHexString(), "totalCollections", "1");
});

test("error handling: YieldShareUpdated on non-existent collection logs error", () => {
  // Try to update yield share on non-existent collection
  const updateEvent = newYieldShareUpdatedEvent(COLLECTION_ADDRESS, 20, 35);
  const mockUpdateEvent = changetype<YieldShareUpdated>(updateEvent);
  
  // This should handle gracefully and not crash
  handleYieldShareUpdated(mockUpdateEvent);
  
  // Collection should not exist
  assert.notInStore("Collection", COLLECTION_ADDRESS.toHexString());
});

test("error handling: WeightFunctionUpdated on non-existent collection logs error", () => {
  // Try to update weight function on non-existent collection
  const updateEvent = newWeightFunctionUpdatedEvent(
    COLLECTION_ADDRESS,
    1, // EXPONENTIAL
    BigInt.fromI32(300),
    BigInt.fromI32(150)
  );
  const mockUpdateEvent = changetype<WeightFunctionUpdated>(updateEvent);
  
  // This should handle gracefully and not crash
  handleWeightFunctionUpdated(mockUpdateEvent);
  
  // Collection should not exist
  assert.notInStore("Collection", COLLECTION_ADDRESS.toHexString());
});

test("error handling: VaultAddedToCollection on non-existent collection logs error", () => {
  // Try to add vault to non-existent collection
  const addVaultEvent = newVaultAddedToCollectionEvent(COLLECTION_ADDRESS, VAULT_ADDRESS_1);
  const mockAddVaultEvent = changetype<VaultAddedToCollection>(addVaultEvent);
  
  // This should handle gracefully and not crash
  handleVaultAddedToCollection(mockAddVaultEvent);
  
  // Collection should not exist
  assert.notInStore("Collection", COLLECTION_ADDRESS.toHexString());
});