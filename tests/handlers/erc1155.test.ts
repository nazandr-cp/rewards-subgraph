import { beforeEach, test, assert, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { handleTransferSingle } from "../../src/erc1155-mapping";
import { TransferSingle } from "../../generated/ERC1155Collection/ERC1155";
import { newERC1155TransferSingleEvent } from "../utils/tokenHelpers";
import { Collection } from "../../generated/schema";

const COLLECTION = Address.fromString("0x00000000000000000000000000000000000000e1");
const FROM = Address.fromString("0x00000000000000000000000000000000000000e2");
const TO = Address.fromString("0x00000000000000000000000000000000000000e3");

beforeEach(() => {
  clearStore();
  const col = new Collection(COLLECTION.toHexString());
  col.contractAddress = COLLECTION;
  col.registry = Address.fromString("0x00000000000000000000000000000000000000a0").toHexString();
  col.isActive = true;
  col.save();
});

test("handleTransferSingle updates subsidies", () => {
  const event = changetype<TransferSingle>(newERC1155TransferSingleEvent(FROM, FROM, TO, BigInt.fromI32(1), BigInt.fromI32(1)));
  event.address = COLLECTION;
  handleTransferSingle(event);
  const id = TO.toHexString() + "-" + COLLECTION.toHexString();
  assert.entityExists("AccountSubsidiesPerCollection", id);
});
