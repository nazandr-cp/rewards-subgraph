import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import {
  Account,
  Collection,
  CollectionsVault,
  CollectionParticipation,
  AccountSubsidiesPerCollection,
  CTokenMarket,
  AccountMarket,
  UserEpochEligibility,
  Epoch,
} from "../../generated/schema";

import { ZERO_BI, ADDRESS_ZERO_STR } from "./const";

function generateCollectionVaultId(
  vaultId: string,
  collectionId: string
): string {
  return vaultId.concat("-").concat(collectionId);
}

function generateAccountSubsidiesPerCollectionId(
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
    cTokenMarket.lastExchangeRateTimestamp = ZERO_BI;
    cTokenMarket.updatedAtBlock = ZERO_BI;
    cTokenMarket.updatedAtTimestamp = ZERO_BI;
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
    collection.totalSupply = ZERO_BI;
    collection.collectionType = "ERC721";
    collection.save();
  }
  return collection;
}

export function getOrCreateVault(
  vaultAddress: Address,
  cTokenMarketAddress: Address
): CollectionsVault {
  let vault = CollectionsVault.load(vaultAddress.toHexString());
  if (vault == null) {
    vault = new CollectionsVault(vaultAddress.toHexString());
    const cTokenMarket = getOrCreateCTokenMarket(cTokenMarketAddress);
    vault.cTokenMarket = cTokenMarket.id;
    vault.totalShares = ZERO_BI;
    vault.totalDeposits = ZERO_BI;
    vault.totalCTokens = ZERO_BI;
    vault.globalDepositIndex = ZERO_BI;
    vault.totalPrincipalDeposited = ZERO_BI;
    vault.createdAtBlock = ZERO_BI;
    vault.createdAtTimestamp = ZERO_BI;
    vault.updatedAtBlock = ZERO_BI;
    vault.updatedAtTimestamp = ZERO_BI;
    vault.save();
  }
  return vault;
}

export function getOrCreateCollectionVault(
  vaultAddress: Address,
  collectionAddress: Address,
  cTokenMarketAddress: Address
): CollectionParticipation {
  const collection = getOrCreateCollection(collectionAddress);
  const vaultId = vaultAddress.toHexString();

  const id = generateCollectionVaultId(vaultId, collection.id);
  let cv = CollectionParticipation.load(id);

  if (cv == null) {
    const vault = getOrCreateVault(vaultAddress, cTokenMarketAddress);
    cv = new CollectionParticipation(id);
    cv.collection = collection.id;
    cv.vault = vault.id;
    cv.principalShares = ZERO_BI;
    cv.principalDeposited = ZERO_BI;
    cv.totalCTokens = ZERO_BI;
    cv.globalDepositIndex = ZERO_BI;
    cv.lastGlobalDepositIndex = ZERO_BI;
    cv.yieldAccrued = ZERO_BI;
    cv.isBorrowBased = true;
    cv.rewardSharePercentage = ZERO_BI;
    cv.weightFunctionType = "LINEAR";
    cv.weightFunctionP1 = ZERO_BI;
    cv.weightFunctionP2 = ZERO_BI;
    cv.secondsAccumulated = ZERO_BI;
    cv.secondsClaimed = ZERO_BI;
    cv.totalSubsidies = ZERO_BI;
    cv.totalSubsidiesClaimed = ZERO_BI;
    cv.updatedAtBlock = ZERO_BI;
    cv.createdAtBlock = ZERO_BI;
    cv.createdAtTimestamp = ZERO_BI;
    cv.updatedAtBlock = ZERO_BI;
    cv.updatedAtTimestamp = ZERO_BI;
    cv.save();
  }
  return cv;
}

export function getOrCreateAccountSubsidiesPerCollection(
  accountAddress: Address,
  collectionVaultId: string,
  blockNumber: BigInt,
  timestamp: BigInt
): AccountSubsidiesPerCollection {
  const account = getOrCreateAccount(accountAddress);
  const collectionVault = CollectionParticipation.load(collectionVaultId);

  if (collectionVault == null) {
    log.critical(
      "getOrCreateAccountSubsidiesPerCollection: CollectionVault {} not found.",
      [collectionVaultId]
    );
    throw new Error(
      `CRITICAL: CollectionVault with id ${collectionVaultId} not found in getOrCreateAccountSubsidiesPerCollection. This should not happen.`
    );
  }

  const vaultEntity = CollectionsVault.load(collectionVault.vault);
  if (!vaultEntity) {
    throw new Error(
      `CRITICAL: Vault with id ${collectionVaultId} not found when creating AccountSubsidiesPerCollection. This should not happen.`
    );
  }

  const cTokenMarketForVault = vaultEntity.cTokenMarket
    ? Address.fromString(vaultEntity.cTokenMarket)
    : Address.fromString(ADDRESS_ZERO_STR);

  const accountMarket = getOrCreateAccountMarket(
    accountAddress,
    cTokenMarketForVault
  );

  const id = generateAccountSubsidiesPerCollectionId(
    account.id,
    collectionVault.id
  );
  let apsc = AccountSubsidiesPerCollection.load(id);

  if (apsc == null) {
    apsc = new AccountSubsidiesPerCollection(id);
    apsc.account = account.id;
    apsc.vault = collectionVault.vault;
    apsc.collection = collectionVault.collection;
    apsc.accountMarket = accountMarket.id;
    apsc.collectionParticipation = collectionVault.id;
    apsc.balanceNFT = ZERO_BI;
    apsc.secondsAccumulated = ZERO_BI;
    apsc.secondsClaimed = ZERO_BI;
    apsc.subsidiesAccrued = ZERO_BI;
    apsc.subsidiesClaimed = ZERO_BI;
    apsc.weightedBalance = ZERO_BI;
    apsc.averageHoldingPeriod = ZERO_BI;
    apsc.totalRewardsEarned = ZERO_BI;
    apsc.updatedAtBlock = blockNumber;
    apsc.updatedAtTimestamp = timestamp;
    apsc.save();
  } else {
    apsc.updatedAtBlock = blockNumber;
    apsc.updatedAtTimestamp = timestamp;
    apsc.save();
  }
  return apsc;
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
    accountMarket.supplyBalance = ZERO_BI;
    accountMarket.borrowBalance = ZERO_BI;
    accountMarket.collateralBalance = ZERO_BI;
    accountMarket.supplyIndex = ZERO_BI;
    accountMarket.borrowIndex = ZERO_BI;
    accountMarket.enteredMarketBlock = ZERO_BI;
    accountMarket.enteredMarketTimestamp = ZERO_BI;
    accountMarket.updatedAtBlock = ZERO_BI;
    accountMarket.updatedAtTimestamp = ZERO_BI;
    accountMarket.save();
  }
  return accountMarket;
}

export function getOrCreateUserEpochEligibility(
  accountId: string,
  epochId: string,
  collectionId: string
): UserEpochEligibility {
  const id = accountId
    .concat("-")
    .concat(epochId)
    .concat("-")
    .concat(collectionId);
  let userEpochEligibility = UserEpochEligibility.load(id);

  if (userEpochEligibility == null) {
    // Ensure Account, Epoch, and Collection exist.
    // Account should be created by the caller (e.g., in handleTransfer)
    // Epoch should be created by EpochManager handlers
    // Collection should be created by Collection-related handlers or dynamically
    const account = Account.load(accountId);
    if (account == null) {
      log.critical(
        "getOrCreateUserEpochEligibility: Account {} not found. Cannot create UserEpochEligibility {}.",
        [accountId, id]
      );
      // This is a critical error, as the account should exist or be created before this call.
      // Depending on strictness, could throw or return a new unlinked entity.
      // For now, let's assume the caller ensures Account exists.
      throw new Error(
        `Account ${accountId} not found when trying to create UserEpochEligibility ${id}`
      );
    }

    const epoch = Epoch.load(epochId);
    if (epoch == null) {
      log.critical(
        "getOrCreateUserEpochEligibility: Epoch {} not found. Cannot create UserEpochEligibility {}.",
        [epochId, id]
      );
      throw new Error(
        `Epoch ${epochId} not found when trying to create UserEpochEligibility ${id}`
      );
    }

    const collection = Collection.load(collectionId);
    if (collection == null) {
      log.critical(
        "getOrCreateUserEpochEligibility: Collection {} not found. Cannot create UserEpochEligibility {}.",
        [collectionId, id]
      );
      throw new Error(
        `Collection ${collectionId} not found when trying to create UserEpochEligibility ${id}`
      );
    }

    userEpochEligibility = new UserEpochEligibility(id);
    userEpochEligibility.user = accountId;
    userEpochEligibility.epoch = epochId;
    userEpochEligibility.collection = collectionId;
    userEpochEligibility.nftBalance = ZERO_BI;
    userEpochEligibility.borrowBalance = ZERO_BI; // Initialize, will be updated by other handlers
    userEpochEligibility.subsidyReceived = ZERO_BI; // Initialize
    userEpochEligibility.isEligible = false; // Default, eligibility logic will set this
    userEpochEligibility.save();
  }
  return userEpochEligibility;
}
