import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import { 
  Account, 
  CTokenMarket, 
  AccountMarket,
  Collection,
  CollectionsVault,
  CollectionParticipation
} from "../../generated/schema";
import { ZERO_BI, ADDRESS_ZERO_STR } from "./const";

// Batch operation interface for getOrCreate operations
class BatchContext {
  accounts: Map<string, Account>;
  cTokenMarkets: Map<string, CTokenMarket>;
  accountMarkets: Map<string, AccountMarket>;
  collections: Map<string, Collection>;
  vaults: Map<string, CollectionsVault>;
  collectionParticipations: Map<string, CollectionParticipation>;

  constructor() {
    this.accounts = new Map<string, Account>();
    this.cTokenMarkets = new Map<string, CTokenMarket>();
    this.accountMarkets = new Map<string, AccountMarket>();
    this.collections = new Map<string, Collection>();
    this.vaults = new Map<string, CollectionsVault>();
    this.collectionParticipations = new Map<string, CollectionParticipation>();
  }

  // Get or create account with batching
  getOrCreateAccount(accountAddress: Address, blockNumber: BigInt, timestamp: BigInt): Account {
    const id = accountAddress.toHexString();
    let account: Account | null = null;
    
    if (this.accounts.has(id)) {
      account = this.accounts.get(id);
    }
    
    if (account == null) {
      const loadedAccount = Account.load(id);
      if (loadedAccount == null) {
        account = new Account(id);
        account.totalSecondsClaimed = ZERO_BI;
        account.totalSubsidiesReceived = ZERO_BI;
        account.totalYieldEarned = ZERO_BI;
        account.totalBorrowVolume = ZERO_BI;
        account.totalNFTsOwned = ZERO_BI;
        account.totalCollectionsParticipated = ZERO_BI;
        account.createdAtBlock = blockNumber;
        account.createdAtTimestamp = timestamp;
        account.updatedAtBlock = blockNumber;
        account.updatedAtTimestamp = timestamp;
      } else {
        account = loadedAccount;
      }
      this.accounts.set(id, account);
    }
    return account;
  }

  // Get or create cToken market with batching
  getOrCreateCTokenMarket(address: Address, blockNumber: BigInt, timestamp: BigInt): CTokenMarket {
    const id = address.toHexString();
    let market: CTokenMarket | null = null;
    
    if (this.cTokenMarkets.has(id)) {
      market = this.cTokenMarkets.get(id);
    }
    
    if (market == null) {
      const loadedMarket = CTokenMarket.load(id);
      if (loadedMarket == null) {
        market = new CTokenMarket(id);
        market.symbol = "UNKNOWN";
        market.name = "UNKNOWN";
        market.decimals = 0;
        market.totalSupply = ZERO_BI;
        market.totalBorrows = ZERO_BI;
        market.totalReserves = ZERO_BI;
        market.exchangeRate = ZERO_BI;
        market.interestAccumulated = ZERO_BI;
        market.cashPrior = ZERO_BI;
        market.collateralFactor = ZERO_BI;
        market.borrowIndex = ZERO_BI;
        market.lastExchangeRateTimestamp = ZERO_BI;
        market.updatedAtBlock = blockNumber;
        market.updatedAtTimestamp = timestamp;
        market.liquidationIncentive = ZERO_BI;
        market.reserveFactor = ZERO_BI;
        market.baseRatePerBlock = ZERO_BI;
        market.multiplierPerBlock = ZERO_BI;
        market.jumpMultiplierPerBlock = ZERO_BI;
        market.kink = ZERO_BI;
      } else {
        market = loadedMarket;
      }
      this.cTokenMarkets.set(id, market);
    }
    return market;
  }

  // Get or create account market with batching
  getOrCreateAccountMarket(
    accountId: string, 
    marketId: string, 
    blockNumber: BigInt, 
    timestamp: BigInt
  ): AccountMarket {
    const id = accountId + "-" + marketId;
    let accountMarket: AccountMarket | null = null;
    
    if (this.accountMarkets.has(id)) {
      accountMarket = this.accountMarkets.get(id);
    }
    
    if (accountMarket == null) {
      const loadedAccountMarket = AccountMarket.load(id);
      if (loadedAccountMarket == null) {
        accountMarket = new AccountMarket(id);
        accountMarket.account = accountId;
        accountMarket.cTokenMarket = marketId;
        accountMarket.supplyBalance = ZERO_BI;
        accountMarket.borrowBalance = ZERO_BI;
        accountMarket.collateralBalance = ZERO_BI;
        accountMarket.supplyIndex = ZERO_BI;
        accountMarket.borrowIndex = ZERO_BI;
        accountMarket.createdAtBlock = blockNumber;
        accountMarket.createdAtTimestamp = timestamp;
        accountMarket.updatedAtBlock = blockNumber;
        accountMarket.updatedAtTimestamp = timestamp;
      } else {
        accountMarket = loadedAccountMarket;
      }
      this.accountMarkets.set(id, accountMarket);
    }
    return accountMarket;
  }

  // Save all batched entities
  saveAll(): void {
    // Save accounts
    for (let i = 0; i < this.accounts.values().length; i++) {
      this.accounts.values()[i].save();
    }

    // Save cToken markets
    for (let i = 0; i < this.cTokenMarkets.values().length; i++) {
      this.cTokenMarkets.values()[i].save();
    }

    // Save account markets
    for (let i = 0; i < this.accountMarkets.values().length; i++) {
      this.accountMarkets.values()[i].save();
    }

    // Save collections
    for (let i = 0; i < this.collections.values().length; i++) {
      this.collections.values()[i].save();
    }

    // Save vaults
    for (let i = 0; i < this.vaults.values().length; i++) {
      this.vaults.values()[i].save();
    }

    // Save collection participations
    for (let i = 0; i < this.collectionParticipations.values().length; i++) {
      this.collectionParticipations.values()[i].save();
    }

    log.info("BatchContext: Saved {} accounts, {} markets, {} account markets", [
      this.accounts.size.toString(),
      this.cTokenMarkets.size.toString(), 
      this.accountMarkets.size.toString()
    ]);
  }
}

export { BatchContext };