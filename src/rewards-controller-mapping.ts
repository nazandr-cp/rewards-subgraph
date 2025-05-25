import { log, store, BigInt } from "@graphprotocol/graph-ts";
import { ERC721, ERC1155, CollectionVault as CollectionVaultTemplate } from "../generated/templates";
import {
    CollectionReward,
    Vault,
    AccountVault
} from "../generated/schema";
import {
    ZERO_BI,
    getOrCreateCollectionReward,
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
    RewardsController,
    RewardPerBlockUpdated as RewardPerBlockUpdatedEvent,
    RewardsClaimed as RewardClaimedEvent,
    VaultAdded as VaultAddedEvent
} from '../generated/RewardsController/RewardsController';

export function handleNewCollectionWhitelisted(event: NewCollectionWhitelisted): void {
    const nftCollectionAddress = event.params.collectionAddress;
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
    collReward.rewardPerSecond = BigInt.fromI32(event.params.sharePercentageBps);

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
        event.params.sharePercentageBps.toString()
    ]);
}

export function handleWhitelistCollectionRemoved(event: WhitelistCollectionRemoved): void {
    const collectionAddress = event.params.collectionAddress;
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
    const collectionAddress = event.params.collectionAddress;
    const rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;

    const collectionRewardId = generateCollectionRewardId(collectionAddress, rewardToken);
    const collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        collReward.rewardPerSecond = BigInt.fromI32(event.params.newSharePercentageBps);
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
    const collectionAddress = event.params.collectionAddress;
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

export function handleRewardPerBlockUpdated(event: RewardPerBlockUpdatedEvent): void {
    const vaultId = event.params.vault.toHex();
    let vault = Vault.load(vaultId);

    if (!vault) {
        // This case should ideally be handled by handleVaultAdded,
        // but as a safeguard or for vaults existing before this handler was deployed:
        vault = new Vault(vaultId);
        log.info("New Vault entity created in handleRewardPerBlockUpdated: {}", [vaultId]);
        // We might be missing initial setup data here if handleVaultAdded wasn't called.
        // Consider if CollectionVault.create() is also needed here if a vault can be updated before being "added"
        // For now, assuming VaultAdded will always be called first for new vaults.
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
    const vaultAddress = event.params.vaultAddress;
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

export function handleVaultAdded(event: VaultAddedEvent): void {
    const vaultAddress = event.params.vaultAddress;
    const vaultId = vaultAddress.toHex();
    let vault = Vault.load(vaultId);

    if (vault == null) {
        vault = new Vault(vaultId);
        // Initialize other Vault properties from the event or contract state if necessary
        // For example, if RewardsController has a public mapping or getter for vault info:
        const rewardsController = RewardsController.bind(event.address);
        const vaultInfoTry = rewardsController.try_vaults(vaultAddress); // Renamed to vaultInfoTry

        if (!vaultInfoTry.reverted) { // Check vaultInfoTry.reverted
            const vaultInfo = vaultInfoTry.value; // Assign to new const vaultInfo
            vault.rewardPerBlock = vaultInfo.rewardPerBlock;
            vault.globalRPW = vaultInfo.globalRPW;
            vault.totalWeight = vaultInfo.totalWeight;
            vault.lastUpdateBlock = vaultInfo.lastUpdateBlock;
            vault.weightByBorrow = vaultInfo.weightByBorrow;
            vault.useExp = vaultInfo.useExp;
            vault.linK = vaultInfo.linK;
            vault.expR = vaultInfo.expR;
        } else {
            log.warning("handleVaultAdded: try_vaults reverted for vault {}", [vaultAddress.toHexString()]);
            // Initialize with defaults if contract call fails or is not desired
            vault.rewardPerBlock = ZERO_BI;
            vault.globalRPW = ZERO_BI;
            vault.totalWeight = ZERO_BI;
            vault.lastUpdateBlock = ZERO_BI;
            vault.weightByBorrow = false;
            vault.useExp = false;
            vault.linK = ZERO_BI;
            vault.expR = ZERO_BI;
        }
        vault.save();
        log.info("VaultAdded: New Vault entity {} created and saved.", [vaultId]);

        // Create CollectionVault template instance
        CollectionVaultTemplate.create(vaultAddress);
        log.info("VaultAdded: CollectionVault template created for address {}", [vaultAddress.toHexString()]);

    } else {
        log.info("VaultAdded: Vault entity {} already exists. Skipping creation.", [vaultId]);
        // Optionally, update existing vault if necessary, though VaultAdded should ideally be for new ones.
    }
}
