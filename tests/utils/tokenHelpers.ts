import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt, Bytes } from "@graphprotocol/graph-ts";

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
  event.parameters.push(new ethereum.EventParam("oldValue", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))));
  event.parameters.push(new ethereum.EventParam("trigger", ethereum.Value.fromAddress(trigger)));
  return event;
}

export function newMerkleRootUpdatedEvent(vault: Address, root: Bytes, updatedBy: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("vaultAddress", ethereum.Value.fromAddress(vault)));
  event.parameters.push(new ethereum.EventParam("merkleRoot", ethereum.Value.fromBytes(root)));
  event.parameters.push(new ethereum.EventParam("updatedBy", ethereum.Value.fromAddress(updatedBy)));
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

// CollectionRegistry Event Helpers

export function newCollectionRegisteredEvent(
  collection: Address,
  collectionType: i32,
  weightFunctionType: i32,
  p1: BigInt,
  p2: BigInt,
  yieldSharePercentage: i32
): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
  event.parameters.push(new ethereum.EventParam("collectionType", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(collectionType))));
  event.parameters.push(new ethereum.EventParam("weightFunctionType", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(weightFunctionType))));
  event.parameters.push(new ethereum.EventParam("p1", ethereum.Value.fromSignedBigInt(p1)));
  event.parameters.push(new ethereum.EventParam("p2", ethereum.Value.fromSignedBigInt(p2)));
  event.parameters.push(new ethereum.EventParam("yieldSharePercentage", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(yieldSharePercentage))));
  return event;
}

export function newYieldShareUpdatedEvent(collection: Address, oldShare: i32, newShare: i32): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
  event.parameters.push(new ethereum.EventParam("oldShare", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(oldShare))));
  event.parameters.push(new ethereum.EventParam("newShare", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newShare))));
  return event;
}

export function newWeightFunctionUpdatedEvent(
  collection: Address,
  weightFunctionType: i32,
  p1: BigInt,
  p2: BigInt
): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
  event.parameters.push(new ethereum.EventParam("weightFunctionType", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(weightFunctionType))));
  event.parameters.push(new ethereum.EventParam("p1", ethereum.Value.fromSignedBigInt(p1)));
  event.parameters.push(new ethereum.EventParam("p2", ethereum.Value.fromSignedBigInt(p2)));
  return event;
}

export function newVaultAddedToCollectionEvent(collection: Address, vault: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
  event.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(vault)));
  return event;
}

export function newVaultRemovedFromCollectionEvent(collection: Address, vault: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
  event.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(vault)));
  return event;
}

export function newCollectionRemovedEvent(collection: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
  return event;
}

export function newCollectionReactivatedEvent(collection: Address): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
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

export function newERC1155TransferBatchEvent(operator: Address, from: Address, to: Address, values: BigInt[]): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator)));
  event.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
  event.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
  event.parameters.push(new ethereum.EventParam("ids", ethereum.Value.fromUnsignedBigIntArray(values)));
  event.parameters.push(new ethereum.EventParam("values", ethereum.Value.fromUnsignedBigIntArray(values)));
  return event;
}
