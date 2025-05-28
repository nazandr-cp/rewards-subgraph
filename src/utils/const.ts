import { Address, BigInt } from "@graphprotocol/graph-ts";

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ADDRESS_ZERO_STR = "0x0000000000000000000000000000000000000000";
export const ZERO_ADDRESS = Address.fromString(ADDRESS_ZERO_STR);
export const WAD = BigInt.fromI32(1).times(BigInt.fromI32(10).pow(18)); // 1 * 10^18
