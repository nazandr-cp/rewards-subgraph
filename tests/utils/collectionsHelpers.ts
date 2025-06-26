import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";
import { CollectionDeposit } from "../../generated/templates/CollectionVault/CollectionVault"; // Import the specific event type

export function newCollectionDepositEvent(
  caller: Address,
  receiver: Address,
  assets: BigInt,
  shares: BigInt,
  cTokenAmount: BigInt,
  collectionAddress: Address
): CollectionDeposit {
  const event = changetype<CollectionDeposit>(newMockEvent());

  event.parameters = [];

  event.parameters.push(
    new ethereum.EventParam(
      "collectionAddress",
      ethereum.Value.fromAddress(collectionAddress)
    )
  );
  event.parameters.push(
    new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller))
  );
  event.parameters.push(
    new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver))
  );
  event.parameters.push(
    new ethereum.EventParam(
      "assets",
      ethereum.Value.fromUnsignedBigInt(assets)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "shares",
      ethereum.Value.fromUnsignedBigInt(shares)
    )
  );
  event.parameters.push(
    new ethereum.EventParam(
      "cTokenAmount",
      ethereum.Value.fromUnsignedBigInt(cTokenAmount)
    )
  );

  return event;
}

export function newCollectionWithdrawEvent(
  caller: Address,
  receiver: Address,
  assets: BigInt,
  shares: BigInt,
  cTokenAmount: BigInt,
  collectionAddress: Address
): ethereum.Event {
  const event = newMockEvent();

  event.parameters = [];

  event.parameters.push(
    new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller))
  );
  event.parameters.push(
    new ethereum.EventParam("receiver", ethereum.Value.fromAddress(receiver))
  );
  event.parameters.push(
    new ethereum.EventParam("assets", ethereum.Value.fromUnsignedBigInt(assets))
  );
  event.parameters.push(
    new ethereum.EventParam("shares", ethereum.Value.fromUnsignedBigInt(shares))
  );
  event.parameters.push(
    new ethereum.EventParam("cTokenAmount", ethereum.Value.fromUnsignedBigInt(cTokenAmount))
  );
  event.parameters.push(
    new ethereum.EventParam("collectionAddress", ethereum.Value.fromAddress(collectionAddress))
  );

  return event;
}

export function newVaultYieldAllocatedToEpochEvent(
  epochId: BigInt,
  amount: BigInt
): ethereum.Event {
  const event = newMockEvent();

  event.parameters = [];

  event.parameters.push(
    new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId))
  );
  event.parameters.push(
    new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount))
  );

  return event;
}

export function newCollectionYieldAccruedEvent(
  collection: Address,
  yieldAmount: BigInt,
  globalDepositIndex: BigInt,
  lastGlobalDepositIndex: BigInt,
  totalAccrued: BigInt
): ethereum.Event {
  const event = newMockEvent();

  event.parameters = [];

  event.parameters.push(
    new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection))
  );
  event.parameters.push(
    new ethereum.EventParam("yieldAmount", ethereum.Value.fromUnsignedBigInt(yieldAmount))
  );
  event.parameters.push(
    new ethereum.EventParam("globalDepositIndex", ethereum.Value.fromUnsignedBigInt(globalDepositIndex))
  );
  event.parameters.push(
    new ethereum.EventParam("lastGlobalDepositIndex", ethereum.Value.fromUnsignedBigInt(lastGlobalDepositIndex))
  );
  event.parameters.push(
    new ethereum.EventParam("totalAccrued", ethereum.Value.fromUnsignedBigInt(totalAccrued))
  );

  return event;
}

export function newYieldBatchRepaidEvent(
  totalYieldRepaid: BigInt,
  recipient: Address
): ethereum.Event {
  const event = newMockEvent();

  event.parameters = [];

  event.parameters.push(
    new ethereum.EventParam("totalYieldRepaid", ethereum.Value.fromUnsignedBigInt(totalYieldRepaid))
  );
  event.parameters.push(
    new ethereum.EventParam("recipient", ethereum.Value.fromAddress(recipient))
  );

  return event;
}

export function newCollectionYieldAppliedForEpochEvent(
  epochId: BigInt,
  collection: Address,
  yieldSharePercentage: BigInt,
  yieldAdded: BigInt,
  newTotalDeposits: BigInt
): ethereum.Event {
  const event = newMockEvent();

  event.parameters = [];

  event.parameters.push(
    new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId))
  );
  event.parameters.push(
    new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection))
  );
  event.parameters.push(
    new ethereum.EventParam("yieldSharePercentage", ethereum.Value.fromI32(yieldSharePercentage.toI32()))
  );
  event.parameters.push(
    new ethereum.EventParam("yieldAdded", ethereum.Value.fromUnsignedBigInt(yieldAdded))
  );
  event.parameters.push(
    new ethereum.EventParam("newTotalDeposits", ethereum.Value.fromUnsignedBigInt(newTotalDeposits))
  );

  return event;
}