import {
  DebtSubsidized,
  TrustedSignerUpdated,
} from "../generated/DebtSubsidizer/DebtSubsidizer";
import {
  SubsidyTransaction,
  Account,
  Collection,
  Vault,
  TrustedSignerUpdate,
  Subsidy,
  Epoch,
  SystemState,
} from "../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";

export function handleDebtSubsidized(event: DebtSubsidized): void {
  const eventIdBase = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  // --- Try to load the active epoch ---
  let activeEpochId: string | null = null;
  const systemState = SystemState.load("SYSTEM");
  if (systemState != null && systemState.activeEpochId != null) {
    activeEpochId = systemState.activeEpochId!;
  } else {
    log.critical("handleDebtSubsidized: SystemState or activeEpochId not found. Cannot process event {}.", [eventIdBase]);
    return; // Critical: Cannot proceed without an active epoch
  }

  const epoch = Epoch.load(activeEpochId); // `epoch` will be `Epoch | null`
  if (epoch == null) {
    log.critical("handleDebtSubsidized: Active Epoch with id {} not found for event {}. Cannot process.", [activeEpochId, eventIdBase]);
    return; // Critical: Cannot proceed if epoch entity doesn't exist
  }
  // From this point, 'epoch' is guaranteed to be of type 'Epoch'

  // --- Load/Create Account ---
  let account = Account.load(event.params.user.toHexString());
  if (account == null) {
    account = new Account(event.params.user.toHexString());
    account.totalSecondsClaimed = BigInt.fromI32(0);
    account.save();
  }

  let collection = Collection.load(event.params.collectionAddress.toHexString());
  if (collection == null) {
    collection = new Collection(event.params.collectionAddress.toHexString());
    collection.name = "Unknown Collection";
    collection.symbol = "UNKN";
    collection.totalNFTs = BigInt.fromI32(0);
    collection.collectionType = "ERC721";
    collection.save();
  }

  // --- Load/Create Vault ---
  let vault = Vault.load(event.params.vaultAddress.toHexString());
  if (vault == null) {
    log.warning("handleDebtSubsidized: Vault {} not found. Creating minimal vault for event {}.", [
      event.params.vaultAddress.toHexString(),
      eventIdBase
    ]);
    vault = new Vault(event.params.vaultAddress.toHexString());
    // This placeholder will cause issues if CTokenMarket is non-nullable and no such ID exists.
    // A robust solution requires ensuring CTokenMarket entities are created beforehand.
    vault.cTokenMarket = "UNKNOWN_CTOKEN_MARKET_ID";
    vault.totalShares = BigInt.fromI32(0);
    vault.totalDeposits = BigInt.fromI32(0);
    vault.totalCTokens = BigInt.fromI32(0);
    vault.globalDepositIndex = BigInt.fromI32(0);
    vault.totalPrincipalDeposited = BigInt.fromI32(0);
    vault.updatedAtBlock = event.block.number;
    vault.updatedAtTimestamp = event.block.timestamp.toI64();
    vault.save();
  }

  // --- Create Subsidy Entity ---
  const subsidyId = "SUB-" + eventIdBase;
  const subsidy = new Subsidy(subsidyId);
  subsidy.epoch = epoch.id; // epoch is confirmed non-null
  subsidy.user = account.id;
  subsidy.amount = event.params.amount;
  subsidy.txHash = event.transaction.hash;
  subsidy.timestamp = event.block.timestamp; // Reverted to direct assignment
  subsidy.save();

  log.info("DebtSubsidized: Created Subsidy {} for user {} in epoch {} with amount {}", [
    subsidyId,
    event.params.user.toHexString(),
    epoch.id,
    event.params.amount.toString()
  ]);

  // --- Create SubsidyTransaction Entity ---
  const subsidyTxId = "SUBTX-" + eventIdBase;
  const subsidyTx = new SubsidyTransaction(subsidyTxId);
  subsidyTx.epoch = epoch.id; // epoch is confirmed non-null
  subsidyTx.user = account.id;
  subsidyTx.collection = collection.id;
  subsidyTx.vault = vault.id;
  subsidyTx.subsidyAmount = event.params.amount;
  subsidyTx.borrowAmountBefore = BigInt.fromI32(0);
  subsidyTx.borrowAmountAfter = BigInt.fromI32(0);
  subsidyTx.gasUsed = event.receipt != null ? event.receipt!.gasUsed : BigInt.fromI32(0);
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp; // Reverted to direct assignment
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.save();

  log.info("DebtSubsidized: Created/Updated SubsidyTransaction {} for user {} in vault {} with amount {}", [
    subsidyTxId,
    event.params.user.toHexString(),
    event.params.vaultAddress.toHexString(),
    event.params.amount.toString()
  ]);
}

export function handleTrustedSignerUpdated(event: TrustedSignerUpdated): void {
  const updateId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();
  const signerUpdate = new TrustedSignerUpdate(updateId);

  signerUpdate.oldSigner = event.params.oldSigner;
  signerUpdate.newSigner = event.params.newSigner;
  signerUpdate.blockNumber = event.block.number;
  signerUpdate.timestamp = event.block.timestamp;
  signerUpdate.transactionHash = event.transaction.hash;
  signerUpdate.save();
}