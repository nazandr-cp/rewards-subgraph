import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Account, AccountCollectionReward, CollectionReward, CTokenMarket } from "../../generated/schema";

// TODO: Replace with actual addresses
export const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
export const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ZERO_BD = BigDecimal.fromString("0");
export const ONE_BD = BigDecimal.fromString("1");
const TWO_BD = BigDecimal.fromString("2");
export const ADDRESS_ZERO_STR = "0x0000000000000000000000000000000000000000";

export function exponentToBigDecimal(decimals: i32): BigDecimal {
    let bd = BigDecimal.fromString("1");
    for (let i = 0; i < decimals; i++) {
        bd = bd.times(BigDecimal.fromString("10"));
    }
    return bd;
}

function power(base: BigDecimal, exponent: i32): BigDecimal {
    if (exponent < 0) {
        return ZERO_BD;
    }
    if (exponent == 0) {
        return ONE_BD;
    }
    if (base.equals(ZERO_BD)) {
        return ZERO_BD;
    }
    let res = ONE_BD;
    for (let i = 0; i < exponent; i++) {
        res = res.times(base);
    }
    return res;
}

function approxExponentialTerm(val: BigDecimal): BigDecimal {
    const term1 = val;
    const term2 = power(val, 2).div(TWO_BD);
    return term1.plus(term2);
}

export function getOrCreateAccount(accountAddress: Bytes): Account {
    let account = Account.load(accountAddress);
    if (account == null) {
        account = new Account(accountAddress);
        account.save();
    }
    return account;
}

// Removed unused getOrCreateCTokenMarket helper.
// The cToken-mapping.ts file has its own more detailed version.

export function getOrCreateCollectionReward(
    nftCollectionAddress: Address,
    rewardTokenAddress: Address,
    cTokenMarketForActivity: Address,
    activityType: String,
    initialRewardBasis: i32,
    initialWeightFnType: i32, // This is for the NFT weight function
    eventTimestamp: BigInt
): CollectionReward {
    let idString = nftCollectionAddress.toHex() + "-" + rewardTokenAddress.toHex();
    let id = Bytes.fromHexString(idString);
    let collectionReward = CollectionReward.load(id);

    if (collectionReward == null) {
        collectionReward = new CollectionReward(id);
        collectionReward.collection = nftCollectionAddress;
        collectionReward.rewardToken = rewardTokenAddress;
        collectionReward.cTokenMarketAddress = cTokenMarketForActivity;
        collectionReward.rewardActivityType = activityType.toString();
        collectionReward.totalSecondsAccrued = ZERO_BI;
        collectionReward.lastUpdate = eventTimestamp;
        collectionReward.rewardBasis = initialRewardBasis;
        collectionReward.fnType = initialWeightFnType;
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
    let idString = account.id.toHexString() + "-" + collectionReward.id.toHexString();
    let id = Bytes.fromHexString(idString);

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

// Placeholder implementation, requires actual cToken contract calls
export function currentDepositU(accountAddress: Bytes, cTokenMarketAddress: Bytes): BigDecimal {
    // Example:
    // let cToken = CToken.bind(Address.fromBytes(cTokenMarketAddress));
    // let balance = cToken.try_balanceOfUnderlying(Address.fromBytes(accountAddress));
    // if (!balance.reverted) {
    //     let market = CTokenMarket.load(cTokenMarketAddress);
    //     if (market) {
    //         return balance.value.toBigDecimal().div(exponentToBigDecimal(market.underlyingDecimals));
    //     }
    // }
    return ZERO_BD;
}

// Placeholder implementation, requires actual cToken contract calls
export function currentBorrowU(accountAddress: Bytes, cTokenMarketAddress: Bytes): BigDecimal {
    // Example:
    // let cToken = CToken.bind(Address.fromBytes(cTokenMarketAddress));
    // let balance = cToken.try_borrowBalanceCurrent(Address.fromBytes(accountAddress));
    // if (!balance.reverted) {
    //     let market = CTokenMarket.load(cTokenMarketAddress);
    //     if (market) {
    //         return balance.value.toBigDecimal().div(exponentToBigDecimal(market.underlyingDecimals));
    //     }
    // }
    return ZERO_BD;
}

export function weight(n: i32, meta: CollectionReward): BigDecimal {
    let n_bd = BigDecimal.fromString(n.toString());
    if (meta.fnType == 0) { // Linear
        return meta.p1.toBigDecimal().times(n_bd).plus(meta.p2.toBigDecimal());
    } else if (meta.fnType == 1) { // Exponential approx
        let k_bd = meta.p2.toBigDecimal();
        let kn = k_bd.times(n_bd);
        let A_bd = meta.p1.toBigDecimal();
        return A_bd.times(approxExponentialTerm(kn));
    } else if (meta.fnType == 2) { // Power
        let A_bd = meta.p1.toBigDecimal();
        let b_bd = meta.p2.toBigDecimal();
        return A_bd.times(power(b_bd, n));
    } else {
        return ZERO_BD;
    }
}

export function accrueSeconds(acr: AccountCollectionReward, coll: CollectionReward, now: BigInt): void {
    let dt = now.minus(acr.lastUpdate);
    if (dt.isZero() || dt.lt(ZERO_BI)) {
        return;
    }

    let basePrincipalForReward = ZERO_BD;
    if (coll.rewardActivityType == "DEPOSIT") {
        basePrincipalForReward = currentDepositU(acr.account, coll.cTokenMarketAddress);
    } else if (coll.rewardActivityType == "BORROW") {
        basePrincipalForReward = currentBorrowU(acr.account, coll.cTokenMarketAddress);
    }

    let nftHoldingWeight = weight(acr.balanceNFT.toI32(), coll);
    let combinedEffectiveValue = basePrincipalForReward.plus(nftHoldingWeight);

    let rewardRateMultiplier = BigDecimal.fromString(coll.rewardBasis.toString()).div(BigDecimal.fromString("10000"));

    let finalValueWithRate = combinedEffectiveValue.times(rewardRateMultiplier);
    let secDelta = finalValueWithRate.times(dt.toBigDecimal());

    if (secDelta.lt(ZERO_BD)) {
        secDelta = ZERO_BD;
    }

    acr.seconds = acr.seconds.plus(BigInt.fromString(secDelta.truncate(0).toString()));
    coll.totalSecondsAccrued = coll.totalSecondsAccrued.plus(BigInt.fromString(secDelta.truncate(0).toString()));
    acr.lastUpdate = now;
    // Caller saves acr and coll
}

// Removed unused normalizeTo18Decimals helper.
// The collection-vault-mapping.ts uses its own internal helper for BigInt normalization.
// The placeholder functions currentDepositU/currentBorrowU, when implemented,
// should return BigDecimal values already scaled to standard units (e.g., 1.0 for 1 USDC).

