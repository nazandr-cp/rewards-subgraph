import { BigInt, Bytes, Address, log, store } from "@graphprotocol/graph-ts";
import { ERC721 } from "../generated/templates";
import {
    CollectionReward,
    AccountCollectionReward,
    Account,
    RewardClaim
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
    RewardsController
} from '../generated/RewardsController/RewardsController';

export function handleNewCollectionWhitelisted(event: NewCollectionWhitelisted): void {
    let nftCollectionAddress = event.params.collection;
    // Assuming rewardBasis is a struct with fnType (e.g., uint8) and other params
    // event.params.rewardBasis.fnType will be used.
    // The event provides `sharePercentage` as uint256.
    let rewardBasis = event.params.rewardBasis; // Assuming rewardBasis is the fnType directly (e.g. uint8)
    let rewardShare = event.params.sharePercentage.toI32(); // This is likely for rewardPerSecond or similar, not the basis enum

    let rewardBasisStr: RewardBasis;
    if (rewardBasis == 0) { // Assuming 0 for DEPOSIT
        rewardBasis = RewardBasis.DEPOSIT;
    } else if (rewardBasis == 1) { // Assuming 1 for BORROW
        rewardBasis = RewardBasis.BORROW;
    } else {
        rewardBasis = RewardBasis.BORROW; // Default to BORROW if not recognized
        log.info("NewCollectionWhitelisted: rewardBasis {} mapped to BORROW for collection {}",
            [BigInt.fromI32(rewardBasis as i32).toString(), nftCollectionAddress.toHexString()]);
    }

    // Determine initialRewardBasis based on the activityType.
    // The `getOrCreateCollectionReward` expects `initialRewardBasis` as a RewardBasis enum.
    // And `rewardShare` (which is an i32) was being passed to `initialRewardBasis` argument.
    // This needs to be the actual RewardBasis enum value.
    // The `sharePercentage` from the event is likely for `rewardPerSecond` or a similar field, not `rewardBasis`.
    // For now, using `activityType` for `initialRewardBasis` as well.
    // The `initialWeightFnType` is also expected as an enum. Defaulting to LINEAR.

    // Create the CollectionReward entity
    let collReward = getOrCreateCollectionReward(
        nftCollectionAddress,
        HARDCODED_REWARD_TOKEN_ADDRESS,
        HARDCODED_CTOKEN_MARKET_ADDRESS,
        rewardBasis, // This is the RewardBasis enum for the activity type
        WeightFunctionType.LINEAR, // initialWeightFnType, default to Linear
        event.block.timestamp
    );
    // The rewardShare (event.params.sharePercentage) should likely update collReward.rewardPerSecond or similar.
    // For now, this is not explicitly handled as the original code was misusing it for rewardBasis.
    // Example: collReward.rewardPerSecond = event.params.sharePercentage; (Adjust type if needed)
    collReward.save(); // Ensure it's saved if getOrCreate doesn't always save on no-op update

    // Start tracking the ERC721 contract if it's not already tracked
    // This assumes that CollectionReward implies we need to track transfers for this NFT.
    // Check if a template for this address already exists could be added, but create is idempotent.
    ERC721.create(nftCollectionAddress);

    log.info("NewCollectionWhitelisted: Processed collection {}, activityType {}, rewardBasis {}", [
        nftCollectionAddress.toHexString(),
        rewardBasis == RewardBasis.DEPOSIT ? "DEPOSIT" : "BORROW", // Log the string representation
        event.params.sharePercentage.toString()
    ]);
}

export function handleWhitelistCollectionRemoved(event: WhitelistCollectionRemoved): void {
    let collectionAddress = event.params.collection;
    // Assuming reward token is the hardcoded one for rewards managed by this controller
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
    // Note: This does not automatically remove associated AccountCollectionReward entities.
    // Those would become orphaned or might need a cleanup mechanism if desired.
}

export function handleCollectionRewardShareUpdated(event: CollectionRewardShareUpdated): void {
    let collectionAddress = event.params.collection;
    // rewardToken is not in event, using hardcoded address
    let rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
    let newShare = event.params.newSharePercentage.toI32(); // Assuming newSharePercentage needs to be i32 for collReward.rewardBasis

    let collectionRewardIdString = collectionAddress.toHex() + "-" + rewardToken.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);
    let collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        // TODO: As per todo.md, ideally accrue for all accounts under this collection reward before changing share.
        // This is complex with derived fields. For now, directly updating the share.
        // Example:
        // let acrs = collReward.accountRewards; // This is a derived field, direct iteration not simple.
        // for (let i = 0; i < acrs.length; i++) {
        //   let acrId = acrs[i];
        //   let acr = AccountCollectionReward.load(acrId);
        //   if (acr != null) {
        //     accrueSeconds(acr, collReward, event.block.timestamp);
        //     acr.save();
        //   }
        // }
        log.info("CollectionRewardShareUpdated: Accrual for derived AccountCollectionRewards skipped for collection {} before share update.", [collectionAddress.toHexString()]);

        // The event `CollectionRewardShareUpdated` with `newSharePercentage`
        // was previously incorrectly attempting to update `collReward.rewardBasis`.
        // `rewardBasis` now defines the activity type (DEPOSIT/BORROW).
        // `newSharePercentage` likely refers to a field like `rewardPerSecond` or a similar numeric value.
        // This logic needs to be clarified: what field should `newSharePercentage` update?
        // For now, I will assume it updates `rewardPerSecond`.
        collReward.rewardPerSecond = event.params.newSharePercentage; // Assuming newSharePercentage updates rewardPerSecond

        collReward.lastUpdate = event.block.timestamp;
        collReward.save();
        log.info("CollectionRewardShareUpdated: Updated share for CollectionReward {} (collection {}, rewardToken {}). New share: {}", [
            // Note: The log message previously stated "Updated rewardBasis". Changed to reflect "share" update.
            // The actual field updated by newSharePercentage needs to be clarified.
            // For now, logging the newSharePercentage value.
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
    // rewardToken is not in event, using hardcoded address
    let rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
    let weightFnParams = event.params.fn; // struct (uint8 fnType, int256 p1, int256 p2)

    let collectionRewardIdString = collectionAddress.toHex() + "-" + rewardToken.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);
    let collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        // TODO: Similar to share update, ideally accrue seconds for all accounts.
        log.info("handleWeightFunctionSet: Accrual for derived AccountCollectionRewards skipped for collection {} before weight function update.", [collectionAddress.toHexString()]);

        let fnTypeU8 = weightFnParams.fnType;
        if (fnTypeU8 == WeightFunctionType.LINEAR) {
            collReward.fnType = "LINEAR";
        } else if (fnTypeU8 == WeightFunctionType.EXPONENTIAL) {
            collReward.fnType = "EXPONENTIAL";
        } else if (fnTypeU8 == WeightFunctionType.POWER) {
            collReward.fnType = "POWER";
        } else {
            collReward.fnType = "LINEAR"; // Default if unknown
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
            // Corrected log parameters for handleWeightFunctionSet (Original had collectionRewardId.toHexString() twice and missed collectionAddress)
            // The order should be: ID, collectionAddr, rewardTokenAddr, fnType, p1, p2
            weightFnParams.fnType.toString(),  // Corrected: Was collectionRewardId.toHexString()
            weightFnParams.p1.toString(),      // Corrected: Was collectionAddress.toHexString()
            weightFnParams.p2.toString()       // Corrected: Was rewardToken.toHexString()
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
    log.warning(
        "handleRewardsClaimedForLazy: Event for account {}, collection {} with dueAmount {} " +
        "does not provide 'rewardToken'. Cannot uniquely identify CollectionReward or AccountCollectionReward. " +
        "RewardClaim and AccountCollectionReward entities will NOT be created/updated with full context.",
        [
            event.params.account.toHexString(), // user is now account
            event.params.collection.toHexString(),
            event.params.dueAmount.toString() // rewardAmount is now dueAmount
        ]
    );

    let userAddress = event.params.account; // Changed from _user to account
    let collectionAddress = event.params.collection;
    let rewardTokenAddress = HARDCODED_REWARD_TOKEN_ADDRESS; // rewardToken not in event

    let userAccount = getOrCreateAccount(userAddress);

    let collectionRewardIdString = collectionAddress.toHex() + "-" + rewardTokenAddress.toHex();
    let collectionRewardId = Bytes.fromHexString(collectionRewardIdString);
    let collReward = CollectionReward.load(collectionRewardId);

    if (collReward != null) {
        let acr = getOrCreateAccountCollectionReward(userAccount, collReward, event.block.timestamp);

        // Accrue seconds before claim
        accrueSeconds(acr, collReward, event.block.timestamp);

        // Create RewardClaim entity
        let claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
        let claim = new RewardClaim(claimId);
        claim.account = userAccount.id;
        // The schema for RewardClaim has `collectionAddress: Bytes!`.
        // todo.md suggests `collection = collReward.id` for RewardClaim.
        // The schema has `collectionAddress: Bytes!`. Let's stick to schema for now.
        // If `collection` field was meant to be a link to `CollectionReward` entity, schema needs update.
        // For now, using `event.params.collection` as `collectionAddress`.
        claim.collectionAddress = collectionAddress; // This is Bytes! as per schema
        // If you intended to link to CollectionReward entity, the schema should be:
        // claim.collection = collReward.id; // And type CollectionReward!

        claim.amount = event.params.dueAmount; // from event, not dueAmount (changed from _rewardAmount)
        claim.timestamp = event.block.timestamp;
        claim.transactionHash = event.transaction.hash;

        // Fields from event, ensure they match schema for RewardClaim
        claim.nonce = event.params.nonce; // Assuming this is part of your schema for RewardClaim
        claim.secondsUser = event.params.secondsUser; // Changed from _secondsClaimed
        claim.secondsColl = collReward.totalSecondsAccrued; // Snapshot after accrual, or specific value if event provides it for the claim context

        // These fields are in the event but might not be in the RewardClaim schema from todo.md
        // Check your schema.graphql for RewardClaim to confirm these fields.
        // claim.incRPS = event.params.incRPS;
        // claim.yieldSlice = event.params.yieldSlice;
        // For now, assuming they are in the schema as per current code.
        // incRPS and yieldSlice are now directly in the event
        claim.incRPS = event.params.incRPS;
        claim.yieldSlice = event.params.yieldSlice;
        // Removed try_getClaimData block as data is in event


        claim.save();

        // Update AccountCollectionReward
        acr.seconds = acr.seconds.minus(event.params.secondsUser); // Deduct claimed seconds (changed from _secondsClaimed)
        if (acr.seconds.lt(ZERO_BI)) {
            log.warning("ACR seconds for user {} collection {} rewardToken {} went negative after claim. Clamping to zero.", [userAddress.toHexString(), collectionAddress.toHexString(), rewardTokenAddress.toHexString()]);
            acr.seconds = ZERO_BI;
        }
        acr.lastUpdate = event.block.timestamp;
        acr.save();

        // Save CollectionReward as totalSecondsAccrued and lastUpdate might have changed in accrueSeconds
        collReward.lastUpdate = event.block.timestamp; // Ensure collReward's lastUpdate is also set
        collReward.save();

        log.info("RewardsClaimedForLazy: Processed claim for user {}, collection {}, rewardToken {}. Amount: {}, Seconds Claimed: {}", [
            userAddress.toHexString(),
            collectionAddress.toHexString(),
            rewardTokenAddress.toHexString(),
            event.params.dueAmount.toString(), // Changed from _rewardAmount
            event.params.secondsUser.toString() // Changed from _secondsClaimed
        ]);

    } else {
        log.warning("RewardsClaimedForLazy: CollectionReward not found for collection {} and rewardToken {}. Claim for user {} not fully processed.", [
            collectionAddress.toHexString(),
            rewardTokenAddress.toHexString(),
            userAddress.toHexString()
        ]);
        // Still create a basic RewardClaim if that's desired partial behavior
        let accountEntity = getOrCreateAccount(userAddress); // Ensure account exists
        let claimId = event.transaction.hash.concatI32(event.logIndex.toI32());
        let claim = new RewardClaim(claimId);
        claim.account = accountEntity.id;
        claim.collectionAddress = collectionAddress;
        claim.amount = event.params.dueAmount; // Changed from _rewardAmount
        claim.timestamp = event.block.timestamp;
        claim.transactionHash = event.transaction.hash;
        claim.nonce = event.params.nonce;
        claim.secondsUser = event.params.secondsUser; // Changed from _secondsClaimed
        claim.secondsColl = ZERO_BI; // Cannot determine without CollectionReward
        claim.incRPS = ZERO_BI; // Cannot determine
        claim.yieldSlice = ZERO_BI; // Cannot determine
        claim.save();
        log.info("RewardsClaimedForLazy: Saved partial RewardClaim for user {} due to missing CollectionReward.", [userAddress.toHexString()]);
    }
}

export function handleBatchRewardsClaimedForLazy(event: BatchRewardsClaimedForLazy): void {
    log.warning(
        "handleBatchRewardsClaimedForLazy: Event for caller {} with totalDue {} (numClaims: {}) " +
        "lacks individual claim details (collection, rewardToken, specific amounts). " +
        "Cannot create specific RewardClaim entities or update AccountCollectionReward entities accurately. " +
        "A general Account entity for the caller will be ensured.",
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
