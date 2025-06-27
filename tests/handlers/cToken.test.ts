import { beforeEach, test, assert, clearStore, createMockedFunction } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
import {
  handleMint,
  handleRedeem,
  handleBorrow,
  handleRepayBorrow,
  handleTransfer,
  handleAccrueInterest,
  handleLiquidateBorrow
} from "../../src/cToken-mapping";
import {
  Mint,
  Redeem,
  Borrow,
  RepayBorrow,
  Transfer,
  AccrueInterest,
  LiquidateBorrow
} from "../../generated/templates/cToken/cToken";
import {
  newMintEvent,
  newRedeemEvent,
  newBorrowEvent,
  newRepayBorrowEvent,
  newTransferEvent,
  newAccrueInterestEvent,
  newLiquidateBorrowEvent
} from "../utils/tokenHelpers";
import { AccountMarket, CTokenMarket } from "../../generated/schema";

const CTOKEN_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000011");
const OTHER_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000012");
const COLLATERAL_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000013");

function createMarket(): void {
  const market = new CTokenMarket(CTOKEN_ADDRESS.toHexString());
  market.symbol = "cMOCK";
  market.name = "mock";
  market.decimals = 8;
  market.totalSupply = BigInt.fromI32(0);
  market.totalBorrows = BigInt.fromI32(0);
  market.totalReserves = BigInt.fromI32(0);
  market.exchangeRate = BigInt.fromI32(1);
  market.interestAccumulated = BigInt.fromI32(0);
  market.cashPrior = BigInt.fromI32(0);
  market.borrowIndex = BigInt.fromI32(0);
  market.collateralFactor = BigInt.fromI32(0);
  market.lastExchangeRateTimestamp = BigInt.fromI32(0);
  market.updatedAtBlock = BigInt.fromI32(0);
  market.updatedAtTimestamp = BigInt.fromI32(0);
  market.liquidationIncentive = BigInt.fromI32(0);
  market.reserveFactor = BigInt.fromI32(0);
  market.baseRatePerBlock = BigInt.fromI32(0);
  market.multiplierPerBlock = BigInt.fromI32(0);
  market.jumpMultiplierPerBlock = BigInt.fromI32(0);
  market.kink = BigInt.fromI32(0);
  market.save();
}

beforeEach(() => {
  clearStore();
  createMarket();
});

test("handleMint", () => {
  const event = newMintEvent(OTHER_ADDRESS, BigInt.fromI32(100));
  event.address = CTOKEN_ADDRESS;
  createMockedFunction(CTOKEN_ADDRESS, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
  ]);
  handleMint(changetype<Mint>(event));
  const id = OTHER_ADDRESS.toHexString() + "-" + CTOKEN_ADDRESS.toHexString();
  assert.fieldEquals("AccountMarket", id, "supplyBalance", "100");
});

test("handleRedeem", () => {
  const id = OTHER_ADDRESS.toHexString() + "-" + CTOKEN_ADDRESS.toHexString();
  const am = new AccountMarket(id);
  am.account = OTHER_ADDRESS.toHexString();
  am.cTokenMarket = CTOKEN_ADDRESS.toHexString();
  am.supplyBalance = BigInt.fromI32(200);
  am.borrowBalance = BigInt.fromI32(0);
  am.collateralBalance = BigInt.fromI32(0);
  am.supplyIndex = BigInt.fromI32(0);
  am.borrowIndex = BigInt.fromI32(0);
  am.enteredMarketBlock = BigInt.fromI32(0);
  am.enteredMarketTimestamp = BigInt.fromI32(0);
  am.updatedAtBlock = BigInt.fromI32(0);
  am.updatedAtTimestamp = BigInt.fromI32(0);
  am.save();
  const event = newRedeemEvent(OTHER_ADDRESS, BigInt.fromI32(50));
  event.address = CTOKEN_ADDRESS;
  createMockedFunction(CTOKEN_ADDRESS, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
  ]);
  handleRedeem(changetype<Redeem>(event));
  assert.fieldEquals("AccountMarket", id, "supplyBalance", "150");
});

test("handleBorrow", () => {
  const event = newBorrowEvent(OTHER_ADDRESS, BigInt.fromI32(10), BigInt.fromI32(10), BigInt.fromI32(10));
  event.address = CTOKEN_ADDRESS;
  handleBorrow(changetype<Borrow>(event));
  const id = OTHER_ADDRESS.toHexString() + "-" + CTOKEN_ADDRESS.toHexString();
  assert.fieldEquals("AccountMarket", id, "borrowBalance", "10");
});

test("handleRepayBorrow", () => {
  const id = OTHER_ADDRESS.toHexString() + "-" + CTOKEN_ADDRESS.toHexString();
  const am = new AccountMarket(id);
  am.account = OTHER_ADDRESS.toHexString();
  am.cTokenMarket = CTOKEN_ADDRESS.toHexString();
  am.supplyBalance = BigInt.fromI32(0);
  am.borrowBalance = BigInt.fromI32(20);
  am.collateralBalance = BigInt.fromI32(0);
  am.supplyIndex = BigInt.fromI32(0);
  am.borrowIndex = BigInt.fromI32(0);
  am.enteredMarketBlock = BigInt.fromI32(0);
  am.enteredMarketTimestamp = BigInt.fromI32(0);
  am.updatedAtBlock = BigInt.fromI32(0);
  am.updatedAtTimestamp = BigInt.fromI32(0);
  am.save();
  const event = newRepayBorrowEvent(OTHER_ADDRESS, OTHER_ADDRESS, BigInt.fromI32(5), BigInt.fromI32(15), BigInt.fromI32(100));
  event.address = CTOKEN_ADDRESS;
  createMockedFunction(CTOKEN_ADDRESS, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))
  ]);
  handleRepayBorrow(changetype<RepayBorrow>(event));
  assert.fieldEquals("AccountMarket", id, "borrowBalance", "15");
});

test("handleTransfer", () => {
  const event = newTransferEvent(OTHER_ADDRESS, CTOKEN_ADDRESS, BigInt.fromI32(10));
  event.address = CTOKEN_ADDRESS;
  // Use 1e18 (10^18) as exchange rate so that 10 cTokens = 10 underlying
  const exchangeRate = BigInt.fromString("1000000000000000000"); // 1e18
  createMockedFunction(CTOKEN_ADDRESS, "exchangeRateStored", "exchangeRateStored():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(exchangeRate)
  ]);
  createMockedFunction(CTOKEN_ADDRESS, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))
  ]);
  handleTransfer(changetype<Transfer>(event));
  const id = OTHER_ADDRESS.toHexString() + "-" + CTOKEN_ADDRESS.toHexString();
  assert.fieldEquals("AccountMarket", id, "supplyBalance", "-10");
});

test("handleAccrueInterest", () => {
  const event = newAccrueInterestEvent(BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1), BigInt.fromI32(1));
  event.address = CTOKEN_ADDRESS;
  createMockedFunction(CTOKEN_ADDRESS, "exchangeRateStored", "exchangeRateStored():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2))
  ]);
  handleAccrueInterest(changetype<AccrueInterest>(event));
  assert.fieldEquals("CTokenMarket", CTOKEN_ADDRESS.toHexString(), "exchangeRate", "2");
});

test("handleLiquidateBorrow", () => {
  const event = newLiquidateBorrowEvent(OTHER_ADDRESS, OTHER_ADDRESS, BigInt.fromI32(5), COLLATERAL_ADDRESS, BigInt.fromI32(1));
  event.address = CTOKEN_ADDRESS;
  createMockedFunction(CTOKEN_ADDRESS, "totalBorrows", "totalBorrows():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(10))
  ]);
  createMockedFunction(COLLATERAL_ADDRESS, "exchangeRateStored", "exchangeRateStored():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1))
  ]);
  createMockedFunction(COLLATERAL_ADDRESS, "protocolSeizeShareMantissa", "protocolSeizeShareMantissa():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))
  ]);
  createMockedFunction(COLLATERAL_ADDRESS, "totalSupply", "totalSupply():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))
  ]);
  createMockedFunction(COLLATERAL_ADDRESS, "totalReserves", "totalReserves():(uint256)").returns([
    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))
  ]);
  handleLiquidateBorrow(changetype<LiquidateBorrow>(event));
  const id = OTHER_ADDRESS.toHexString() + "-" + COLLATERAL_ADDRESS.toHexString();
  assert.fieldEquals("AccountMarket", id, "id", id);
});
