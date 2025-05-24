import { Address, log, store, BigInt } from "@graphprotocol/graph-ts";
import { ERC721, ERC1155 } from "../generated/templates";
import {
    CollectionReward,
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
    WeightFunctionType,
    generateCollectionRewardId
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
    const nftCollectionAddress = event.params.collection;
    const rewardBasisParam = event.params.rewardBasis;
    const collectionTypeParam = event.params.collectionType;

    let isBorrowBased: boolean;
    if (rewardBasisParam == 0) {
        isBorrowBased = false;
    } else if (rewardBasisParam == 1) {
        isBorrowBased = true;
    } else {
        isBorrowBased = true;
        log.info(
            "NewCollectionWhitelisted: Unknown rewardBasisParam u8 {} for collection {}. Defaulting to isBorrowBased = true.",
            [rewardBasisParam.toString(), nftCollectionAddress.toHexString()]
        );
    }

    const collReward = getOrCreateCollectionReward(
        nftCollectionAddress,
        HARDCODED_REWARD_TOKEN_ADDRESS,
        HARDCODED_CTOKEN_MARKET_ADDRESS,
        isBorrowBased,
        WeightFunctionType.LINEAR,
        event.block.timestamp
    );
    collReward.rewardPerSecond = BigInt.fromI32(event.params.sharePercentage);

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
    const collectionAddress = event.params.collection;
    const collectionRewardId = generateCollectionRewardId(collectionAddress, HARDCODED_REWARD_TOKEN_ADDRESS);

    const existingReward = CollectionReward.load(collectionRewardId);
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
    const collectionAddress = event.params.collection;
    const rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;

    const collectionRewardId = generateCollectionRewardId(collectionAddress, rewardToken);
    const collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        collReward.rewardPerSecond = BigInt.fromI32(event.params.newSharePercentage);
        collReward.lastUpdate = event.block.timestamp;
        collReward.save();
    } else {
        log.warning("CollectionRewardShareUpdated: CollectionReward with ID {} not found for collection {} and rewardToken {}. No action taken.", [
            collectionRewardId.toHexString(),
            collectionAddress.toHexString(),
            rewardToken.toHexString()
        ]);
    }
}

export function handleWeightFunctionSet(event: WeightFunctionSet): void {
    const collectionAddress = event.params.collection;
    const rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
    const weightFnParams = event.params.fn;

    const collectionRewardId = generateCollectionRewardId(collectionAddress, rewardToken);
    const collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        const fnTypeU8 = weightFnParams.fnType;
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
    const userAddress = event.params.account;
    const collectionAddress = event.params.collection;

    const contract = RewardsController.bind(event.address) as RewardsController;
    log.info("handleRewardsClaimedForLazy: Calling contract.try_vault() for address {}", [event.address.toHex()]);
    const rewardTokenAddressCall = contract.try_vault();
    if (rewardTokenAddressCall.reverted) {
        log.error("handleRewardsClaimedForLazy: contract.try_vault() reverted. Skipping processing for user {} and collection {}.", [userAddress.toHex(), collectionAddress.toHex()]);
        return;
    }
    log.info("handleRewardsClaimedForLazy: contract.try_vault() returned value. Accessing .value", []);
    const rewardTokenAddress: Address = rewardTokenAddressCall.value;
    log.info("handleRewardsClaimedForLazy: rewardTokenAddress: {}", [rewardTokenAddress.toHex()]);

    const userAccount = getOrCreateAccount(userAddress);

    const collectionRewardId = generateCollectionRewardId(collectionAddress, rewardTokenAddress);
    const collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        const acr = getOrCreateAccountCollectionReward(userAccount, collReward, event.block.timestamp);

        accrueSeconds(acr, collReward, event.block.timestamp);

        const claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
        const claim = new RewardClaim(claimId);
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
    } else {
        log.warning("RewardsClaimedForLazy: CollectionReward not found for collection {} and rewardToken {}. Claim for user {} not fully processed.", [
            collectionAddress.toHexString(),
            rewardTokenAddress.toHexString(),
            userAddress.toHexString()
        ]);
        const accountEntity = getOrCreateAccount(userAddress);
        const claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
        const claim = new RewardClaim(claimId);
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

    getOrCreateAccount(event.params.caller);
}

export function handleRewardPerBlockUpdated(event: RewardPerBlockUpdatedEvent): void {
    const vaultId = event.params.vault.toHex();
    let vault = Vault.load(vaultId);

    if (!vault) {
        vault = new Vault(vaultId);
        log.info("New Vault entity created: {}", [vaultId]);
    }

    const rewardsController = RewardsController.bind(event.address) as RewardsController;
    const vaultInfo = rewardsController.try_vaults(event.params.vault);
    if (vaultInfo.reverted) {
        log.error("handleRewardPerBlockUpdated: contract.try_vaults reverted for vault {}", [event.params.vault.toHex()]);
        return;
    }
    vault.rewardPerBlock = event.params.rewardPerBlock;
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
    const vaultAddress = event.params.vault;
    const userAddress = event.params.user;
    const amountClaimed = event.params.amount;

    const vaultId = vaultAddress.toHex();
    const accountId = userAddress.toHex();
    const accountVaultId = vaultId + "-" + accountId;

    let vault = Vault.load(vaultId);
    if (!vault) {
        log.warning("Vault {} not found during RewardClaimed for user {}. Creating Vault.", [vaultId, accountId]);
        vault = new Vault(vaultId);
        const rewardsController = RewardsController.bind(event.address) as RewardsController;
        log.info("handleRewardClaimed: Calling try_vaults with vaultAddress: {}", [vaultAddress.toHex()]);
        const vaultInfo = rewardsController.try_vaults(vaultAddress);
        if (vaultInfo.reverted) {
            log.error("handleRewardClaimed: contract.try_vaults reverted for vault {} (during vault creation)", [vaultAddress.toHex()]);
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
        const contract = RewardsController.bind(event.address) as RewardsController;
        log.info("handleRewardClaimed: Calling try_vaults with vaultAddress: {}", [vaultAddress.toHex()]);
        const vaultInfoTry = contract.try_vaults(vaultAddress);
        if (vaultInfoTry.reverted) {
            log.error("handleRewardClaimed: contract.try_vaults reverted for vault {} (during vault update)", [vaultAddress.toHex()]);
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
        accountVault.vault = vault.id; // Changed: Use vault.id (which is a string) instead of vaultId (Bytes)
        accountVault.account = userAddress.toHexString();
    }

    accountVault.accrued = ZERO_BI;

    const contract = RewardsController.bind(event.address) as RewardsController;
    const accountInfoTry = contract.try_acc(vaultAddress, userAddress);
    if (accountInfoTry.reverted) {
        log.error("handleRewardClaimed: contract.try_acc reverted for vault {} and user {}", [vaultAddress.toHex(), userAddress.toHex()]);
        return;
    }
    const accountInfoFromCall = accountInfoTry.value;

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
