import { BigInt, Bytes, Address, log, store } from "@graphprotocol/graph-ts";
import { ERC721, ERC1155 } from "../generated/templates";
import {
    CollectionReward,
    AccountCollectionReward,
    Account,
    RewardClaim,
    Vault,
    AccountVault
} from "../generated/schema";
import {
    ZERO_BI,
    getOrCreateCollectionReward,
    getOrCreateAccount,
    accrueSeconds,
    getOrCreateAccountCollectionReward,
    HARDCODED_REWARD_TOKEN_ADDRESS,
    HARDCODED_CTOKEN_MARKET_ADDRESS,
    RewardBasis,
    WeightFunctionType
} from "./utils/rewards";
import {
    NewCollectionWhitelisted,
    WhitelistCollectionRemoved,
    CollectionRewardShareUpdated,
    WeightFunctionSet,
    RewardsClaimedForLazy,
    BatchRewardsClaimedForLazy,
    RewardsController,
    RewardPerBlockUpdated as RewardPerBlockUpdatedEvent,
    RewardClaimed as RewardClaimedEvent
} from '../generated/RewardsController/RewardsController';

export function handleNewCollectionWhitelisted(event: NewCollectionWhitelisted): void {
    let nftCollectionAddress = event.params.collection;
    let rewardBasisParam = event.params.rewardBasis;
    let collectionTypeParam = event.params.collectionType;

    let rewardBasisEnum: RewardBasis;
    if (rewardBasisParam == 0) {
        rewardBasisEnum = RewardBasis.DEPOSIT;
    } else if (rewardBasisParam == 1) {
        rewardBasisEnum = RewardBasis.BORROW;
    } else {
        rewardBasisEnum = RewardBasis.BORROW;
        log.info(
            "NewCollectionWhitelisted: Unknown rewardBasisParam u8 {} for collection {}. Defaulting to BORROW.",
            [rewardBasisParam.toString(), nftCollectionAddress.toHexString()]
        );
    }

    let collReward = getOrCreateCollectionReward(
        nftCollectionAddress,
        HARDCODED_REWARD_TOKEN_ADDRESS,
        HARDCODED_CTOKEN_MARKET_ADDRESS,
        rewardBasisEnum,
        WeightFunctionType.LINEAR,
        event.block.timestamp
    );
    collReward.rewardPerSecond = event.params.sharePercentage;

    let collectionTypeString: string;
    if (collectionTypeParam == 0) {
        collectionTypeString = "ERC721";
    } else if (collectionTypeParam == 1) {
        collectionTypeString = "ERC1155";
    } else {
        collectionTypeString = "ERC721";
        log.warning(
            "NewCollectionWhitelisted: Unknown collectionTypeParam u8 {} for collection {}. Defaulting to ERC721.",
            [collectionTypeParam.toString(), nftCollectionAddress.toHexString()]
        );
    }
    collReward.collectionType = collectionTypeString;
    collReward.save();

    if (collectionTypeString == "ERC721") {
        ERC721.create(nftCollectionAddress);
        log.info("NewCollectionWhitelisted: Created ERC721 data source for collection {}", [nftCollectionAddress.toHexString()]);
    } else if (collectionTypeString == "ERC1155") {
        ERC1155.create(nftCollectionAddress);
        log.info("NewCollectionWhitelisted: Created ERC1155 data source for collection {}", [nftCollectionAddress.toHexString()]);
    }

    log.info("NewCollectionWhitelisted: Processed collection {}, type {}, rewardBasis (from event u8) {}, sharePercentage {}", [
        nftCollectionAddress.toHexString(),
        collectionTypeString,
        rewardBasisParam.toString(), // Log the original u8 from event
        event.params.sharePercentage.toString()
    ]);
}

export function handleWhitelistCollectionRemoved(event: WhitelistCollectionRemoved): void {
    let collectionAddress = event.params.collection;
    let collectionRewardIdString = collectionAddress.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);

    let existingReward = CollectionReward.load(collectionRewardId);
    if (existingReward != null) {
        store.remove("CollectionReward", collectionRewardId.toHexString());
        log.info("WhitelistCollectionRemoved: Removed CollectionReward {} for collection {}", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString()
        ]);
    } else {
        log.warning("WhitelistCollectionRemoved: CollectionReward with ID {} not found for collection {}. No action taken.", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString()
        ]);
    }
}

export function handleCollectionRewardShareUpdated(event: CollectionRewardShareUpdated): void {
    let collectionAddress = event.params.collection;
    let rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
    let newShare = event.params.newSharePercentage.toI32();

    let collectionRewardIdString = collectionAddress.toHex() + "-" + rewardToken.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);
    let collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        collReward.rewardPerSecond = event.params.newSharePercentage;
        collReward.lastUpdate = event.block.timestamp;
        collReward.save();
        log.info("CollectionRewardShareUpdated: Updated share for CollectionReward {} (collection {}, rewardToken {}). New share: {}", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString(),
            rewardToken.toHexString(),
            event.params.newSharePercentage.toString()
        ]);
    } else {
        log.warning("CollectionRewardShareUpdated: CollectionReward with ID {} not found for collection {} and rewardToken {}. No action taken.", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString(),
            rewardToken.toHexString()
        ]);
    }
}

export function handleWeightFunctionSet(event: WeightFunctionSet): void {
    let collectionAddress = event.params.collection;
    let rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
    let weightFnParams = event.params.fn;

    let collectionRewardIdString = collectionAddress.toHex() + "-" + rewardToken.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);
    let collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        let fnTypeU8 = weightFnParams.fnType;
        if (fnTypeU8 == WeightFunctionType.LINEAR) {
            collReward.fnType = "LINEAR";
        } else if (fnTypeU8 == WeightFunctionType.EXPONENTIAL) {
            collReward.fnType = "EXPONENTIAL";
        } else {
            collReward.fnType = "LINEAR";
            log.warning("handleWeightFunctionSet: Unknown fnType {} received for collection {}. Defaulting to LINEAR.", [fnTypeU8.toString(), collectionAddress.toHexString()]);
        }
        collReward.p1 = weightFnParams.p1;
        collReward.p2 = weightFnParams.p2;
        collReward.lastUpdate = event.block.timestamp;
        collReward.save();
        log.info("handleWeightFunctionSet: Updated weight function for CollectionReward {} (collection {}, rewardToken {}). fnType: {}, p1: {}, p2: {}", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString(),
            rewardToken.toHexString(),
            weightFnParams.fnType.toString(),
            weightFnParams.p1.toString(),
            weightFnParams.p2.toString()
        ]);
    } else {
        log.warning("handleWeightFunctionSet: CollectionReward with ID {} not found for collection {} and rewardToken {}. No action taken.", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString(),
            rewardToken.toHexString()
        ]);
    }
}

export function handleRewardsClaimedForLazy(event: RewardsClaimedForLazy): void {
    let userAddress = event.params.account;
    let collectionAddress = event.params.collection;
    let rewardTokenAddress: Address;

    let contract = RewardsController.bind(event.address);
    let vaultInfoTry = contract.try_vaultInfo();

    if (!vaultInfoTry.reverted) {
        rewardTokenAddress = vaultInfoTry.value.cToken;
        log.info("handleRewardsClaimedForLazy: rewardToken (cToken) {} successfully derived from vaultInfo for controller {}", [rewardTokenAddress.toHexString(), event.address.toHexString()]);
    } else {
        log.critical(
            "handleRewardsClaimedForLazy: try_vaultInfo() reverted for controller {}. Cannot determine rewardToken. Aborting processing for event in tx {}.",
            [event.address.toHexString(), event.transaction.hash.toHexString()]
        );
        return; // Prevent partial entity creation if rewardToken is missing
    }

    let userAccount = getOrCreateAccount(userAddress);

    let collectionRewardIdString = collectionAddress.toHex() + "-" + rewardTokenAddress.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);
    let collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        let acr = getOrCreateAccountCollectionReward(userAccount, collReward, event.block.timestamp);

        accrueSeconds(acr, collReward, event.block.timestamp);

        let claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
        let claim = new RewardClaim(claimId);
        claim.account = userAccount.id;
        claim.collectionAddress = collectionAddress;
        claim.amount = event.params.dueAmount;
        claim.timestamp = event.block.timestamp;
        claim.transactionHash = event.transaction.hash;
        claim.nonce = event.params.nonce;
        claim.secondsUser = event.params.secondsUser;
        claim.secondsColl = collReward.totalSecondsAccrued;
        claim.incRPS = event.params.incRPS;
        claim.yieldSlice = event.params.yieldSlice;

        claim.save();

        acr.seconds = acr.seconds.minus(event.params.secondsUser);
        if (acr.seconds.lt(ZERO_BI)) {
            log.warning("ACR seconds for user {} collection {} rewardToken {} went negative after claim. Clamping to zero.", [userAddress.toHexString(), collectionAddress.toHexString(), rewardTokenAddress.toHexString()]);
            acr.seconds = ZERO_BI;
        }
        acr.lastUpdate = event.block.timestamp;
        acr.save();

        collReward.lastUpdate = event.block.timestamp;
        collReward.save();

        log.info("RewardsClaimedForLazy: Processed claim for user {}, collection {}, rewardToken {}. Amount: {}, Seconds Claimed: {}", [
            userAddress.toHexString(),
            collectionAddress.toHexString(),
            rewardTokenAddress.toHexString(),
            event.params.dueAmount.toString(),
            event.params.secondsUser.toString()
        ]);

    } else {
        log.warning("RewardsClaimedForLazy: CollectionReward not found for collection {} and rewardToken {}. Claim for user {} not fully processed.", [
            collectionAddress.toHexString(),
            rewardTokenAddress.toHexString(),
            userAddress.toHexString()
        ]);
        let accountEntity = getOrCreateAccount(userAddress);
        let claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
        let claim = new RewardClaim(claimId);
        claim.account = accountEntity.id;
        claim.collectionAddress = collectionAddress;
        claim.amount = event.params.dueAmount;
        claim.timestamp = event.block.timestamp;
        claim.transactionHash = event.transaction.hash;
        claim.nonce = event.params.nonce;
        claim.secondsUser = event.params.secondsUser;
        claim.secondsColl = ZERO_BI;
        claim.incRPS = ZERO_BI;
        claim.yieldSlice = ZERO_BI;
        claim.save();
        log.info("RewardsClaimedForLazy: Saved partial RewardClaim for user {} due to missing CollectionReward.", [userAddress.toHexString()]);
    }
}

export function handleBatchRewardsClaimedForLazy(event: BatchRewardsClaimedForLazy): void {
    log.warning(
        "handleBatchRewardsClaimedForLazy: Event for caller {} with totalDue {} (numClaims: {}) lacks individual claim details.",
        [
            event.params.caller.toHexString(),
            event.params.totalDue.toString(),
            event.params.numClaims.toString()
        ]
    );

    let callerAccount = Account.load(event.params.caller);
    if (callerAccount == null) {
        callerAccount = new Account(event.params.caller);
        callerAccount.save();
    }
}

export function handleRewardPerBlockUpdated(event: RewardPerBlockUpdatedEvent): void {
    let vaultId = event.params.vault.toHex();
    let vault = Vault.load(vaultId);

    if (!vault) {
        vault = new Vault(vaultId);
        log.info("New Vault entity created: {}", [vaultId]);
    }

    let rewardsController = RewardsController.bind(event.address);
    let vaultInfo = rewardsController.try_vaultInfo();
    if (vaultInfo.reverted) {
        log.error("handleRewardPerBlockUpdated: contract.try_vault reverted for vault {}", [event.params.vault.toHex()]);
        return;
    }
    vault.rewardPerBlock = vaultInfo.value.rewardPerBlock;
    vault.globalRPW = vaultInfo.value.globalRPW;
    vault.totalWeight = vaultInfo.value.totalWeight;
    vault.lastUpdateBlock = vaultInfo.value.lastUpdateBlock;
    vault.weightByBorrow = vaultInfo.value.weightByBorrow;
    vault.useExp = vaultInfo.value.useExp;
    vault.linK = vaultInfo.value.linK;
    vault.expR = vaultInfo.value.expR;

    vault.save();
    log.info("Vault {} rewardPerBlock updated to {}", [vaultId, event.params.rewardPerBlock.toString()]);
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
    let vaultAddress = event.params.vault;
    let userAddress = event.params.user;
    let amountClaimed = event.params.amount;

    let vaultId = vaultAddress.toHex();
    let accountId = userAddress.toHex();
    let accountVaultId = vaultId + "-" + accountId;

    let vault = Vault.load(vaultId);
    if (!vault) {
        log.warning("Vault {} not found during RewardClaimed for user {}. Creating Vault.", [vaultId, accountId]);
        vault = new Vault(vaultId);
        let rewardsController = RewardsController.bind(event.address);
        let vaultInfo = rewardsController.try_vaultInfo();
        if (vaultInfo.reverted) {
            log.error("handleRewardClaimed: contract.try_vault reverted for vault {} (during vault creation)", [vaultAddress.toHex()]);
            return;
        }
        vault.rewardPerBlock = vaultInfo.value.rewardPerBlock;
        vault.globalRPW = vaultInfo.value.globalRPW;
        vault.totalWeight = vaultInfo.value.totalWeight;
        vault.lastUpdateBlock = vaultInfo.value.lastUpdateBlock;
        vault.weightByBorrow = vaultInfo.value.weightByBorrow;
        vault.useExp = vaultInfo.value.useExp;
        vault.linK = vaultInfo.value.linK;
        vault.expR = vaultInfo.value.expR;
        vault.save();
    } else {
        let contract = RewardsController.bind(event.address);
        let vaultInfoTry = contract.try_vaultInfo();
        if (vaultInfoTry.reverted) {
            log.error("handleRewardClaimed: contract.try_vault reverted for vault {} (during vault update)", [vaultAddress.toHex()]);
            return;
        }
        vault.globalRPW = vaultInfoTry.value.globalRPW;
        vault.lastUpdateBlock = vaultInfoTry.value.lastUpdateBlock;
        vault.totalWeight = vaultInfoTry.value.totalWeight;
        vault.save();
    }

    let accountVault = AccountVault.load(accountVaultId);
    if (!accountVault) {
        accountVault = new AccountVault(accountVaultId);
        accountVault.vault = vaultId;
        accountVault.account = userAddress;
    }

    accountVault.accrued = ZERO_BI;

    let contract = RewardsController.bind(event.address);
    let accountInfoTry = contract.try_acc(vaultAddress, userAddress);
    if (accountInfoTry.reverted) {
        log.error("handleRewardClaimed: contract.try_acc reverted for vault {} and user {}", [vaultAddress.toHex(), userAddress.toHex()]);
        return;
    }
    let accountInfoFromCall = accountInfoTry.value;

    accountVault.weight = accountInfoFromCall.weight;
    accountVault.rewardDebt = accountInfoFromCall.rewardDebt;

    accountVault.claimable = ZERO_BI;

    accountVault.save();

    log.info("AccountVault {} updated after claim. Amount: {}. New weight: {}, New rewardDebt: {}", [
        accountVaultId,
        amountClaimed.toString(),
        accountVault.weight.toString(),
        accountVault.rewardDebt.toString()
    ]);
}
