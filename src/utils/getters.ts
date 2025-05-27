import { Address, BigInt, log } from "@graphprotocol/graph-ts";
import {
  Account,
  Collection,
  Vault,
  CollectionVault,
  AccountRewardsPerCollection,
  CTokenMarket,
  AccountMarket,
} from "../../generated/schema";

import { ZERO_BI } from "./const";

function generateCollectionVaultId(
  vaultId: string,
  collectionId: string
): string {
  return vaultId.concat("-").concat(collectionId);
}

function generateAccountRewardsPerCollectionId(
  accountId: string,
  collectionVaultId: string
): string {
  return accountId.concat("-").concat(collectionVaultId);
}

export function getOrCreateAccount(accountAddress: Address): Account {
  log.info("getOrCreateAccount: Input accountAddress: {}", [
    accountAddress.toHexString(),
  ]);
  let account = Account.load(accountAddress.toHexString());
  if (account == null) {
    account = new Account(accountAddress.toHexString());
    account.totalSecondsClaimed = ZERO_BI;
    account.save();
    log.info("getOrCreateAccount: Created new account with ID: {}", [
      account.id,
    ]);
  } else {
    log.info("getOrCreateAccount: Loaded existing account with ID: {}", [
      account.id,
    ]);
  }
  return account;
}

export function getOrCreateCTokenMarket(address: Address): CTokenMarket {
  let cTokenMarket = CTokenMarket.load(address.toHexString());
  if (cTokenMarket == null) {
    cTokenMarket = new CTokenMarket(address.toHexString());
    cTokenMarket.totalSupply = ZERO_BI;
    cTokenMarket.totalBorrows = ZERO_BI;
    cTokenMarket.totalReserves = ZERO_BI;
    cTokenMarket.exchangeRate = ZERO_BI;
    cTokenMarket.collateralFactor = ZERO_BI;
    cTokenMarket.borrowIndex = ZERO_BI;
    cTokenMarket.lastAccrualTimestamp = ZERO_BI.toI32();
    cTokenMarket.updatedAtBlock = ZERO_BI;
    cTokenMarket.updatedAtTimestamp = ZERO_BI.toI32();
    cTokenMarket.save();
  }
  return cTokenMarket;
}

export function getOrCreateCollection(collectionAddress: Address): Collection {
  let collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    collection = new Collection(collectionAddress.toHexString());
    collection.name = "Unknown Collection";
    collection.symbol = "UNKN";
    collection.totalNFTs = ZERO_BI;
    collection.collectionType = "ERC721";
    collection.save();
  }
  return collection;
}

export function getOrCreateVault(vaultAddress: Address): Vault {
  let vault = Vault.load(vaultAddress.toHexString());
  if (vault == null) {
    vault = new Vault(vaultAddress.toHexString());
    vault.rewardPerBlock = ZERO_BI;
    vault.globalRPW = ZERO_BI;
    vault.totalWeight = ZERO_BI;
    vault.updatedAtBlock = ZERO_BI;
    vault.updatedAtTimestamp = ZERO_BI.toI32();
    vault.save();
  }
  return vault;
}

export function getOrCreateCollectionVault(
  vaultAddress: Address,
  collectionAddress: Address
): CollectionVault {
  const vault = getOrCreateVault(vaultAddress);
  const collection = getOrCreateCollection(collectionAddress);

  const id = generateCollectionVaultId(vault.id, collection.id);
  let cv = CollectionVault.load(id);

  if (cv == null) {
    cv = new CollectionVault(id);
    cv.collection = collection.id;
    cv.vault = vault.id;
    cv.isBorrowBased = false;
    cv.fnType = "LINEAR";
    cv.p1 = ZERO_BI;
    cv.p2 = ZERO_BI;
    cv.rewardPerSecond = ZERO_BI;
    cv.totalSecondsAccrued = ZERO_BI;
    cv.totalRewardsPool = ZERO_BI;
    cv.totalAccruedSecondsInVault = ZERO_BI;
    cv.updatedAtBlock = ZERO_BI;
    cv.updatedAtTimestamp = ZERO_BI.toU64();
    cv.save();
  }
  return cv;
}

export function getOrCreateAccountRewardsPerCollection(
  accountAddress: Address,
  collectionVaultId: string,
  eventTimestamp: BigInt
): AccountRewardsPerCollection {
  const account = getOrCreateAccount(accountAddress);
  const collectionVault = CollectionVault.load(collectionVaultId);

  if (collectionVault == null) {
    log.critical(
      "getOrCreateAccountRewardsPerCollection: CollectionVault with ID {} not found. This should not happen.",
      [collectionVaultId]
    );
  }

  const id = generateAccountRewardsPerCollectionId(
    account.id,
    collectionVaultId
  );
  let arpc = AccountRewardsPerCollection.load(id);

  if (arpc == null) {
    arpc = new AccountRewardsPerCollection(id);
    arpc.account = account.id;
    arpc.collectionVault = collectionVaultId;
    arpc.balanceNFT = ZERO_BI;
    arpc.seconds = ZERO_BI;
    arpc.lastUpdate = eventTimestamp.toI32();
    arpc.save();
  }
  return arpc;
}

export function getOrCreateAccountMarket(
  accountAddress: Address,
  marketAddress: Address
): AccountMarket {
  const account = getOrCreateAccount(accountAddress);
  const market = getOrCreateCTokenMarket(marketAddress);

  const id = account.id.concat("-").concat(market.id);
  let accountMarket = AccountMarket.load(id);

  if (accountMarket == null) {
    accountMarket = new AccountMarket(id);
    accountMarket.account = account.id;
    accountMarket.cTokenMarket = market.id;
    accountMarket.deposit = ZERO_BI;
    accountMarket.borrow = ZERO_BI;
    accountMarket.save();
  }
  return accountMarket;
}
