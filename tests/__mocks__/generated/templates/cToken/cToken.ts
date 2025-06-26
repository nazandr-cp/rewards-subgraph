import { Address, BigInt } from "@graphprotocol/graph-ts";

export class EthereumCallResult<T> {
  reverted: boolean;
  value: T;
  constructor(reverted: boolean, value: T) {
    this.reverted = reverted;
    this.value = value;
  }
}

export class cToken {
  address: Address;
  constructor(addr: Address) { this.address = addr; }
  static bind(addr: Address): cToken { return new cToken(addr); }
  try_balanceOf(user: Address): EthereumCallResult<BigInt> { return new EthereumCallResult(false, BigInt.fromI32(0)); }
  try_exchangeRateStored(): EthereumCallResult<BigInt> { return new EthereumCallResult(false, BigInt.fromI32(1)); }
  try_borrowBalanceStored(user: Address): EthereumCallResult<BigInt> { return new EthereumCallResult(false, BigInt.fromI32(0)); }
  try_totalBorrows(): EthereumCallResult<BigInt> { return new EthereumCallResult(false, BigInt.fromI32(0)); }
  try_protocolSeizeShareMantissa(): EthereumCallResult<BigInt> { return new EthereumCallResult(false, BigInt.fromI32(0)); }
}
