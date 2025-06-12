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
} from "../generated/schema";
import { BigInt, log } from "@graphprotocol/graph-ts";

export function handleDebtSubsidized(event: DebtSubsidized): void {
  const subsidyTxId = event.transaction.hash.toHexString() + "-" + event.logIndex.toString();

  // Validate required entities first
  let account = Account.load(event.params.user.toHexString());
  if (account == null) {
    account = new Account(event.params.user.toHexString());
    account.totalSecondsClaimed = BigInt.fromI32(0);
    account.save();
  }

  let collection = Collection.load(event.params.collectionAddress.toHexString());
  if (collection == null) {
    collection = new Collection(event.params.collectionAddress.toHexString());
    collection.name = "";
    collection.symbol = "";
    collection.totalNFTs = BigInt.fromI32(0);
    collection.collectionType = "ERC721";
    collection.save();
  }

  let vault = Vault.load(event.params.vaultAddress.toHexString());
  if (vault == null) {
    log.error("handleDebtSubsidized: Vault {} not found. Creating minimal vault.", [
      event.params.vaultAddress.toHexString()
    ]);
    vault = new Vault(event.params.vaultAddress.toHexString());
    vault.cTokenMarket = "";
    vault.totalShares = BigInt.fromI32(0);
    vault.totalDeposits = BigInt.fromI32(0);
    vault.totalCTokens = BigInt.fromI32(0);
    vault.updatedAtBlock = event.block.number;
    vault.updatedAtTimestamp = event.block.timestamp.toI64();
    vault.save();
  }

  const subsidyTx = new SubsidyTransaction(subsidyTxId);
  subsidyTx.epoch = "";
  subsidyTx.user = account.id;
  subsidyTx.collection = collection.id;
  subsidyTx.vault = vault.id;
  subsidyTx.subsidyAmount = event.params.amount;
  subsidyTx.borrowAmountBefore = BigInt.fromI32(0);
  subsidyTx.borrowAmountAfter = BigInt.fromI32(0);
  subsidyTx.gasUsed = event.receipt != null ? event.receipt!.gasUsed : BigInt.fromI32(0);
  subsidyTx.blockNumber = event.block.number;
  subsidyTx.timestamp = event.block.timestamp;
  subsidyTx.transactionHash = event.transaction.hash;
  subsidyTx.save();

  log.info("DebtSubsidized: Created SubsidyTransaction {} for user {} in vault {} with amount {}", [
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