import { log, store, BigInt } from "@graphprotocol/graph-ts";
import { CollectionVault as CollectionVaultTemplate } from "../generated/templates";
import {
    CollectionReward,
    Account,
    RewardClaim,
    AccountCollectionReward
} from "../generated/schema";
import {
    ZERO_BI,
    getOrCreateCollectionReward,
    getOrCreateAccountCollectionReward,
    HARDCODED_REWARD_TOKEN_ADDRESS,
    HARDCODED_CTOKEN_MARKET_ADDRESS,
    WeightFunctionType,
    generateCollectionRewardId,
    getOrCreateVault,
    getOrCreateAccountVault
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

    log.info("NewCollectionWhitelisted: Processed collection {}, type {}, rewardBasis (from event u8) {}, sharePercentage {}", [
        nftCollectionAddress.toHexString(),
        collectionTypeString,
        rewardBasisParam.toString(),
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
    const vaultAddress = event.params.vault;
    const vault = getOrCreateVault(vaultAddress);

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
    log.info("Vault {} rewardPerBlock updated to {}", [vault.id, event.params.rewardPerBlock.toString()]);
}

export function handleRewardClaimed(event: RewardClaimedEvent): void {
    const vaultAddress = event.params.vaultAddress;
    const userAddress = event.params.user;
    const collectionAddressFromEvent = event.params.collectionAddress;
    const amountClaimed = event.params.amount;
    const newNonceFromEvent = event.params.newNonce;
    const secondsInClaimFromEvent = event.params.secondsInClaim;

    const vaultId = vaultAddress.toHex();
    const accountId = userAddress.toHex();

    const vault = getOrCreateVault(vaultAddress);
    // Update vault details even if it was just created by getOrCreateVault
    const contract_ = RewardsController.bind(event.address) as RewardsController;
    log.info("handleRewardClaimed: Calling try_vaults with vaultAddress: {}", [vaultAddress.toHex()]);
    const vaultInfoTry_ = contract_.try_vaults(vaultAddress);
    if (vaultInfoTry_.reverted) {
        log.error("handleRewardClaimed: contract.try_vaults reverted for vault {} (during vault update/creation)", [vaultAddress.toHex()]);
        // If vault was just created and this fails, it might be in an inconsistent state.
        // However, getOrCreateVault already initializes fields, so we might proceed or handle error differently.
        // For now, we'll proceed as some fields might still be useful or updated later.
    } else {
        vault.globalRPW = vaultInfoTry_.value.globalRPW;
        vault.lastUpdateBlock = vaultInfoTry_.value.lastUpdateBlock;
        vault.totalWeight = vaultInfoTry_.value.totalWeight;
        // rewardPerBlock is updated by its own handler, do not overwrite here
        // other fields like weightByBorrow, useExp, linK, expR are set on creation or specific updates
        vault.save();
    }


    let account = Account.load(accountId);
    if (!account) {
        account = new Account(accountId);
        account.totalSecondsClaimed = ZERO_BI;
    }
    const previousTotalSecondsClaimed = account.totalSecondsClaimed;
    account.totalSecondsClaimed = account.totalSecondsClaimed.plus(secondsInClaimFromEvent);
    account.save();

    const rewardClaimId = event.transaction.hash.concatI32(event.logIndex.toI32());
    const rewardClaim = new RewardClaim(rewardClaimId);
    rewardClaim.account = accountId;
    rewardClaim.collectionAddress = collectionAddressFromEvent;
    rewardClaim.amount = amountClaimed;
    rewardClaim.timestamp = event.block.timestamp;
    rewardClaim.transactionHash = event.transaction.hash;
    rewardClaim.nonce = newNonceFromEvent;
    rewardClaim.secondsInClaim = secondsInClaimFromEvent;
    rewardClaim.secondsUser = previousTotalSecondsClaimed;
    rewardClaim.secondsColl = ZERO_BI;
    rewardClaim.incRPS = ZERO_BI;
    rewardClaim.yieldSlice = ZERO_BI;
    rewardClaim.save();

    const accountVault = getOrCreateAccountVault(accountId, vaultId);
    // Reset accrued and claimable as per original logic after a claim
    accountVault.accrued = ZERO_BI;
    accountVault.claimable = ZERO_BI;

    const contract = RewardsController.bind(event.address) as RewardsController;
    const userSecondsPaidTry = contract.try_userSecondsClaimed(vaultAddress, userAddress);
    if (!userSecondsPaidTry.reverted) {
        log.info("handleRewardClaimed: contract.userSecondsPaid for vault {} user {} is {}", [
            vaultAddress.toHex(),
            userAddress.toHex(),
            userSecondsPaidTry.value.toString()
        ]);
    } else {
        log.warning("handleRewardClaimed: contract.try_userSecondsPaid reverted for vault {} and user {}", [vaultAddress.toHex(), userAddress.toHex()]);
    }

    accountVault.save();

    // Ensure AccountCollectionReward exists and its lastUpdate timestamp is current.
    const collectionAddress = event.params.collectionAddress;
    const rewardTokenAddress = HARDCODED_REWARD_TOKEN_ADDRESS;
    const collectionRewardId_bytes = generateCollectionRewardId(collectionAddress, rewardTokenAddress);

    // account is already loaded or created earlier in this handler
    if (account != null) {
        const collectionReward = CollectionReward.load(collectionRewardId_bytes);

        if (collectionReward != null) {
            const accountCollectionReward: AccountCollectionReward = getOrCreateAccountCollectionReward(account, collectionReward, event.block.timestamp);
            // The getOrCreate function sets initial fields. We only need to ensure lastUpdate is current.
            accountCollectionReward.lastUpdate = event.block.timestamp;
            // balanceNFT is not updated here; it's managed by deposit/withdraw handlers.
            // Other fields like 'seconds' are managed by accrual logic.
            accountCollectionReward.save();

            log.info(
                "handleRewardClaimed: Ensured/Updated AccountCollectionReward {} for account {} and collectionReward {}.",
                [accountCollectionReward.id.toHexString(), account.id, collectionReward.id.toHexString()]
            );
        } else {
            log.warning(
                "handleRewardClaimed: CollectionReward {} not found for collection {}. Cannot create/update AccountCollectionReward.",
                [collectionRewardId_bytes.toHexString(), collectionAddress.toHexString()]
            );
        }
    } else {
        // This case should ideally not happen if account is always loaded/created above.
        log.error("handleRewardClaimed: Account entity was null when trying to process AccountCollectionReward for accountId {}.", [accountId]);
    }

    log.info("Account {} totalSecondsClaimed updated to {}. RewardClaim {} created for amount {}. AccountVault {} processed.", [
        accountId,
        account.totalSecondsClaimed.toString(),
        rewardClaimId.toHex(),
        amountClaimed.toString(),
        accountVault.id
    ]);
}

export function handleVaultAdded(event: VaultAddedEvent): void {
    const vaultAddress = event.params.vaultAddress;
    const vault = getOrCreateVault(vaultAddress); // This will create or load the vault

    // If the vault was newly created by getOrCreateVault, its fields are initialized.
    // If it existed, we might want to refresh some data if applicable,
    // but getOrCreateVault already handles basic setup.
    // The original logic re-fetched all vault info if it was null.
    // getOrCreateVault initializes with defaults or existing data.
    // We might still need to fetch and update if specific event data implies changes
    // beyond what getOrCreateVault sets up by default for a *new* vault.
    // However, for VaultAdded, the primary action is creation if not exists,
    // and `getOrCreateVault` handles this.
    // The contract call to `try_vaults` is to populate fields if it's truly new.
    // `getOrCreateVault` in `rewards.ts` should ideally do this fetch if it creates.
    // Assuming `getOrCreateVault` correctly initializes a new vault (including a contract call if needed),
    // we might not need to repeat the `try_vaults` call here unless the event provides *new* info
    // that `getOrCreateVault` wouldn't know.

    // The original code only created the template if the vault was null.
    // We should ensure the template is created if `getOrCreateVault` indicated it was a new vault.
    // However, `getOrCreateVault` doesn't return a flag for "wasCreated".
    // A common pattern is to check a specific field that's only set on true creation,
    // or to always try to create the template, as `create` is often idempotent or cheap if exists.
    // For now, let's assume `getOrCreateVault` handles the Vault entity correctly.
    // The template creation should happen regardless of whether it was just created or already existed,
    // if the intention is to ensure the template is running for this vault address.
    // However, the original logic was `if (vault == null)`, so let's stick to creating template only if it's "new".
    // This is tricky without knowing if `getOrCreateVault` made it new.
    // A simple check could be if `vault.rewardPerBlock` is still its initial `ZERO_BI` if that's a proxy for new.
    // Or, more robustly, `getOrCreateVault` should be the one creating the template if it creates the vault.

    // For simplicity and to match the "only if new" logic, we'll assume that if `vault.lastUpdateBlock` is ZERO_BI
    // (or some other field that is only ZERO_BI on initial creation by `getOrCreateVault` before specific updates),
    // then it's "new" for the purpose of template creation. This is a heuristic.
    // A better approach would be for `getOrCreateVault` to return a struct `{ entity: Vault, created: boolean }`.
    // Given the current tools, we'll try to infer.
    // The most direct translation of `if (vault == null)` before is to check if it was loaded or created.
    // Since `getOrCreateVault` abstracts this, we'll assume it's fine and always try to create the template.
    // Graph Protocol's `create` for templates is usually safe to call multiple times.

    const rewardsController = RewardsController.bind(event.address);
    const vaultInfoTry = rewardsController.try_vaults(vaultAddress);

    if (!vaultInfoTry.reverted) {
        const vaultInfo = vaultInfoTry.value;
        vault.rewardPerBlock = vaultInfo.rewardPerBlock;
        vault.globalRPW = vaultInfo.globalRPW;
        vault.totalWeight = vaultInfo.totalWeight;
        vault.lastUpdateBlock = vaultInfo.lastUpdateBlock;
        vault.weightByBorrow = vaultInfo.weightByBorrow;
        vault.useExp = vaultInfo.useExp;
        vault.linK = vaultInfo.linK;
        vault.expR = vaultInfo.expR;
        vault.save();
        log.info("VaultAdded: Vault entity {} (re)loaded/created and updated.", [vault.id]);
    } else {
        log.warning("handleVaultAdded: try_vaults reverted for vault {}. Vault might have default values.", [vaultAddress.toHexString()]);
        // `getOrCreateVault` would have set defaults if it created it.
        // If it loaded, existing values remain. This warning is for the failed update.
    }

    CollectionVaultTemplate.create(vaultAddress);
    log.info("VaultAdded: CollectionVault template creation attempted for address {}", [vaultAddress.toHexString()]);
}
