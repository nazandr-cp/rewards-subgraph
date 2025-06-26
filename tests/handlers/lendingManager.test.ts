import { beforeEach, test, assert, clearStore } from "matchstick-as/assembly/index";
import { Address } from "@graphprotocol/graph-ts";
import { handleDepositToProtocol, handleWithdrawFromProtocol, handlePrincipalReset } from "../../src/lending-manager-mapping";
import { DepositToProtocol, WithdrawFromProtocol, PrincipalReset } from "../../generated/LendingManager/LendingManager";
import { newDepositToProtocolEvent, newWithdrawFromProtocolEvent, newPrincipalResetEvent } from "../utils/tokenHelpers";

const USER = Address.fromString("0x00000000000000000000000000000000000000aa");

beforeEach(() => {
  clearStore();
});

test("handleDepositToProtocol creates account", () => {
  const event = newDepositToProtocolEvent(USER);
  handleDepositToProtocol(changetype<DepositToProtocol>(event));
  assert.fieldEquals("Account", USER.toHexString(), "id", USER.toHexString());
});

test("handleWithdrawFromProtocol creates account", () => {
  const event = newWithdrawFromProtocolEvent(USER);
  handleWithdrawFromProtocol(changetype<WithdrawFromProtocol>(event));
  assert.fieldEquals("Account", USER.toHexString(), "id", USER.toHexString());
});

test("handlePrincipalReset creates account", () => {
  const event = newPrincipalResetEvent(USER);
  handlePrincipalReset(changetype<PrincipalReset>(event));
  assert.fieldEquals("Account", USER.toHexString(), "id", USER.toHexString());
});
