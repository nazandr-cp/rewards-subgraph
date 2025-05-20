import { Address, BigDecimal, BigInt, Bytes } from "@graphprotocol/graph-ts";
import { Account, AccountCollectionReward, CollectionReward } from "../../generated/schema";

// TODO: Replace with actual addresses
export const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
export const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");

export enum RewardBasis {
    DEPOSIT,
    BORROW
}

export enum WeightFunctionType {
    LINEAR,
    EXPONENTIAL,
    POWER // Added based on usage in weight function
}

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

export function getOrCreateCollectionReward(
    nftCollectionAddress: Address,
    rewardTokenAddress: Address,
    cTokenMarketForActivity: Address,
    rewardBasis: RewardBasis,
    initialWeightFnType: WeightFunctionType,
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
        collectionReward.rewardBasis = rewardBasis == RewardBasis.BORROW ? "BORROW" : "DEPOSIT";
        collectionReward.totalSecondsAccrued = ZERO_BI;
        collectionReward.lastUpdate = eventTimestamp;
        // fnType assignment
        if (initialWeightFnType == WeightFunctionType.EXPONENTIAL) {
            collectionReward.fnType = "EXPONENTIAL";
        } else if (initialWeightFnType == WeightFunctionType.POWER) {
            collectionReward.fnType = "POWER";
        } else {
            collectionReward.fnType = "LINEAR"; // Default
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

    if (meta.fnType == "LINEAR") { // Compare with string representation
        return meta.p1.toBigDecimal().times(n_bd).plus(meta.p2.toBigDecimal());
    } else if (meta.fnType == "EXPONENTIAL") { // Compare with string representation
        let k_bd = meta.p2.toBigDecimal();
        let kn = k_bd.times(n_bd);
        let A_bd = meta.p1.toBigDecimal();
        return A_bd.times(approxExponentialTerm(kn));
    } else if (meta.fnType == "POWER") { // Compare with string representation
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
    if (coll.rewardBasis == "DEPOSIT") { // Changed from rewardActivityType
        basePrincipalForReward = currentDepositU(acr.account, coll.cTokenMarketAddress);
    } else if (coll.rewardBasis == "BORROW") { // Changed from rewardActivityType
        basePrincipalForReward = currentBorrowU(acr.account, coll.cTokenMarketAddress);
    }

    let nftHoldingWeight = weight(acr.balanceNFT.toI32(), coll);
    let combinedEffectiveValue = basePrincipalForReward.plus(nftHoldingWeight);

    // Placeholder for rewardRateMultiplier logic.
    // This needs to be determined based on how `coll.rewardBasis` (which is "DEPOSIT" or "BORROW")
    // translates to a rate. For now, using ONE_BD to avoid breaking calculations.
    let rewardRateMultiplier = ONE_BD;

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
