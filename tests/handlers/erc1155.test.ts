/*
import {
  assert,
  describe,
  test,
  clearStore,
  beforeEach,
  afterEach,
} from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { TransferSingle } from "../../generated/ERC1155Collection/ERC1155";
import { handleTransferSingle } from "../../src/erc1155-mapping";
import { newTransferSingleEvent } from "./erc1155-utils";
import { ADDRESS_ZERO_STR, SYSTEM_STATE_ID } from "../../src/utils/const";
import { Collection, SystemState } from "../../generated/schema";

// Mock the Collection and SystemState entities for testing
function createMockCollection(address: Address): Collection {
  const collection = new Collection(address.toHexString());
  collection.vaults = []; // Initialize with an empty array
  collection.save();
  return collection;
}

function createMockSystemState(): SystemState {
  const systemState = new SystemState(SYSTEM_STATE_ID);
  systemState.activeEpochId = "1"; // Mock an active epoch
  systemState.totalVaults = BigInt.fromI32(0);
  systemState.totalUsers = BigInt.fromI32(0);
  systemState.totalCollections = BigInt.fromI32(0);
  systemState.totalValueLocked = BigInt.fromI32(0);
  systemState.systemUtilizationRate = BigInt.fromI32(0);
  systemState.averageAPY = BigInt.fromI32(0);
  systemState.lastUpdatedBlock = BigInt.fromI32(0);
  systemState.lastUpdatedTimestamp = BigInt.fromI32(0);
  systemState.save();
  return systemState;
}

describe("ERC1155 TransferSingle Handler", () => {
  beforeEach(() => {
    clearStore();
    createMockSystemState();
  });

  afterEach(() => {
    clearStore();
  });

  test("should handle TransferSingle event for new accounts", () => {
    const operator = Address.fromString("0x0000000000000000000000000000000000000001");
    const from = Address.fromString(ADDRESS_ZERO_STR);
    const to = Address.fromString("0x0000000000000000000000000000000000000002");
    const id = BigInt.fromI32(1);
    const value = BigInt.fromI32(10);
    const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000003");

    createMockCollection(collectionAddress);

    const event = newTransferSingleEvent(operator, from, to, id, value, collectionAddress);
    handleTransferSingle(event);

    assert.entityExists("Account", to.toHexString());
    assert.entityExists("UserEpochEligibility", to.toHexString() + "-1-" + collectionAddress.toHexString());
    assert.fieldEquals(
      "UserEpochEligibility",
      to.toHexString() + "-1-" + collectionAddress.toHexString(),
      "nftBalance",
      value.toString()
    );
  });

  test("should update nftBalance for existing accounts", () => {
    const operator = Address.fromString("0x0000000000000000000000000000000000000001");
    const from = Address.fromString("0x0000000000000000000000000000000000000002");
    const to = Address.fromString("0x0000000000000000000000000000000000000003");
    const id = BigInt.fromI32(1);
    const value = BigInt.fromI32(5);
    const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000004");

    createMockCollection(collectionAddress);

    // Initial transfer to 'from' account
    const initialEvent = newTransferSingleEvent(operator, Address.fromString(ADDRESS_ZERO_STR), from, id, BigInt.fromI32(10), collectionAddress);
    handleTransferSingle(initialEvent);

    // Transfer from 'from' to 'to'
    const event = newTransferSingleEvent(operator, from, to, id, value, collectionAddress);
    handleTransferSingle(event);

    assert.fieldEquals(
      "UserEpochEligibility",
      from.toHexString() + "-1-" + collectionAddress.toHexString(),
      "nftBalance",
      BigInt.fromI32(5).toString()
    );
    assert.fieldEquals(
      "UserEpochEligibility",
      to.toHexString() + "-1-" + collectionAddress.toHexString(),
      "nftBalance",
      value.toString()
    );
  });

  test("should not update nftBalance for zero address transfers", () => {
    const operator = Address.fromString("0x0000000000000000000000000000000000000001");
    const from = Address.fromString(ADDRESS_ZERO_STR);
    const to = Address.fromString(ADDRESS_ZERO_STR);
    const id = BigInt.fromI32(1);
    const value = BigInt.fromI32(10);
    const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000005");

    createMockCollection(collectionAddress);

    const event = newTransferSingleEvent(operator, from, to, id, value, collectionAddress);
    handleTransferSingle(event);

    assert.notInStore("Account", from.toHexString());
    assert.notInStore("Account", to.toHexString());
  });

  test("should handle TransferBatch event for new accounts", () => {
    const operator = Address.fromString("0x0000000000000000000000000000000000000001");
    const from = Address.fromString(ADDRESS_ZERO_STR);
    const to = Address.fromString("0x0000000000000000000000000000000000000002");
    const ids = [BigInt.fromI32(1), BigInt.fromI32(2)];
    const values = [BigInt.fromI32(10), BigInt.fromI32(20)];
    const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000003");

    createMockCollection(collectionAddress);

    const event = newTransferBatchEvent(operator, from, to, ids, values, collectionAddress);
    handleTransferBatch(event);

    assert.entityExists("Account", to.toHexString());
    assert.entityExists("UserEpochEligibility", to.toHexString() + "-1-" + collectionAddress.toHexString());
    assert.fieldEquals(
      "UserEpochEligibility",
      to.toHexString() + "-1-" + collectionAddress.toHexString(),
      "nftBalance",
      BigInt.fromI32(30).toString() // 10 + 20
    );
  });

  test("should update nftBalance for existing accounts in TransferBatch", () => {
    const operator = Address.fromString("0x0000000000000000000000000000000000000001");
    const from = Address.fromString("0x0000000000000000000000000000000000000002");
    const to = Address.fromString("0x0000000000000000000000000000000000000003");
    const ids = [BigInt.fromI32(1), BigInt.fromI32(2)];
    const values = [BigInt.fromI32(5), BigInt.fromI32(10)];
    const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000004");

    createMockCollection(collectionAddress);

    // Initial transfer to 'from' account
    const initialIds = [BigInt.fromI32(1), BigInt.fromI32(2)];
    const initialValues = [BigInt.fromI32(10), BigInt.fromI32(20)];
    const initialEvent = newTransferBatchEvent(operator, Address.fromString(ADDRESS_ZERO_STR), from, initialIds, initialValues, collectionAddress);
    handleTransferBatch(initialEvent);

    // Transfer from 'from' to 'to'
    const event = newTransferBatchEvent(operator, from, to, ids, values, collectionAddress);
    handleTransferBatch(event);

    assert.fieldEquals(
      "UserEpochEligibility",
      from.toHexString() + "-1-" + collectionAddress.toHexString(),
      "nftBalance",
      BigInt.fromI32(15).toString() // (10+20) - (5+10) = 15
    );
    assert.fieldEquals(
      "UserEpochEligibility",
      to.toHexString() + "-1-" + collectionAddress.toHexString(),
      "nftBalance",
      BigInt.fromI32(15).toString() // 5 + 10 = 15
    );
  });

  test("should not update nftBalance for zero address transfers in TransferBatch", () => {
    const operator = Address.fromString("0x0000000000000000000000000000000000000001");
    const from = Address.fromString(ADDRESS_ZERO_STR);
    const to = Address.fromString(ADDRESS_ZERO_STR);
    const ids = [BigInt.fromI32(1), BigInt.fromI32(2)];
    const values = [BigInt.fromI32(10), BigInt.fromI32(20)];
    const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000005");

    createMockCollection(collectionAddress);

    const event = newTransferBatchEvent(operator, from, to, ids, values, collectionAddress);
    handleTransferBatch(event);

    assert.notInStore("Account", from.toHexString());
    assert.notInStore("Account", to.toHexString());
  });
});
*/
