import { newMockEvent } from "matchstick-as";
import { ethereum, Address, BigInt } from "@graphprotocol/graph-ts";

export function newEpochStartedEvent(
  epochId: BigInt,
  startTime: BigInt,
  endTime: BigInt
): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId)));
  event.parameters.push(new ethereum.EventParam("startTime", ethereum.Value.fromUnsignedBigInt(startTime)));
  event.parameters.push(new ethereum.EventParam("endTime", ethereum.Value.fromUnsignedBigInt(endTime)));
  return event;
}

export function newEpochProcessingStartedEvent(epochId: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId)));
  return event;
}

export function newEpochFinalizedEvent(
  epochId: BigInt,
  totalYieldAvailable: BigInt,
  totalSubsidiesDistributed: BigInt
): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId)));
  event.parameters.push(new ethereum.EventParam("totalYieldAvailable", ethereum.Value.fromUnsignedBigInt(totalYieldAvailable)));
  event.parameters.push(new ethereum.EventParam("totalSubsidiesDistributed", ethereum.Value.fromUnsignedBigInt(totalSubsidiesDistributed)));
  return event;
}

export function newEpochFailedEvent(epochId: BigInt): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId)));
  event.parameters.push(new ethereum.EventParam("reason", ethereum.Value.fromString("")));
  return event;
}

export function newVaultYieldAllocatedEvent(
  epochId: BigInt,
  vault: Address,
  amount: BigInt
): ethereum.Event {
  const event = newMockEvent();
  event.parameters = [];
  event.parameters.push(new ethereum.EventParam("epochId", ethereum.Value.fromUnsignedBigInt(epochId)));
  event.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(vault)));
  event.parameters.push(new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount)));
  return event;
}
