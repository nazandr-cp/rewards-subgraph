import { beforeEach, test, assert, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt } from "@graphprotocol/graph-ts";
import {
  handleEpochStarted,
  handleEpochProcessingStarted,
  handleEpochFinalized,
  handleEpochFailed,
  handleEpochManagerVaultYieldAllocated
} from "../../src/epoch-manager-mapping";
import {
  EpochStarted,
  EpochProcessingStarted,
  EpochFinalized,
  EpochFailed,
  VaultYieldAllocated
} from "../../generated/EpochManager/EpochManager";
import {
  newEpochStartedEvent,
  newEpochProcessingStartedEvent,
  newEpochFinalizedEvent,
  newEpochFailedEvent,
  newVaultYieldAllocatedEvent
} from "../utils/epochHelpers";
import { CollectionsVault, Epoch, EpochVaultAllocation, SystemState } from "../../generated/schema";

const MOCK_VAULT_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000004");

beforeEach(() => {
  clearStore();
});

test("handleEpochStarted: creates epoch and updates system state", () => {
  const event = newEpochStartedEvent(BigInt.fromI32(1), BigInt.fromI32(10), BigInt.fromI32(20));
  handleEpochStarted(changetype<EpochStarted>(event));

  assert.fieldEquals("Epoch", "1", "epochNumber", "1");
  assert.fieldEquals("Epoch", "1", "status", "ACTIVE");
  assert.fieldEquals("SystemState", "SYSTEM", "activeEpochId", "1");
});

test("handleEpochProcessingStarted: creates stub if epoch missing", () => {
  const event = newEpochProcessingStartedEvent(BigInt.fromI32(2));
  handleEpochProcessingStarted(changetype<EpochProcessingStarted>(event));

  assert.fieldEquals("Epoch", "2", "status", "PROCESSING");
});

test("handleEpochFinalized: updates epoch and clears system state", () => {
  const epoch = new Epoch("3");
  epoch.epochNumber = BigInt.fromI32(3);
  epoch.startTimestamp = BigInt.fromI32(0);
  epoch.endTimestamp = BigInt.fromI32(0);
  epoch.totalYieldAvailable = BigInt.fromI32(0);
  epoch.totalYieldAllocated = BigInt.fromI32(0);
  epoch.totalYieldDistributed = BigInt.fromI32(0);
  epoch.remainingYield = BigInt.fromI32(0);
  epoch.totalSubsidiesDistributed = BigInt.fromI32(0);
  epoch.totalEligibleUsers = BigInt.fromI32(0);
  epoch.totalParticipatingCollections = BigInt.fromI32(0);
  epoch.status = "ACTIVE";
  epoch.createdAtBlock = BigInt.fromI32(0);
  epoch.createdAtTimestamp = BigInt.fromI32(0);
  epoch.updatedAtBlock = BigInt.fromI32(0);
  epoch.updatedAtTimestamp = BigInt.fromI32(0);
  epoch.participantCount = BigInt.fromI32(0);
  epoch.epochManager = Address.fromString("0x0000000000000000000000000000000000000006").toHexString();
  epoch.save();

  const sys = new SystemState("SYSTEM");
  sys.activeEpochId = "3";
  sys.totalVaults = BigInt.fromI32(0);
  sys.totalCollections = BigInt.fromI32(0);
  sys.totalUsers = BigInt.fromI32(0);
  sys.totalValueLocked = BigInt.fromI32(0);
  sys.totalYieldDistributed = BigInt.fromI32(0);
  sys.totalSubsidiesDistributed = BigInt.fromI32(0);
  sys.systemUtilizationRate = BigInt.fromI32(0);
  sys.averageAPY = BigInt.fromI32(0);
  sys.lastUpdatedBlock = BigInt.fromI32(0);
  sys.lastUpdatedTimestamp = BigInt.fromI32(0);
  sys.save();

  const event = newEpochFinalizedEvent(BigInt.fromI32(3), BigInt.fromI32(100), BigInt.fromI32(10));
  handleEpochFinalized(changetype<EpochFinalized>(event));

  assert.fieldEquals("Epoch", "3", "totalYieldAvailable", "100");
  assert.fieldEquals("Epoch", "3", "totalSubsidiesDistributed", "10");
  assert.fieldEquals("Epoch", "3", "status", "COMPLETED");
  assert.fieldEquals("SystemState", "SYSTEM", "activeEpochId", "null");
});

test("handleEpochFailed: unknown epoch", () => {
  const event = newEpochFailedEvent(BigInt.fromI32(5));
  handleEpochFailed(changetype<EpochFailed>(event));
  assert.notInStore("Epoch", "5");
});

test("handleEpochManagerVaultYieldAllocated: creates allocation", () => {
  const epoch = new Epoch("7");
  epoch.epochNumber = BigInt.fromI32(7);
  epoch.startTimestamp = BigInt.fromI32(0);
  epoch.endTimestamp = BigInt.fromI32(0);
  epoch.totalYieldAvailable = BigInt.fromI32(0);
  epoch.totalYieldAllocated = BigInt.fromI32(0);
  epoch.totalYieldDistributed = BigInt.fromI32(0);
  epoch.remainingYield = BigInt.fromI32(0);
  epoch.totalSubsidiesDistributed = BigInt.fromI32(0);
  epoch.totalEligibleUsers = BigInt.fromI32(0);
  epoch.totalParticipatingCollections = BigInt.fromI32(0);
  epoch.status = "ACTIVE";
  epoch.createdAtBlock = BigInt.fromI32(0);
  epoch.createdAtTimestamp = BigInt.fromI32(0);
  epoch.updatedAtBlock = BigInt.fromI32(0);
  epoch.updatedAtTimestamp = BigInt.fromI32(0);
  epoch.participantCount = BigInt.fromI32(0);
  epoch.epochManager = Address.fromString("0x0000000000000000000000000000000000000006").toHexString();
  epoch.save();

  const vault = new CollectionsVault(MOCK_VAULT_ADDRESS.toHexString());
  vault.cTokenMarket = "";
  vault.totalShares = BigInt.fromI32(0);
  vault.totalDeposits = BigInt.fromI32(0);
  vault.totalCTokens = BigInt.fromI32(0);
  vault.globalDepositIndex = BigInt.fromI32(0);
  vault.totalPrincipalDeposited = BigInt.fromI32(0);
  vault.collectionRegistry = "";
  vault.epochManager = "";
  vault.lendingManager = "";
  vault.debtSubsidizer = "";
  vault.createdAtBlock = BigInt.fromI32(0);
  vault.createdAtTimestamp = BigInt.fromI32(0);
  vault.updatedAtBlock = BigInt.fromI32(0);
  vault.updatedAtTimestamp = BigInt.fromI32(0);
  vault.save();

  const event = newVaultYieldAllocatedEvent(BigInt.fromI32(7), MOCK_VAULT_ADDRESS, BigInt.fromI32(50));
  handleEpochManagerVaultYieldAllocated(changetype<VaultYieldAllocated>(event));

  const allocationId = "7-" + MOCK_VAULT_ADDRESS.toHexString();
  assert.fieldEquals("EpochVaultAllocation", allocationId, "yieldAllocated", "50");
  assert.fieldEquals("Epoch", "7", "totalYieldAvailable", "50");
});
