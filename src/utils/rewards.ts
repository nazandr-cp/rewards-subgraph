import { Address, BigInt, Bytes, log } from "@graphprotocol/graph-ts";
import { Account, AccountCollectionReward, CollectionReward } from "../../generated/schema";
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
    isBorrowBased: boolean,
    initialWeightFnType: WeightFunctionType,
    eventTimestamp: BigInt
): CollectionReward {
    const idString = nftCollectionAddress.toHex() + "-" + rewardTokenAddress.toHex();
    const id = Bytes.fromHexString(idString);
    let collectionReward = CollectionReward.load(id);

    if (collectionReward == null) {
        collectionReward = new CollectionReward(id);
        collectionReward.collection = nftCollectionAddress;
        collectionReward.rewardToken = rewardTokenAddress;
        collectionReward.cTokenMarketAddress = cTokenMarketForActivity;
        collectionReward.isBorrowBased = isBorrowBased;
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
    const idString = account.id.toHexString() + "-" + collectionReward.id.toHexString();
    const id = Bytes.fromHexString(idString);

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

    const balRes = cTokenInstance.try_balanceOf(user);
    if (balRes.reverted) return BigInt.zero();
    const cBal = balRes.value;

    const rateRes = cTokenInstance.try_exchangeRateStored();
    if (rateRes.reverted) return BigInt.zero();
    const rate = rateRes.value;

    return cBal.times(rate).div(EXP_SCALE);
}

export function currentBorrowU(
    user: Address,
    cTokenAddr: Address,
): BigInt {
    const cTokenInstance = cToken.bind(cTokenAddr);

    const borrowRes = cTokenInstance.try_borrowBalanceStored(user);
    if (borrowRes.reverted) return BigInt.zero();

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
    if (!coll.isBorrowBased) {
        basePrincipalForReward = currentDepositU(Address.fromBytes(acr.account), Address.fromBytes(coll.cTokenMarketAddress));
    } else {
        basePrincipalForReward = currentBorrowU(Address.fromBytes(acr.account), Address.fromBytes(coll.cTokenMarketAddress));
    }

    const nftHoldingWeight = weight(acr.balanceNFT, coll);
    const combinedEffectiveValue = basePrincipalForReward.plus(nftHoldingWeight);

    const rewardRateMultiplier = EXP_SCALE;

    const finalValueWithRate = combinedEffectiveValue.times(rewardRateMultiplier).div(EXP_SCALE);
    const rewardAccruedScaled = finalValueWithRate.times(dt);

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
