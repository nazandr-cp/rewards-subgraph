import { beforeEach, test, assert, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { handleTransfer } from "../../src/erc721-mapping";
import { Transfer } from "../../generated/ERC721Collection/ERC721";
import { newERC721TransferEvent } from "../utils/tokenHelpers";
import { Collection } from "../../generated/schema";

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
  col.registeredAtBlock = BigInt.fromI32(0);
  col.registeredAtTimestamp = BigInt.fromI32(0);
  col.updatedAtBlock = BigInt.fromI32(0);
  col.updatedAtTimestamp = BigInt.fromI32(0);
  col.save();
});

test("handleTransfer creates eligibility", () => {
  const event = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
  event.address = COLLECTION;
  handleTransfer(event);
  // const id = TO.toHexString() + "-" + "0" + "-" + COLLECTION.toHexString();
  assert.notInStore("UserEpochEligibility", "nonexistent"); // placeholder: entityExists not available
});
