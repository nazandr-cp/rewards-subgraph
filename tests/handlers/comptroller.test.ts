import { beforeEach, test, assert, clearStore, createMockedFunction } from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import { handleMarketListed, handleMarketEntered } from "../../src/comptroller-mapping";
import { MarketListed, MarketEntered } from "../../generated/Comptroller/Comptroller";
import { newMarketListedEvent, newMarketEnteredEvent } from "../utils/tokenHelpers";
import { CTokenMarket } from "../../generated/schema";

const CTOKEN = Address.fromString("0x00000000000000000000000000000000000000b1");
const USER = Address.fromString("0x00000000000000000000000000000000000000b2");

beforeEach(() => {
  clearStore();
});

test("handleMarketListed", () => {
  const event = changetype<MarketListed>(newMarketListedEvent(CTOKEN));
  createMockedFunction(CTOKEN, "decimals", "decimals():(uint8)").returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(8))]);
  createMockedFunction(CTOKEN, "exchangeRateStored", "exchangeRateStored():(uint256)").returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))]);
  createMockedFunction(CTOKEN, "symbol", "symbol():(string)").returns([ethereum.Value.fromString("cMOCK")]);
  createMockedFunction(CTOKEN, "name", "name():(string)").returns([ethereum.Value.fromString("Mock")]);
  handleMarketListed(event);
  assert.fieldEquals("CTokenMarket", CTOKEN.toHexString(), "decimals", "8");
});

test("handleMarketEntered", () => {
  const event = changetype<MarketEntered>(newMarketEnteredEvent(USER, CTOKEN));
  handleMarketEntered(event);
  // handler only logs, ensure market entity was not created
  assert.notInStore("CTokenMarket", CTOKEN.toHexString());
});
