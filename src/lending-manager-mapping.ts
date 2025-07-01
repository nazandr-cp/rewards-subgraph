import {
  DepositToProtocol,
  WithdrawFromProtocol,
  PrincipalReset,
} from "../generated/LendingManager/LendingManager";
import { getOrCreateAccount } from "./utils/getters";
import { ZERO_BI } from "./utils/const";

export function handleDepositToProtocol(event: DepositToProtocol): void {
  const account = getOrCreateAccount(event.params.caller);

  if (account.createdAtBlock.equals(ZERO_BI)) {
    account.createdAtBlock = event.block.number;
    account.createdAtTimestamp = event.block.timestamp;
  }

  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();
}

export function handleWithdrawFromProtocol(event: WithdrawFromProtocol): void {
  const account = getOrCreateAccount(event.params.caller);

  if (account.createdAtBlock.equals(ZERO_BI)) {
    account.createdAtBlock = event.block.number;
    account.createdAtTimestamp = event.block.timestamp;
  }

  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();
}

export function handlePrincipalReset(event: PrincipalReset): void {
  const account = getOrCreateAccount(event.params.trigger);

  if (account.createdAtBlock.equals(ZERO_BI)) {
    account.createdAtBlock = event.block.number;
    account.createdAtTimestamp = event.block.timestamp;
  }

  account.updatedAtBlock = event.block.number;
  account.updatedAtTimestamp = event.block.timestamp;
  account.save();
}