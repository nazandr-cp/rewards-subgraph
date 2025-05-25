import { Address, BigInt, Bytes, log, crypto } from "@graphprotocol/graph-ts";
import { Account, AccountCollectionReward, CollectionReward, CTokenMarket, MarketData, CollectionMarket, Vault, AccountVault } from "../../generated/schema";
import { cToken } from '../../generated/cToken/cToken';

export const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0xf43EE9653ff96AB50C270eC3D9f0A8e015Df4065");
export const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x663702880Ec335BB1fae3ca05915B2D24F2b6A48");

export enum WeightFunctionType {
    LINEAR,
    EXPONENTIAL,
}

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ADDRESS_ZERO_STR = "0x0000000000000000000000000000000000000000";
export const ZERO_ADDRESS = Address.fromString(ADDRESS_ZERO_STR);
export const EXP_SCALE = BigInt.fromString('1000000000000000000');

export function exponentToBigInt(decimals: i32): BigInt {
    let bi = BigInt.fromI32(1);
    for (let i = 0; i < decimals; i++) {
        bi = bi.times(BigInt.fromI32(10));
    }
    return bi;
}

function approxExponentialTerm(val: BigInt): BigInt {
    const term1 = val;
    const term2 = val.times(val).div(EXP_SCALE).div(BigInt.fromI32(2));
    return term1.plus(term2);
}

export function getOrCreateAccount(accountAddress: Bytes): Account {
    log.info("getOrCreateAccount: Input accountAddress: {}", [accountAddress.toHexString()]);
    let account = Account.load(accountAddress.toHexString());
    if (account == null) {
        account = new Account(accountAddress.toHexString());
        account.totalSecondsClaimed = ZERO_BI;
        account.save();
        log.info("getOrCreateAccount: Created new account with ID: {}", [account.id]);
    } else {
        log.info("getOrCreateAccount: Loaded existing account with ID: {}", [account.id]);
    }
    return account;
}

// ID Generation Helpers
export function generateCollectionRewardId(collectionAddress: Address, rewardTokenAddress: Address): Bytes {
    return Bytes.fromByteArray(crypto.keccak256(collectionAddress.concat(rewardTokenAddress)));
}

export function generateAccountCollectionRewardId(userAccountEntityId: string, collectionRewardId: Bytes): Bytes {
    log.info("generateAccountCollectionRewardId: userAccountEntityId: {}, collectionRewardId: {}", [userAccountEntityId, collectionRewardId.toHexString()]);
    const accountBytes = Bytes.fromHexString(userAccountEntityId);
    const id = Bytes.fromByteArray(crypto.keccak256(accountBytes.concat(collectionRewardId)));
    log.info("generateAccountCollectionRewardId: Generated ID: {}", [id.toHexString()]);
    return id;
}

export function getOrCreateCollectionReward(
    nftCollectionAddress: Address,
    rewardTokenAddress: Address,
    cTokenMarketForActivity: Address,
    isBorrowBased: boolean,
    initialWeightFnType: WeightFunctionType,
    eventTimestamp: BigInt
): CollectionReward {
    const id = generateCollectionRewardId(nftCollectionAddress, rewardTokenAddress);
    let collectionReward = CollectionReward.load(id);

    if (collectionReward == null) {
        collectionReward = new CollectionReward(id);
        collectionReward.collection = nftCollectionAddress;
        collectionReward.rewardToken = rewardTokenAddress;
        collectionReward.cTokenMarketAddress = cTokenMarketForActivity;
        collectionReward.isBorrowBased = isBorrowBased;
        collectionReward.collectionType = "ERC721";
        collectionReward.totalSecondsAccrued = ZERO_BI;
        collectionReward.lastUpdate = eventTimestamp;
        if (initialWeightFnType == WeightFunctionType.EXPONENTIAL) {
            collectionReward.fnType = "EXPONENTIAL";
        } else {
            collectionReward.fnType = "LINEAR";
        }
        collectionReward.p1 = ZERO_BI;
        collectionReward.p2 = ZERO_BI;

        collectionReward.rewardPerSecond = ZERO_BI;
        collectionReward.totalRewardsPool = ZERO_BI;
        collectionReward.expiresAt = ZERO_BI;

        collectionReward.save();
    }
    return collectionReward;
}

export function getOrCreateAccountCollectionReward(
    account: Account,
    collectionReward: CollectionReward,
    eventTimestamp: BigInt
): AccountCollectionReward {
    const id = generateAccountCollectionRewardId(account.id, collectionReward.id);

    let acr = AccountCollectionReward.load(id);
    if (acr == null) {
        acr = new AccountCollectionReward(id);
        acr.account = account.id;
        acr.collection = collectionReward.id;
        acr.rewardToken = collectionReward.rewardToken;
        acr.lastUpdate = eventTimestamp;
        acr.balanceNFT = ZERO_BI;
        acr.seconds = ZERO_BI;
        acr.save();
    }
    return acr;
}

export function currentDepositU(
    user: Address,
    cTokenAddr: Address,
): BigInt {
    const cTokenInstance = cToken.bind(cTokenAddr);

    log.info("currentDepositU: Calling try_balanceOf for user {} and cToken {}", [user.toHexString(), cTokenAddr.toHexString()]);
    const balRes = cTokenInstance.try_balanceOf(user);
    if (balRes.reverted) {
        log.warning("currentDepositU: try_balanceOf reverted for user {} and cToken {}", [user.toHexString(), cTokenAddr.toHexString()]);
        return BigInt.zero();
    }
    const cBal = balRes.value;
    log.info("currentDepositU: try_balanceOf returned cBal: {}", [cBal.toString()]);

    log.info("currentDepositU: Calling try_exchangeRateStored for cToken {}", [cTokenAddr.toHexString()]);
    const rateRes = cTokenInstance.try_exchangeRateStored();
    if (rateRes.reverted) {
        log.warning("currentDepositU: try_exchangeRateStored reverted for cToken {}", [cTokenAddr.toHexString()]);
        return BigInt.zero();
    }
    const rate = rateRes.value;
    log.info("currentDepositU: try_exchangeRateStored returned rate: {}", [rate.toString()]);

    return cBal.times(rate).div(EXP_SCALE);
}

export function currentBorrowU(
    user: Address,
    cTokenAddr: Address,
): BigInt {
    const cTokenInstance = cToken.bind(cTokenAddr);

    log.info("currentBorrowU: Calling try_borrowBalanceStored for user {} and cToken {}", [user.toHexString(), cTokenAddr.toHexString()]);
    const borrowRes = cTokenInstance.try_borrowBalanceStored(user);
    if (borrowRes.reverted) {
        log.warning("currentBorrowU: try_borrowBalanceStored reverted for user {} and cToken {}", [user.toHexString(), cTokenAddr.toHexString()]);
        return BigInt.zero();
    }

    log.info("currentBorrowU: try_borrowBalanceStored returned borrowRes: {}", [borrowRes.value.toString()]);
    return borrowRes.value;
}

const MAX_NFT_COUNT_FOR_WEIGHT_CALC = BigInt.fromI32(1000000);

export function weight(nftCount: BigInt, meta: CollectionReward): BigInt {
    const n_bi = nftCount.gt(MAX_NFT_COUNT_FOR_WEIGHT_CALC) ? MAX_NFT_COUNT_FOR_WEIGHT_CALC : nftCount;

    if (meta.fnType == "LINEAR") {
        return meta.p1.times(n_bi).plus(meta.p2);
    } else if (meta.fnType == "EXPONENTIAL") {
        const k_bi = meta.p2;
        const A_bi = meta.p1;
        const kn_scaled = k_bi.times(n_bi);
        return A_bi.times(approxExponentialTerm(kn_scaled)).div(EXP_SCALE);
    } else {
        return ZERO_BI;
    }
}

export function accrueSeconds(acr: AccountCollectionReward, coll: CollectionReward, now: BigInt): void {
    const dt = now.minus(acr.lastUpdate);
    if (dt.isZero() || dt.lt(ZERO_BI)) {
        return;
    }

    let basePrincipalForReward = ZERO_BI;

    log.info("accrueSeconds: acr.account: {}, coll.cTokenMarketAddress: {}", [
        acr.account,
        coll.cTokenMarketAddress.toHexString()
    ]);
    if (acr.account.length != 42 || coll.cTokenMarketAddress.toHexString().length != 42) { // Check for 0x prefix + 40 hex chars
        log.warning("Invalid address string length for accrueSeconds. Account: {}, cToken: {}", [
            acr.account,
            coll.cTokenMarketAddress.toHexString()
        ]);
        return;
    }

    log.debug("accrueSeconds: Attempting Address.fromString(acr.account): {}", [acr.account]);
    log.debug("accrueSeconds: Attempting Address.fromBytes(coll.cTokenMarketAddress): {}", [coll.cTokenMarketAddress.toHexString()]);

    if (!coll.isBorrowBased) {
        basePrincipalForReward = currentDepositU(Address.fromString(acr.account), Address.fromBytes(coll.cTokenMarketAddress));
    } else {
        basePrincipalForReward = currentBorrowU(Address.fromString(acr.account), Address.fromBytes(coll.cTokenMarketAddress));
    }

    log.info("accrueSeconds: basePrincipalForReward: {}", [basePrincipalForReward.toString()]);
    const nftHoldingWeight = weight(acr.balanceNFT, coll);
    log.info("accrueSeconds: nftHoldingWeight: {}", [nftHoldingWeight.toString()]);
    const combinedEffectiveValue = basePrincipalForReward.plus(nftHoldingWeight);
    log.info("accrueSeconds: combinedEffectiveValue: {}", [combinedEffectiveValue.toString()]);

    const rewardRateMultiplier = EXP_SCALE;

    const finalValueWithRate = combinedEffectiveValue.times(rewardRateMultiplier).div(EXP_SCALE);
    const rewardAccruedScaled = finalValueWithRate.times(dt);

    if (rewardAccruedScaled.lt(ZERO_BI)) {
        log.critical(
            "Negative rewardAccruedScaled for account {}, collection {}. Values: rewardAccruedScaled = {}, basePrincipalForReward = {}, nftHoldingWeight = {}, dt = {}. Reverting.",
            [
                acr.account,
                coll.collection.toHexString(),
                rewardAccruedScaled.toString(),
                basePrincipalForReward.toString(),
                nftHoldingWeight.toString(),
                dt.toString()
            ]
        );
        assert(false);
    }

    acr.seconds = acr.seconds.plus(rewardAccruedScaled.div(EXP_SCALE));
    coll.totalSecondsAccrued = coll.totalSecondsAccrued.plus(rewardAccruedScaled.div(EXP_SCALE));
    acr.lastUpdate = now;
}

export function getOrCreateCTokenMarket(address: Address, timestamp: BigInt): CTokenMarket {
    let cTokenMarket = CTokenMarket.load(address.toHexString());
    if (cTokenMarket == null) {
        cTokenMarket = new CTokenMarket(address.toHexString());
        cTokenMarket.underlying = ZERO_ADDRESS;
        cTokenMarket.underlyingSymbol = "";
        cTokenMarket.underlyingDecimals = 0;
        cTokenMarket.totalSupplyC = ZERO_BI;
        cTokenMarket.totalBorrowsU = ZERO_BI;
        cTokenMarket.totalReservesU = ZERO_BI;
        cTokenMarket.exchangeRate = ZERO_BI;
        cTokenMarket.collateralFactor = ZERO_BI;
        cTokenMarket.borrowIndex = ZERO_BI;
        cTokenMarket.lastAccrualTimestamp = timestamp;
        cTokenMarket.blockTimestamp = timestamp;
        cTokenMarket.save();
    }
    return cTokenMarket;
}

export function getOrCreateMarketData(address: Address, timestamp: BigInt): MarketData {
    let marketData = MarketData.load(address.toHexString());
    if (marketData == null) {
        marketData = new MarketData(address.toHexString());
        marketData.totalSupply = ZERO_BI;
        marketData.totalBorrow = ZERO_BI;
        marketData.totalReserves = ZERO_BI;
        marketData.accruedInterest = ZERO_BI;
        marketData.lastInterestUpdate = timestamp;
        marketData.save();
    }
    return marketData;
}

export function getOrCreateCollectionMarket(collection: Address, market: Address): CollectionMarket {
    const id = Bytes.fromByteArray(crypto.keccak256(collection.concat(market)));
    let collectionMarket = CollectionMarket.load(id);
    if (collectionMarket == null) {
        collectionMarket = new CollectionMarket(id);
        collectionMarket.collection = collection;
        collectionMarket.market = market;
        collectionMarket.totalNFT = ZERO_BI;
        collectionMarket.totalSeconds = ZERO_BI;
        collectionMarket.principalU = ZERO_BI;
        collectionMarket.save();
    }
    return collectionMarket;
}

export function getOrCreateVault(vaultAddress: Address): Vault {
    let vault = Vault.load(vaultAddress.toHexString());
    if (vault == null) {
        vault = new Vault(vaultAddress.toHexString());
        vault.rewardPerBlock = ZERO_BI;
        vault.globalRPW = ZERO_BI;
        vault.totalWeight = ZERO_BI;
        vault.lastUpdateBlock = ZERO_BI;
        vault.weightByBorrow = false;
        vault.useExp = false;
        vault.linK = ZERO_BI;
        vault.expR = ZERO_BI;
        vault.save();
    }
    return vault;
}

export function getOrCreateAccountVault(accountId: string, vaultId: string): AccountVault {
    const id = accountId.concat("-").concat(vaultId);
    let accountVault = AccountVault.load(id);
    if (accountVault == null) {
        accountVault = new AccountVault(id);
        accountVault.account = accountId;
        accountVault.vault = vaultId;
        accountVault.weight = ZERO_BI;
        accountVault.rewardDebt = ZERO_BI;
        accountVault.accrued = ZERO_BI;
        accountVault.claimable = ZERO_BI;
        accountVault.save();
    }
    return accountVault;
}
