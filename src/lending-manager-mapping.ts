import {
  DepositToProtocol,
  WithdrawFromProtocol,
  PrincipalReset,
} from "../generated/LendingManager/LendingManager";
import { getOrCreateAccount } from "./utils/getters";

export function handleDepositToProtocol(event: DepositToProtocol): void {
  getOrCreateAccount(event.params.caller);
}

export function handleWithdrawFromProtocol(event: WithdrawFromProtocol): void {
  getOrCreateAccount(event.params.caller);
}

export function handlePrincipalReset(event: PrincipalReset): void {
  getOrCreateAccount(event.params.trigger);
}