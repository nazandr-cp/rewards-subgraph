import {
  DepositToProtocol,
  WithdrawFromProtocol,
  PrincipalReset,
} from "../generated/LendingManager/LendingManager";
import { getOrCreateAccount } from "./utils/getters";
import { ZERO_BI } from "./utils/const";

export function handleDepositToProtocol(event: DepositToProtocol): void {
  const account = getOrCreateAccount(event.params.caller);

  if (account.firstInteractionBlock.equals(ZERO_BI)) {
    account.firstInteractionBlock = event.block.number;
    account.firstInteractionTimestamp = event.block.timestamp;
  }

  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();
}

export function handleWithdrawFromProtocol(event: WithdrawFromProtocol): void {
  const account = getOrCreateAccount(event.params.caller);

  if (account.firstInteractionBlock.equals(ZERO_BI)) {
    account.firstInteractionBlock = event.block.number;
    account.firstInteractionTimestamp = event.block.timestamp;
  }

  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();
}

export function handlePrincipalReset(event: PrincipalReset): void {
  const account = getOrCreateAccount(event.params.trigger);

  if (account.firstInteractionBlock.equals(ZERO_BI)) {
    account.firstInteractionBlock = event.block.number;
    account.firstInteractionTimestamp = event.block.timestamp;
  }

  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();
}