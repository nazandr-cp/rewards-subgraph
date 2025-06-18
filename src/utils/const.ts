import { BigInt } from "@graphprotocol/graph-ts";

export const ZERO_BI = BigInt.fromI32(0);
export const ADDRESS_ZERO_STR = "0x0000000000000000000000000000000000000000";
export const BIGINT_1E18 = BigInt.fromString("1000000000000000000");

// Epoch Statuses (matching schema.graphql enum and EpochManager.sol enum order/meaning)
export const EPOCH_STATUS_ACTIVE = "ACTIVE";
export const EPOCH_STATUS_PROCESSING = "PROCESSING";
export const EPOCH_STATUS_COMPLETED = "COMPLETED";
export const EPOCH_STATUS_FAILED = "FAILED";

// System State ID
export const SYSTEM_STATE_ID = "SYSTEM";
