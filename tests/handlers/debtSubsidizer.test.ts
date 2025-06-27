import { beforeEach, test, assert, clearStore } from "matchstick-as/assembly/index";
import { Address, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { handleMerkleRootUpdated, handleSubsidyClaimed } from "../../src/debt-subsidizer-mapping";
import { MerkleRootUpdated, SubsidyClaimed } from "../../generated/DebtSubsidizer/DebtSubsidizer";
import { newMerkleRootUpdatedEvent, newSubsidyClaimedEvent } from "../utils/tokenHelpers";
import { SystemState, Epoch, CollectionsVault } from "../../generated/schema";

const VAULT = Address.fromString("0x00000000000000000000000000000000000000c1");
const USER = Address.fromString("0x00000000000000000000000000000000000000c2");

beforeEach(() => {
  clearStore();
  const state = new SystemState("SYSTEM");
  state.activeEpochId = "1";
  state.totalVaults = BigInt.fromI32(0);
  state.totalCollections = BigInt.fromI32(0);
  state.totalUsers = BigInt.fromI32(0);
  state.totalValueLocked = BigInt.fromI32(0);
  state.totalYieldDistributed = BigInt.fromI32(0);
  state.totalSubsidiesDistributed = BigInt.fromI32(0);
  state.systemUtilizationRate = BigInt.fromI32(0);
  state.averageAPY = BigInt.fromI32(0);
  state.lastUpdatedBlock = BigInt.fromI32(0);
  state.lastUpdatedTimestamp = BigInt.fromI32(0);
  state.save();
  const epoch = new Epoch("1");
  epoch.epochNumber = BigInt.fromI32(1);
  epoch.startTimestamp = BigInt.fromI32(0);
  epoch.endTimestamp = BigInt.fromI32(0);
  epoch.totalYieldAvailable = BigInt.fromI32(0);
  epoch.totalYieldAllocated = BigInt.fromI32(0);
  epoch.totalYieldDistributed = BigInt.fromI32(0);
  epoch.remainingYield = BigInt.fromI32(0);
  epoch.totalSubsidiesDistributed = BigInt.fromI32(0);
  epoch.totalEligibleUsers = BigInt.fromI32(0);
  epoch.totalParticipatingCollections = BigInt.fromI32(0);
  epoch.participantCount = BigInt.fromI32(0);
  epoch.status = "ACTIVE";
  epoch.createdAtBlock = BigInt.fromI32(0);
  epoch.createdAtTimestamp = BigInt.fromI32(0);
  epoch.updatedAtBlock = BigInt.fromI32(0);
  epoch.updatedAtTimestamp = BigInt.fromI32(0);
  epoch.epochManager = "";
  epoch.save();
  const vault = new CollectionsVault(VAULT.toHexString());
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
});

test("handleMerkleRootUpdated", () => {
  const event = changetype<MerkleRootUpdated>(
    newMerkleRootUpdatedEvent(
      VAULT,
      Bytes.fromHexString("0x0000000000000000000000000000000000000000000000000000000000000001"),
      USER
    )
  );
  handleMerkleRootUpdated(event);
  const merkleDistributionId = "1-0x00000000000000000000000000000000000000c1";
  assert.fieldEquals(
    "MerkleDistribution",
    merkleDistributionId,
    "merkleRoot",
    "0x0000000000000000000000000000000000000000000000000000000000000001"
  );
  assert.fieldEquals("MerkleDistribution", merkleDistributionId, "totalAmount", "0");
  assert.fieldEquals("MerkleDistribution", merkleDistributionId, "totalClaims", "0");
});

test("handleSubsidyClaimed", () => {
  const event = changetype<SubsidyClaimed>(newSubsidyClaimedEvent(VAULT, USER, BigInt.fromI32(10)));
  handleSubsidyClaimed(event);
  const subsidyTxId = "CLAIMTX-" + event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  assert.fieldEquals("SubsidyDistribution", subsidyTxId, "subsidyAmount", "10");
  assert.fieldEquals("EpochVaultAllocation", "1-0x00000000000000000000000000000000000000c1", "subsidiesDistributed", "10");
});
