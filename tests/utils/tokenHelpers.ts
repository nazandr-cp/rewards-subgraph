import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";

export function newMintEvent(minter: Address, amount: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("minter", ethereum.Value.fromAddress(minter)));
  event.parameters.push(new ethereum.EventParam("mintAmount", ethereum.Value.fromUnsignedBigInt(amount)));
  event.parameters.push(new ethereum.EventParam("mintTokens", ethereum.Value.fromUnsignedBigInt(amount)));
  return event;
}

export function newRedeemEvent(redeemer: Address, amount: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("redeemer", ethereum.Value.fromAddress(redeemer)));
  event.parameters.push(new ethereum.EventParam("redeemAmount", ethereum.Value.fromUnsignedBigInt(amount)));
  event.parameters.push(new ethereum.EventParam("redeemTokens", ethereum.Value.fromUnsignedBigInt(amount)));
  return event;
}

export function newBorrowEvent(borrower: Address, borrowAmount: BigInt, accountBorrows: BigInt, totalBorrows: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower)));
  event.parameters.push(new ethereum.EventParam("borrowAmount", ethereum.Value.fromUnsignedBigInt(borrowAmount)));
  event.parameters.push(new ethereum.EventParam("accountBorrows", ethereum.Value.fromUnsignedBigInt(accountBorrows)));
  event.parameters.push(new ethereum.EventParam("totalBorrows", ethereum.Value.fromUnsignedBigInt(totalBorrows)));
  return event;
}

export function newRepayBorrowEvent(payer: Address, borrower: Address, repayAmount: BigInt, accountBorrows: BigInt, totalBorrows: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("payer", ethereum.Value.fromAddress(payer)));
  event.parameters.push(new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower)));
  event.parameters.push(new ethereum.EventParam("repayAmount", ethereum.Value.fromUnsignedBigInt(repayAmount)));
  event.parameters.push(new ethereum.EventParam("accountBorrows", ethereum.Value.fromUnsignedBigInt(accountBorrows)));
  event.parameters.push(new ethereum.EventParam("totalBorrows", ethereum.Value.fromUnsignedBigInt(totalBorrows)));
  return event;
}

export function newTransferEvent(from: Address, to: Address, amount: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));
  return event;
}

export function newAccrueInterestEvent(cashPrior: BigInt, interestAccumulated: BigInt, borrowIndex: BigInt, totalBorrows: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("cashPrior", ethereum.Value.fromUnsignedBigInt(cashPrior)));
  event.parameters.push(new ethereum.EventParam("interestAccumulated", ethereum.Value.fromUnsignedBigInt(interestAccumulated)));
  event.parameters.push(new ethereum.EventParam("borrowIndex", ethereum.Value.fromUnsignedBigInt(borrowIndex)));
  event.parameters.push(new ethereum.EventParam("totalBorrows", ethereum.Value.fromUnsignedBigInt(totalBorrows)));
  return event;
}

export function newLiquidateBorrowEvent(liquidator: Address, borrower: Address, repayAmount: BigInt, cTokenCollateral: Address, seizeTokens: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower)));
  event.parameters.push(new ethereum.EventParam("liquidator", ethereum.Value.fromAddress(liquidator)));
  event.parameters.push(new ethereum.EventParam("repayAmount", ethereum.Value.fromUnsignedBigInt(repayAmount)));
  event.parameters.push(new ethereum.EventParam("cTokenCollateral", ethereum.Value.fromAddress(cTokenCollateral)));
  event.parameters.push(new ethereum.EventParam("seizeTokens", ethereum.Value.fromUnsignedBigInt(seizeTokens)));
  return event;
}

export function newMarketListedEvent(cTokenAddr: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("cToken", ethereum.Value.fromAddress(cTokenAddr)));
  return event;
}

export function newMarketEnteredEvent(account: Address, cTokenAddr: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("cToken", ethereum.Value.fromAddress(cTokenAddr)));
  event.parameters.push(new ethereum.EventParam("account", ethereum.Value.fromAddress(account)));
  return event;
}

export function newDepositToProtocolEvent(caller: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller)));
  return event;
}

export function newWithdrawFromProtocolEvent(caller: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller)));
  return event;
}

export function newPrincipalResetEvent(trigger: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("trigger", ethereum.Value.fromAddress(trigger)));
  return event;
}

export function newMerkleRootUpdatedEvent(vault: Address, root: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("vaultAddress", ethereum.Value.fromAddress(vault)));
  event.parameters.push(new ethereum.EventParam("merkleRoot", ethereum.Value.fromUnsignedBigInt(root)));
  return event;
}

export function newSubsidyClaimedEvent(vault: Address, recipient: Address, amount: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("vaultAddress", ethereum.Value.fromAddress(vault)));
  event.parameters.push(new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));
  return event;
}

export function newERC721TransferEvent(from: Address, to: Address, tokenId: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(tokenId)));
  return event;
}

export function newERC1155TransferSingleEvent(operator: Address, from: Address, to: Address, id: BigInt, value: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)));
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id)));
  event.parameters.push(new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value)));
  return event;
}

export function newERC1155TransferBatchEvent(operator: Address, from: Address, to: Address, values: Array<BigInt>): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)));
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("ids", ethereum.Value.fromUnsignedBigIntArray(values)));
  event.parameters.push(new ethereum.EventParam("values", ethereum.Value.fromUnsignedBigIntArray(values)));
  return event;
}
