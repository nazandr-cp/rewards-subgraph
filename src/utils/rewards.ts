import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Account, AccountCollectionReward, CollectionReward } from "../../generated/schema";
import { cToken } from '../../generated/cToken/cToken';

export const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
export const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");

export enum RewardBasis {
    DEPOSIT,
    BORROW
}

export enum WeightFunctionType {
    LINEAR,
    EXPONENTIAL,
}

export const ZERO_BI = BigInt.fromI32(0);
export const ONE_BI = BigInt.fromI32(1);
export const ADDRESS_ZERO_STR = "0x0000000000000000000000000000000000000000";
export const EXP_SCALE = BigInt.fromString('1000000000000000000'); // 10^18

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

/**
 * Return the user’s current deposit principal in the underlying asset,
 * scaled to 1 × 10¹⁸ (WAD).
 * depositUnderlying = cTokenBalance × exchangeRateStored / 1e18
 */
export function currentDepositU(
    user: Address,
    cTokenAddr: Address,
): BigInt {
    // bind once – this is only a lightweight wrapper around `dataSource.address()`
    let cTokenInstance = cToken.bind(cTokenAddr);

    // 1. cToken balance
    let balRes = cTokenInstance.try_balanceOf(user);
    if (balRes.reverted) return BigInt.zero();
    let cBal = balRes.value;                         // 8-dec scale for Compound

    // 2. Exchange-rate (underlying / cToken), 18-dec scale
    let rateRes = cTokenInstance.try_exchangeRateStored();   // ↳ no accrue here – cheap & deterministic
    if (rateRes.reverted) return BigInt.zero();
    let rate = rateRes.value;

    // 3. Convert to underlying (still 18-dec after the division)
    return cBal.times(rate).div(EXP_SCALE);
}

/**
 * Return the user’s borrow principal in the underlying asset,
 * scaled to 1 × 10¹⁸ (WAD).
 * Compound’s borrowBalanceStored() already returns the figure in
 * underlying-units × 1e18, so we can forward it directly.
 */
export function currentBorrowU(
    user: Address,
    cTokenAddr: Address,
): BigInt {
    let cTokenInstance = cToken.bind(cTokenAddr);

    let borrowRes = cTokenInstance.try_borrowBalanceStored(user);
    if (borrowRes.reverted) return BigInt.zero();

    // value is already 18-dec scaled
    return borrowRes.value;
}

const MAX_NFT_COUNT_FOR_WEIGHT_CALC = BigInt.fromI32(1000000);

export function weight(nftCount: BigInt, meta: CollectionReward): BigInt {
    let n_bi = nftCount.gt(MAX_NFT_COUNT_FOR_WEIGHT_CALC) ? MAX_NFT_COUNT_FOR_WEIGHT_CALC : nftCount;

    if (meta.fnType == "LINEAR") {
        return meta.p1.times(n_bi).plus(meta.p2);
    } else if (meta.fnType == "EXPONENTIAL") {
        let k_bi = meta.p2;
        let A_bi = meta.p1;
        let kn_scaled = k_bi.times(n_bi);
        return A_bi.times(approxExponentialTerm(kn_scaled)).div(EXP_SCALE);
    } else {
        return ZERO_BI;
    }
}

export function accrueSeconds(acr: AccountCollectionReward, coll: CollectionReward, now: BigInt): void {
    let dt = now.minus(acr.lastUpdate);
    if (dt.isZero() || dt.lt(ZERO_BI)) {
        return;
    }

    let basePrincipalForReward = ZERO_BI;
    if (coll.rewardBasis == "DEPOSIT") {
        basePrincipalForReward = currentDepositU(Address.fromBytes(acr.account), Address.fromBytes(coll.cTokenMarketAddress));
    } else if (coll.rewardBasis == "BORROW") {
        basePrincipalForReward = currentBorrowU(Address.fromBytes(acr.account), Address.fromBytes(coll.cTokenMarketAddress));
    }

    let nftHoldingWeight = weight(acr.balanceNFT, coll);
    let combinedEffectiveValue = basePrincipalForReward.plus(nftHoldingWeight);

    let rewardRateMultiplier = EXP_SCALE;

    let finalValueWithRate = combinedEffectiveValue.times(rewardRateMultiplier).div(EXP_SCALE);
    let rewardAccruedScaled = finalValueWithRate.times(dt);

    if (rewardAccruedScaled.lt(ZERO_BI)) {
        log.critical(
            "Negative rewardAccruedScaled for account {}, collection {}. Values: rewardAccruedScaled = {}, basePrincipalForReward = {}, nftHoldingWeight = {}, dt = {}. Reverting.",
            [
                acr.account.toHexString(),
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
