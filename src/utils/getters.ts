import { BigInt, Address, log, Bytes } from "@graphprotocol/graph-ts";
import { cToken as CTokenContract } from "../../generated/templates/cToken/cToken";
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
  SystemState,
  EpochVaultAllocation,
  MerkleDistribution,
} from "../../generated/schema";

import { ZERO_BI, ADDRESS_ZERO_STR, SYSTEM_STATE_ID } from "./const";

function generateCollectionVaultId(
  vaultId: string,
  collectionId: string
): string {
  return vaultId + "-" + collectionId;
}

function generateAccountSubsidiesPerCollectionId(
  accountId: string,
  collectionVaultId: string
): string {
  return accountId + "-" + collectionVaultId;
}

export function getOrCreateAccount(accountAddress: Address): Account {
  log.info("getOrCreateAccount: Input accountAddress: {}", [
    accountAddress.toHexString(),
  ]);
  let account = Account.load(accountAddress.toHexString());
  if (account == null) {
    account = new Account(accountAddress.toHexString());
    account.totalSecondsClaimed = ZERO_BI;
    account.totalSubsidiesReceived = ZERO_BI;
    account.totalYieldEarned = ZERO_BI;
    account.totalBorrowVolume = ZERO_BI;
    account.totalNFTsOwned = ZERO_BI;
    account.totalCollectionsParticipated = ZERO_BI;
    account.firstInteractionBlock = ZERO_BI;
    account.firstInteractionTimestamp = ZERO_BI;
    account.updatedAtBlock = ZERO_BI;
    account.updatedAtTimestamp = ZERO_BI;
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
    // This function should only be called for validated cTokens
    // If validation failed earlier, this should not be reached
    cTokenMarket = new CTokenMarket(address.toHexString());
    cTokenMarket.symbol = "UNKNOWN";
    cTokenMarket.name = "UNKNOWN";
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
    cTokenMarket.liquidationIncentive = ZERO_BI;
    cTokenMarket.reserveFactor = ZERO_BI;
    cTokenMarket.baseRatePerBlock = ZERO_BI;
    cTokenMarket.multiplierPerBlock = ZERO_BI;
    cTokenMarket.jumpMultiplierPerBlock = ZERO_BI;
    cTokenMarket.kink = ZERO_BI;

    const cTokenContract = CTokenContract.bind(address);
    const nameResult = cTokenContract.try_name();
    if (!nameResult.reverted) {
      cTokenMarket.name = nameResult.value;
    }

    const symbolResult = cTokenContract.try_symbol();
    if (!symbolResult.reverted) {
      cTokenMarket.symbol = symbolResult.value;
    }

    cTokenMarket.save();
  }
  return cTokenMarket;
}

export function getOrCreateCollection(collectionAddress: Address): Collection {
  let collection = Collection.load(collectionAddress.toHexString());
  if (collection == null) {
    collection = new Collection(collectionAddress.toHexString());
    collection.contractAddress = Address.fromHexString(collectionAddress.toHexString());
    collection.name = "Unknown Collection";
    collection.symbol = "UNKN";
    collection.totalSupply = ZERO_BI;
    collection.collectionType = "ERC721";
    // Registry integration
    collection.registry = Address.fromString("0x000000000000000000000000000000000000000A").toHexString(); // Set to a valid CollectionRegistry ID if available
    // Registry-managed configuration
    collection.isActive = false;
    collection.yieldSharePercentage = ZERO_BI;
    collection.weightFunctionType = "LINEAR";
    collection.weightFunctionP1 = ZERO_BI;
    collection.weightFunctionP2 = ZERO_BI;
    collection.minBorrowAmount = ZERO_BI;
    collection.maxBorrowAmount = ZERO_BI;
    // Collection statistics
    collection.totalNFTsDeposited = ZERO_BI;
    collection.totalBorrowVolume = ZERO_BI;
    collection.totalYieldGenerated = ZERO_BI;
    collection.totalSubsidiesReceived = ZERO_BI;
    // Metadata
    collection.registeredAtBlock = ZERO_BI;
    collection.registeredAtTimestamp = ZERO_BI;
    collection.updatedAtBlock = ZERO_BI;
    collection.updatedAtTimestamp = ZERO_BI;
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
    // Registry and manager references (set to empty or placeholder, update as needed)
    vault.collectionRegistry = Address.fromString("0x0000000000000000000000000000000000000006").toHexString();
    vault.epochManager = Address.fromString("0x0000000000000000000000000000000000000007").toHexString();
    vault.lendingManager = Address.fromString("0x0000000000000000000000000000000000000008").toHexString();
    vault.debtSubsidizer = Address.fromString("0x0000000000000000000000000000000000000009").toHexString();
    // Metadata
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
    cv.yieldClaimed = ZERO_BI;
    cv.totalYieldGenerated = ZERO_BI;
    cv.isBorrowBased = true;
    cv.rewardSharePercentage = ZERO_BI;
    cv.weightFunctionType = "LINEAR";
    cv.weightFunctionP1 = ZERO_BI;
    cv.weightFunctionP2 = ZERO_BI;
    cv.secondsAccumulated = ZERO_BI;
    cv.secondsClaimed = ZERO_BI;
    cv.totalSubsidies = ZERO_BI;
    cv.totalSubsidiesClaimed = ZERO_BI;
    cv.averageAPY = ZERO_BI;
    cv.totalParticipants = ZERO_BI;
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
      "getOrCreateAccountSubsidiesPerCollection: CollectionVault {} not found. This should not happen.",
      [collectionVaultId]
    );
    // Return a dummy object to satisfy TypeScript, as log.critical is expected to halt execution.
    return new AccountSubsidiesPerCollection(collectionVaultId);
  }

  const vaultEntity = CollectionsVault.load(collectionVault.vault);
  if (vaultEntity == null) {
    log.critical(
      "getOrCreateAccountSubsidiesPerCollection: Vault with id {} not found when creating AccountSubsidiesPerCollection. This should not happen.",
      [collectionVault.vault]
    );
    // Return a dummy object to satisfy TypeScript, as log.critical is expected to halt execution.
    return new AccountSubsidiesPerCollection(collectionVaultId);
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
    apsc.weightedBalance = ZERO_BI;
    apsc.secondsAccumulated = ZERO_BI;
    apsc.secondsClaimed = ZERO_BI;
    apsc.subsidiesAccrued = ZERO_BI;
    apsc.subsidiesClaimed = ZERO_BI;
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

  const id = account.id + "-" + market.id;
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
  const id = accountId + "-" + epochId + "-" + collectionId;
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
      // throw new Error(
      //   `Account ${accountId} not found when trying to create UserEpochEligibility ${id}`
      // );
    }

    const epoch = Epoch.load(epochId);
    if (epoch == null) {
      log.critical(
        "getOrCreateUserEpochEligibility: Epoch {} not found. Cannot create UserEpochEligibility {}.",
        [epochId, id]
      );
      // throw new Error(
      //   `Epoch ${epochId} not found when trying to create UserEpochEligibility ${id}`
      // );
    }

    const collection = Collection.load(collectionId);
    if (collection == null) {
      log.critical(
        "getOrCreateUserEpochEligibility: Collection {} not found. Cannot create UserEpochEligibility {}.",
        [collectionId, id]
      );
      // throw new Error(
      //   `Collection ${collectionId} not found when trying to create UserEpochEligibility ${id}`
      // );
    }

    userEpochEligibility = new UserEpochEligibility(id);
    userEpochEligibility.user = accountId;
    userEpochEligibility.epoch = epochId;
    userEpochEligibility.collection = collectionId;
    userEpochEligibility.nftBalance = ZERO_BI;
    userEpochEligibility.borrowBalance = ZERO_BI;
    userEpochEligibility.holdingDuration = ZERO_BI;
    userEpochEligibility.isEligible = false;
    userEpochEligibility.subsidyReceived = ZERO_BI;
    userEpochEligibility.yieldShare = ZERO_BI;
    userEpochEligibility.bonusMultiplier = ZERO_BI;
    userEpochEligibility.calculatedAtBlock = ZERO_BI;
    userEpochEligibility.calculatedAtTimestamp = ZERO_BI;
    userEpochEligibility.save();
  }
  return userEpochEligibility;
}
// Get or create SystemState singleton
export function getOrCreateSystemState(): SystemState {
  let systemState = SystemState.load(SYSTEM_STATE_ID);
  if (systemState == null) {
    systemState = new SystemState(SYSTEM_STATE_ID);
    systemState.totalVaults = ZERO_BI;
    systemState.totalCollections = ZERO_BI;
    systemState.totalUsers = ZERO_BI;
    systemState.totalValueLocked = ZERO_BI;
    systemState.totalYieldDistributed = ZERO_BI;
    systemState.totalSubsidiesDistributed = ZERO_BI;
    systemState.systemUtilizationRate = ZERO_BI;
    systemState.averageAPY = ZERO_BI;
    systemState.lastUpdatedBlock = ZERO_BI;
    systemState.lastUpdatedTimestamp = ZERO_BI;
    systemState.save();
  }
  return systemState;
}

// Get or create EpochVaultAllocation by epoch and vault
export function getOrCreateEpochVaultAllocation(epochId: string, vaultId: string): EpochVaultAllocation {
  const id = epochId + "-" + vaultId;
  let allocation = EpochVaultAllocation.load(id);
  if (allocation == null) {
    allocation = new EpochVaultAllocation(id);
    allocation.epoch = epochId;
    allocation.vault = vaultId;
    allocation.yieldAllocated = ZERO_BI;
    allocation.subsidiesDistributed = ZERO_BI;
    allocation.remainingYield = ZERO_BI;
    allocation.participantCount = ZERO_BI;
    allocation.averageSubsidyPerUser = ZERO_BI;
    allocation.utilizationRate = ZERO_BI;
    allocation.createdAtBlock = ZERO_BI;
    allocation.createdAtTimestamp = ZERO_BI;
    allocation.updatedAtBlock = ZERO_BI;
    allocation.updatedAtTimestamp = ZERO_BI;
    allocation.save();
  }
  return allocation;
}

// Get or create MerkleDistribution by id, epoch, and vault
export function getOrCreateMerkleDistribution(id: string, epochId: string, vaultId: string): MerkleDistribution {
  let distribution = MerkleDistribution.load(id);
  if (distribution == null) {
    distribution = new MerkleDistribution(id);
    distribution.epoch = epochId;
    distribution.vault = vaultId;
    distribution.totalAmount = ZERO_BI;
    distribution.totalClaims = ZERO_BI;
    distribution.merkleRoot = Bytes.empty();
    distribution.blockNumber = ZERO_BI;
    distribution.timestamp = ZERO_BI;
    distribution.transactionHash = Bytes.empty();
    distribution.save();
  }
  return distribution;
}
