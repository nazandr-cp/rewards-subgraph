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
  col.save();
});

test("handleTransfer creates eligibility", () => {
  const event = changetype<Transfer>(newERC721TransferEvent(FROM, TO, BigInt.fromI32(1)));
  event.address = COLLECTION;
  handleTransfer(event);
  const id = TO.toHexString() + "-" + "0" + "-" + COLLECTION.toHexString();
  assert.entityExists("UserEpochEligibility", id);
});
