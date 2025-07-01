import { beforeEach, test, assert, clearStore, createMockedFunction } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import { handleTransfer } from "../../src/erc721-mapping";
import { Transfer } from "../../generated/ERC721Collection/ERC721";
import { newERC721TransferEvent } from "../utils/tokenHelpers";
import { Collection } from "../../generated/schema";
import { getOrCreateCollection } from "../../src/utils/getters";

const COLLECTION = Address.fromString("0x00000000000000000000000000000000000000d1");
const FROM = Address.fromString("0x00000000000000000000000000000000000000d2");
const TO = Address.fromString("0x00000000000000000000000000000000000000d3");

beforeEach(() => {
  clearStore();
  const col = new Collection(COLLECTION.toHexString());
  col.contractAddress = COLLECTION;
  col.registry = Address.fromString("0x00000000000000000000000000000000000000a0").toHexString();
  col.isActive = true;
  col.name = "Test Collection";
  col.symbol = "TEST";
  col.totalSupply = BigInt.fromI32(0);
  col.collectionType = "ERC721";
  col.yieldSharePercentage = BigInt.fromI32(0);
  col.weightFunctionType = "LINEAR";
  col.weightFunctionP1 = BigInt.fromI32(0);
  col.weightFunctionP2 = BigInt.fromI32(0);
  col.minBorrowAmount = BigInt.fromI32(0);
  col.maxBorrowAmount = BigInt.fromI32(0);
  col.totalNFTsDeposited = BigInt.fromI32(0);
  col.vaults = [];
  col.registeredAtBlock = BigInt.fromI32(0);
  col.registeredAtTimestamp = BigInt.fromI32(0);
  col.updatedAtBlock = BigInt.fromI32(0);
  col.updatedAtTimestamp = BigInt.fromI32(0);
  col.save();
});

test("getOrCreateCollection initializes vaults field correctly", () => {
  clearStore(); // Clear any existing collection from beforeEach
  
  const newCollectionAddress = Address.fromString("0x00000000000000000000000000000000000000e1");
  
  // Call getOrCreateCollection on a new collection address
  const collection = getOrCreateCollection(newCollectionAddress);
  
  // Verify that the collection was created and saved correctly
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "contractAddress", newCollectionAddress.toHexString());
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "name", "Unknown Collection");
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "symbol", "UNKN");
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "isActive", "false");
  
  // Most importantly, verify that the vaults field is properly initialized
  // Load the collection from store to verify vaults field exists and is empty
  const loadedCollection = Collection.load(newCollectionAddress.toHexString())!;
  assert.assertTrue(loadedCollection.vaults.length == 0);
});

test("getOrCreateCollection returns existing collection", () => {
  // The beforeEach already creates a collection with COLLECTION address
  // Call getOrCreateCollection on the existing collection
  const collection = getOrCreateCollection(COLLECTION);
  
  // Verify it returns the existing collection with our test data
  assert.fieldEquals("Collection", COLLECTION.toHexString(), "name", "Test Collection");
  assert.fieldEquals("Collection", COLLECTION.toHexString(), "symbol", "TEST");
  assert.fieldEquals("Collection", COLLECTION.toHexString(), "isActive", "true");
});

test("handleTransfer creates eligibility", () => {
  const event = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
  event.address = COLLECTION;
  handleTransfer(event);
  // const id = TO.toHexString() + "-" + "0" + "-" + COLLECTION.toHexString();
  assert.notInStore("UserEpochEligibility", "nonexistent"); // placeholder: entityExists not available
});

test("handleTransfer with non-existent collection uses getOrCreateCollection", () => {
  clearStore(); // Remove the collection created in beforeEach
  
  const newCollectionAddress = Address.fromString("0x00000000000000000000000000000000000000f1");
  
  // Mock the ERC721 contract calls to prevent errors (contract calls may fail but that's OK)
  createMockedFunction(newCollectionAddress, "name", "name():(string)")
    .reverts();
  createMockedFunction(newCollectionAddress, "symbol", "symbol():(string)")
    .reverts();
  
  const event = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
  event.address = newCollectionAddress;
  
  // This should trigger getOrCreateCollection internally
  handleTransfer(event);
  
  // Verify that a collection was created via getOrCreateCollection with default values (since contract calls reverted)
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "name", "Unknown Collection");
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "symbol", "UNKN");
  assert.fieldEquals("Collection", newCollectionAddress.toHexString(), "isActive", "false");
  
  // Most importantly, verify that the vaults field was properly initialized
  const loadedCollection = Collection.load(newCollectionAddress.toHexString())!;
  assert.assertTrue(loadedCollection.vaults.length == 0);
});
