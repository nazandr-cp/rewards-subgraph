import {
  DepositToProtocol,
  WithdrawFromProtocol,
  PrincipalReset,
} from "../generated/LendingManager/LendingManager";
import { getOrCreateAccount } from "./utils/getters";

export function handleDepositToProtocol(event: DepositToProtocol): void {
  // Ensure account exists for the caller
  getOrCreateAccount(event.params.caller);
}

export function handleWithdrawFromProtocol(event: WithdrawFromProtocol): void {
  // Ensure account exists for the caller
  getOrCreateAccount(event.params.caller);
}

export function handlePrincipalReset(event: PrincipalReset): void {
  // Ensure account exists for the trigger
  getOrCreateAccount(event.params.trigger);
}