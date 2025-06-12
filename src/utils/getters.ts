import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  Account,
  Collection,
  Vault,
  CollectionVault,
  AccountRewardsPerCollection,
  CTokenMarket,
  AccountMarket,
} from "../../generated/schema";

import { ZERO_BI, ADDRESS_ZERO_STR } from "./const";

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
    cTokenMarket.decimals = 0;
    cTokenMarket.totalSupply = ZERO_BI;
    cTokenMarket.totalBorrows = ZERO_BI;
    cTokenMarket.totalReserves = ZERO_BI;
    cTokenMarket.exchangeRate = ZERO_BI;
    cTokenMarket.interestAccumulated = ZERO_BI;
    cTokenMarket.cashPrior = ZERO_BI;
    cTokenMarket.collateralFactor = ZERO_BI;
    cTokenMarket.borrowIndex = ZERO_BI;
    cTokenMarket.lastExchangeRateTimestamp = ZERO_BI.toI32();
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

export function getOrCreateVault(
  vaultAddress: Address,
  cTokenMarketAddress: Address
): Vault {
  let vault = Vault.load(vaultAddress.toHexString());
  if (vault == null) {
    vault = new Vault(vaultAddress.toHexString());
    const cTokenMarket = getOrCreateCTokenMarket(cTokenMarketAddress);
    vault.cTokenMarket = cTokenMarket.id;
    vault.totalShares = ZERO_BI;
    vault.totalDeposits = ZERO_BI;
    vault.totalCTokens = ZERO_BI;
    vault.globalDepositIndex = ZERO_BI;
    vault.totalPrincipalDeposited = ZERO_BI;
    vault.updatedAtBlock = ZERO_BI;
    vault.updatedAtTimestamp = ZERO_BI.toI32();
    vault.save();
  }
  return vault;
}

export function getOrCreateCollectionVault(
  vaultAddress: Address,
  collectionAddress: Address,
  cTokenMarketAddress: Address
): CollectionVault {
  const collection = getOrCreateCollection(collectionAddress);
  const vaultId = vaultAddress.toHexString();
  
  const id = generateCollectionVaultId(vaultId, collection.id);
  let cv = CollectionVault.load(id);

  if (cv == null) {
    const vault = getOrCreateVault(vaultAddress, cTokenMarketAddress);
    cv = new CollectionVault(id);
    cv.collection = collection.id;
    cv.vault = vault.id;
    cv.principalShares = ZERO_BI;
    cv.principalDeposited = ZERO_BI;
    cv.cTokenAmount = ZERO_BI;
    cv.globalDepositIndex = ZERO_BI;
    cv.lastGlobalDepositIndex = ZERO_BI;
    cv.yieldAccrued = ZERO_BI;
    cv.isBorrowBased = false;
    cv.rewardSharePercentage = 0;
    cv.fnType = "LINEAR";
    cv.p1 = ZERO_BI;
    cv.p2 = ZERO_BI;
    cv.secondsAccumulated = ZERO_BI;
    cv.secondsClaimed = ZERO_BI;
    cv.totalRewards = ZERO_BI;
    cv.totalRewardsClaimed = ZERO_BI;
    cv.updatedAtBlock = ZERO_BI;
    cv.updatedAtTimestamp = ZERO_BI.toI32();
    cv.save();
  }
  return cv;
}

export function getOrCreateAccountRewardsPerCollection(
  accountAddress: Address,
  collectionVaultId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): AccountRewardsPerCollection {
  const account = getOrCreateAccount(accountAddress);
  const collectionVault = CollectionVault.load(collectionVaultId);

  if (collectionVault == null) {
    log.critical(
      "getOrCreateAccountRewardsPerCollection: CollectionVault {} not found.",
      [collectionVaultId]
    );
    throw new Error(
      `CRITICAL: CollectionVault with id ${collectionVaultId} not found in getOrCreateAccountRewardsPerCollection. This should not happen.`
    );
  }

  const vaultEntity = Vault.load(collectionVault.vault);
  if (!vaultEntity) {
    throw new Error(
      `CRITICAL: Vault with id ${collectionVaultId} not found when creating AccountRewardsPerCollection. This should not happen.`
    );
  }

  const cTokenMarketForVault = vaultEntity.cTokenMarket
    ? Address.fromString(vaultEntity.cTokenMarket)
    : Address.fromString(ADDRESS_ZERO_STR);

  const accountMarket = getOrCreateAccountMarket(
    accountAddress,
    cTokenMarketForVault
  );

  const id = generateAccountRewardsPerCollectionId(
    account.id,
    collectionVault.id
  );
  let arpc = AccountRewardsPerCollection.load(id);

  if (arpc == null) {
    arpc = new AccountRewardsPerCollection(id);
    arpc.account = account.id;
    arpc.vault = collectionVault.vault;
    arpc.collection = collectionVault.collection;
    arpc.accountMarket = accountMarket.id;
    arpc.collectionVault = collectionVault.id;
    arpc.balanceNFT = ZERO_BI;
    arpc.seconds = ZERO_BI;
    arpc.updatedAtBlock = blockNumber;
    arpc.updatedAtTimestamp = timestamp.toI32();
    arpc.save();
  } else {
    arpc.updatedAtBlock = blockNumber;
    arpc.updatedAtTimestamp = timestamp.toI32();
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
    accountMarket.updatedAtBlock = ZERO_BI;
    accountMarket.updatedAtTimestamp = ZERO_BI.toI32();
    accountMarket.save();
  }
  return accountMarket;
}
