import { describe, test, assert, clearStore, newMockEvent, createMockedFunction } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum, Bytes } from "@graphprotocol/graph-ts"; // Keep Bytes for txHash etc.
import {
    handleRewardClaimed,
    handleNewCollectionWhitelisted,
    handleWhitelistCollectionRemoved,
    handleCollectionRewardShareUpdated,
    handleWeightFunctionSet,
    handleRewardsClaimedForLazy,
    handleBatchRewardsClaimedForLazy,
    handleRewardPerBlockUpdated
} from "../../src/rewards-controller-mapping";
import { handleBorrow, handleMint, handleRedeem } from "../../src/cToken-mapping";
import {
    RewardClaimed,
    NewCollectionWhitelisted,
    WhitelistCollectionRemoved,
    CollectionRewardShareUpdated,
    WeightFunctionSet,
    RewardsClaimedForLazy,
    BatchRewardsClaimedForLazy,
    RewardPerBlockUpdated as RewardPerBlockUpdatedEvent
} from "../../generated/RewardsController/RewardsController";
import { Borrow as BorrowEvent, Mint as MintEvent, Redeem as RedeemEvent } from "../../generated/cToken/cToken";
import { Account, CollectionReward, CTokenMarket } from "../../generated/schema"; // Import Account and CollectionReward for direct instantiation
import { generateCollectionRewardId, generateAccountCollectionRewardId } from "../../src/utils/rewards"; // Import ID generators

// Constants used in handlers or for mocking
const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0xf43EE9653ff96AB50C270eC3D9f0A8e015Df4065"); // Standardized
const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x663702880Ec335BB1fae3ca05915B2D24F2b6A48"); // Standardized from utils
const MOCK_CONTRACT_ADDRESS = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc"); // RewardsController contract
const ZERO_BI = BigInt.fromI32(0);

// Weight Function Type constants
const LINEAR_FN_TYPE: BigInt = BigInt.fromI32(0);
const EXPONENTIAL_FN_TYPE: BigInt = BigInt.fromI32(1);

// Helper function to create a RewardClaimed event (updated for new params)
function createRewardClaimedEvent(
    user: Address,
    vaultAddress: Address,
    collectionAddressParam: Address, // Renamed to avoid conflict with 'collection' variable name
    amount: BigInt,
    newNonce: BigInt,
    secondsInClaim: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): RewardClaimed {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531200);

    const rewardClaimedEvent = new RewardClaimed(
        mockEvent.address,
        logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        [],
        mockEvent.receipt
    );

    rewardClaimedEvent.parameters = [];
    const vaultAddressParam = new ethereum.EventParam("vaultAddress", ethereum.Value.fromAddress(vaultAddress));
    const userParam = new ethereum.EventParam("user", ethereum.Value.fromAddress(user));
    const collectionAddressEvParam = new ethereum.EventParam("collectionAddress", ethereum.Value.fromAddress(collectionAddressParam));
    const amountParam = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));
    const newNonceParam = new ethereum.EventParam("newNonce", ethereum.Value.fromUnsignedBigInt(newNonce));
    const secondsInClaimParam = new ethereum.EventParam("secondsInClaim", ethereum.Value.fromUnsignedBigInt(secondsInClaim));

    rewardClaimedEvent.parameters.push(vaultAddressParam);
    rewardClaimedEvent.parameters.push(userParam);
    rewardClaimedEvent.parameters.push(collectionAddressEvParam);
    rewardClaimedEvent.parameters.push(amountParam);
    rewardClaimedEvent.parameters.push(newNonceParam);
    rewardClaimedEvent.parameters.push(secondsInClaimParam);

    return rewardClaimedEvent;
}

// Helper to create NewCollectionWhitelisted event
function createNewCollectionWhitelistedEvent(
    collection: Address,
    collectionType: number, // 0 for ERC721, 1 for ERC1155
    rewardBasis: number,   // 0 for DEPOSIT, 1 for BORROW
    sharePercentage: number,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500000abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): NewCollectionWhitelisted {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531201);

    const event = new NewCollectionWhitelisted(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
    event.parameters.push(new ethereum.EventParam("collectionType", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(collectionType as i32))));
    event.parameters.push(new ethereum.EventParam("rewardBasis", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(rewardBasis as i32))));
    event.parameters.push(new ethereum.EventParam("sharePercentage", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(sharePercentage as i32))));
    return event;
}

// Helper to create WhitelistCollectionRemoved event
function createWhitelistCollectionRemovedEvent(
    collection: Address,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500001abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): WhitelistCollectionRemoved {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531202);

    const event = new WhitelistCollectionRemoved(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
    return event;
}

// Helper to create CollectionRewardShareUpdated event
function createCollectionRewardShareUpdatedEvent(
    collection: Address,
    newSharePercentage: number,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500002abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): CollectionRewardShareUpdated {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531203);

    const event = new CollectionRewardShareUpdated(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
    event.parameters.push(new ethereum.EventParam("newSharePercentage", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newSharePercentage as i32))));
    return event;
}

// Helper to create WeightFunctionSet event
function createWeightFunctionSetEvent(
    collection: Address,
    fnType: BigInt,
    p1: BigInt,
    p2: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500003abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): WeightFunctionSet {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531204);

    const event = new WeightFunctionSet(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );

    const fnTuple = new ethereum.Tuple();
    fnTuple.push(ethereum.Value.fromUnsignedBigInt(fnType));
    fnTuple.push(ethereum.Value.fromUnsignedBigInt(p1));
    fnTuple.push(ethereum.Value.fromUnsignedBigInt(p2));
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
    event.parameters.push(new ethereum.EventParam("fn", ethereum.Value.fromTuple(fnTuple)));
    return event;
}

// Helper to create RewardsClaimedForLazy event
function createRewardsClaimedForLazyEvent(
    account: Address,
    collection: Address,
    dueAmount: BigInt,
    secondsUser: BigInt,
    incRPS: BigInt,
    yieldSlice: BigInt,
    nonce: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500004abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): RewardsClaimedForLazy {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531205);

    const event = new RewardsClaimedForLazy(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("account", ethereum.Value.fromAddress(account)));
    event.parameters.push(new ethereum.EventParam("collection", ethereum.Value.fromAddress(collection)));
    event.parameters.push(new ethereum.EventParam("dueAmount", ethereum.Value.fromUnsignedBigInt(dueAmount)));
    event.parameters.push(new ethereum.EventParam("secondsUser", ethereum.Value.fromUnsignedBigInt(secondsUser)));
    event.parameters.push(new ethereum.EventParam("incRPS", ethereum.Value.fromSignedBigInt(incRPS)));
    event.parameters.push(new ethereum.EventParam("yieldSlice", ethereum.Value.fromSignedBigInt(yieldSlice)));
    event.parameters.push(new ethereum.EventParam("nonce", ethereum.Value.fromSignedBigInt(nonce)));
    return event;
}

// Helper to create BatchRewardsClaimedForLazy event
function createBatchRewardsClaimedForLazyEvent(
    caller: Address,
    totalDue: BigInt,
    numClaims: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500005abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): BatchRewardsClaimedForLazy {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531206);

    const event = new BatchRewardsClaimedForLazy(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("caller", ethereum.Value.fromAddress(caller)));
    event.parameters.push(new ethereum.EventParam("totalDue", ethereum.Value.fromUnsignedBigInt(totalDue)));
    event.parameters.push(new ethereum.EventParam("numClaims", ethereum.Value.fromUnsignedBigInt(numClaims)));
    return event;
}

// Helper to create RewardPerBlockUpdatedEvent
function createRewardPerBlockUpdatedEvent(
    vault: Address,
    rewardPerBlock: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
    txHash: string = "0x1234500006abcdef1234567890abcdef1234567890abcdef1234567890abcdef"
): RewardPerBlockUpdatedEvent {
    const mockEvent = newMockEvent();
    mockEvent.address = MOCK_CONTRACT_ADDRESS;
    mockEvent.transaction.hash = Bytes.fromHexString(txHash);
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531207);

    const event = new RewardPerBlockUpdatedEvent(
        mockEvent.address, logIndex, mockEvent.transactionLogIndex, mockEvent.logType,
        mockEvent.block, mockEvent.transaction, [], mockEvent.receipt
    );
    event.parameters = [];
    event.parameters.push(new ethereum.EventParam("vault", ethereum.Value.fromAddress(vault)));
    event.parameters.push(new ethereum.EventParam("rewardPerBlock", ethereum.Value.fromUnsignedBigInt(rewardPerBlock)));
    return event;
}


function createBorrowEvent(
    cTokenAddress: Address,
    borrower: Address,
    borrowAmount: BigInt,
    accountBorrows: BigInt,
    totalBorrows: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
): BorrowEvent {
    const mockEvent = newMockEvent();
    mockEvent.address = cTokenAddress;
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531200); // Example timestamp

    const borrowEvent = new BorrowEvent(
        mockEvent.address,
        logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        [],
        mockEvent.receipt
    );

    borrowEvent.parameters = [];
    borrowEvent.parameters.push(new ethereum.EventParam("borrower", ethereum.Value.fromAddress(borrower)));
    borrowEvent.parameters.push(new ethereum.EventParam("borrowAmount", ethereum.Value.fromUnsignedBigInt(borrowAmount)));
    borrowEvent.parameters.push(new ethereum.EventParam("accountBorrows", ethereum.Value.fromUnsignedBigInt(accountBorrows)));
    borrowEvent.parameters.push(new ethereum.EventParam("totalBorrows", ethereum.Value.fromUnsignedBigInt(totalBorrows)));

    return borrowEvent;
}

function createMintEvent(
    cTokenAddress: Address,
    minter: Address,
    mintAmount: BigInt,
    mintTokens: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
): MintEvent {
    const mockEvent = newMockEvent();
    mockEvent.address = cTokenAddress;
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531200); // Example timestamp

    const mintEvent = new MintEvent(
        mockEvent.address,
        logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        [],
        mockEvent.receipt
    );

    mintEvent.parameters = [];
    mintEvent.parameters.push(new ethereum.EventParam("minter", ethereum.Value.fromAddress(minter)));
    mintEvent.parameters.push(new ethereum.EventParam("mintAmount", ethereum.Value.fromUnsignedBigInt(mintAmount)));
    mintEvent.parameters.push(new ethereum.EventParam("mintTokens", ethereum.Value.fromUnsignedBigInt(mintTokens)));

    return mintEvent;
}

function createRedeemEvent(
    cTokenAddress: Address,
    redeemer: Address,
    redeemAmount: BigInt,
    redeemTokens: BigInt,
    logIndex: BigInt = BigInt.fromI32(1),
): RedeemEvent {
    const mockEvent = newMockEvent();
    mockEvent.address = cTokenAddress;
    mockEvent.logIndex = logIndex;
    mockEvent.block.timestamp = BigInt.fromI32(1672531200); // Example timestamp

    const redeemEvent = new RedeemEvent(
        mockEvent.address,
        logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        [],
        mockEvent.receipt
    );

    redeemEvent.parameters = [];
    redeemEvent.parameters.push(new ethereum.EventParam("redeemer", ethereum.Value.fromAddress(redeemer)));
    redeemEvent.parameters.push(new ethereum.EventParam("redeemAmount", ethereum.Value.fromUnsignedBigInt(redeemAmount)));
    redeemEvent.parameters.push(new ethereum.EventParam("redeemTokens", ethereum.Value.fromUnsignedBigInt(redeemTokens)));

    return redeemEvent;
}

describe("Reward Handlers", () => {
    test("should handle RewardClaimed event and create/update relevant entities including AccountCollectionReward", () => {
        clearStore();

        const userAddress = Address.fromString("0x0000000000000000000000000000000000000001");
        const vaultAddress = Address.fromString("0x0000000000000000000000000000000000000002");
        const nftCollectionAddress = Address.fromString("0x0000000000000000000000000000000000000003"); // For CollectionReward and AccountCollectionReward
        const rewardAmount = BigInt.fromI32(1000);
        const newNonce = BigInt.fromI32(101);
        const secondsInClaim = BigInt.fromI32(600);
        const logIdx = BigInt.fromI32(5);
        const txHashStr = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

        // Pre-create the CollectionReward entity that the handler will try to load
        const collectionRewardId = generateCollectionRewardId(nftCollectionAddress, HARDCODED_REWARD_TOKEN_ADDRESS);
        const collectionReward = new CollectionReward(collectionRewardId);
        collectionReward.collection = nftCollectionAddress;
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.cTokenMarketAddress = HARDCODED_CTOKEN_MARKET_ADDRESS;
        collectionReward.isBorrowBased = false;
        collectionReward.collectionType = "ERC721";
        collectionReward.totalSecondsAccrued = ZERO_BI;
        collectionReward.lastUpdate = BigInt.fromI32(1672531100); // Some prior timestamp
        collectionReward.fnType = "LINEAR";
        collectionReward.p1 = ZERO_BI;
        collectionReward.p2 = ZERO_BI;
        collectionReward.rewardPerSecond = BigInt.fromI32(10); // Example value
        collectionReward.totalRewardsPool = ZERO_BI;
        collectionReward.expiresAt = ZERO_BI;
        collectionReward.save();

        const rewardClaimedEventInstance = createRewardClaimedEvent(
            userAddress,
            vaultAddress,
            nftCollectionAddress, // This is the collectionAddress for the reward
            rewardAmount,
            newNonce,
            secondsInClaim,
            logIdx,
            txHashStr
        );

        // Mock contract calls for Vault and AccountVault updates
        const vaultInfoTuple = new ethereum.Tuple();
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))); // rewardPerBlock (not directly set by this event's mock)
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))); // uint128 globalRPW
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))); // uint128 totalWeight
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1672531200))); // uint32 lastUpdate (using a fixed timestamp for consistency)
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(1000))); // uint64 p1
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(2000))); // uint64 p2
        vaultInfoTuple.push(ethereum.Value.fromBoolean(true)); // bool useExp
        vaultInfoTuple.push(ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)); // address rewardToken
        vaultInfoTuple.push(ethereum.Value.fromAddress(vaultAddress)); // address collection
        vaultInfoTuple.push(ethereum.Value.fromBoolean(false)); // bool weightByBorrow
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint128,uint128,uint128,uint32,uint64,uint64,bool,address,address,bool))")
            .withArgs([ethereum.Value.fromAddress(vaultAddress)])
            .returns([ethereum.Value.fromTuple(vaultInfoTuple)]);

        // Mock userSecondsClaimed for AccountVault update
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "userSecondsClaimed", "userSecondsClaimed(address,address):(uint256)")
            .withArgs([ethereum.Value.fromAddress(vaultAddress), ethereum.Value.fromAddress(userAddress)])
            .returns([ethereum.Value.fromUnsignedBigInt(secondsInClaim)]); // Mock it returns the new total seconds claimed

        handleRewardClaimed(rewardClaimedEventInstance);

        // Assertions for Vault
        const vaultId = vaultAddress.toHex();
        assert.entityCount("Vault", 1);
        assert.fieldEquals("Vault", vaultId, "globalRPW", "100");
        assert.fieldEquals("Vault", vaultId, "totalWeight", "200");
        assert.fieldEquals("Vault", vaultId, "lastUpdateBlock", "1672531200");


        // Assertions for Account
        const accountId = userAddress.toHex();
        assert.entityCount("Account", 1);
        assert.fieldEquals("Account", accountId, "totalSecondsClaimed", secondsInClaim.toString());

        // Assertions for RewardClaim
        const rewardClaimId = rewardClaimedEventInstance.transaction.hash.concatI32(rewardClaimedEventInstance.logIndex.toI32()).toHexString();
        assert.entityCount("RewardClaim", 1);
        assert.fieldEquals("RewardClaim", rewardClaimId, "account", accountId);
        assert.fieldEquals("RewardClaim", rewardClaimId, "collectionAddress", nftCollectionAddress.toHex());
        assert.fieldEquals("RewardClaim", rewardClaimId, "amount", rewardAmount.toString());
        assert.fieldEquals("RewardClaim", rewardClaimId, "nonce", newNonce.toString());
        assert.fieldEquals("RewardClaim", rewardClaimId, "secondsInClaim", secondsInClaim.toString());

        // Assertions for AccountVault
        const accountVaultId = vaultId + "-" + userAddress.toHex();
        assert.entityCount("AccountVault", 1);
        assert.fieldEquals("AccountVault", accountVaultId, "vault", vaultId);
        assert.fieldEquals("AccountVault", accountVaultId, "account", userAddress.toHex());
        assert.fieldEquals("AccountVault", accountVaultId, "accrued", ZERO_BI.toString()); // Reset after claim
        assert.fieldEquals("AccountVault", accountVaultId, "claimable", ZERO_BI.toString()); // Reset after claim

        // Assertions for AccountCollectionReward
        const accountCollectionRewardId = generateAccountCollectionRewardId(accountId, collectionRewardId).toHexString();
        assert.entityCount("AccountCollectionReward", 1);
        assert.fieldEquals("AccountCollectionReward", accountCollectionRewardId, "account", accountId);
        assert.fieldEquals("AccountCollectionReward", accountCollectionRewardId, "collection", collectionRewardId.toHexString());
        assert.fieldEquals("AccountCollectionReward", accountCollectionRewardId, "rewardToken", HARDCODED_REWARD_TOKEN_ADDRESS.toHexString());
        assert.fieldEquals("AccountCollectionReward", accountCollectionRewardId, "balanceNFT", ZERO_BI.toString()); // Not affected by claim
        assert.fieldEquals("AccountCollectionReward", accountCollectionRewardId, "seconds", ZERO_BI.toString()); // Initialized to zero
        assert.fieldEquals("AccountCollectionReward", accountCollectionRewardId, "lastUpdate", rewardClaimedEventInstance.block.timestamp.toString());
    });

    test("should handle NewCollectionWhitelisted (ERC721, Deposit)", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
        const event = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);

        handleNewCollectionWhitelisted(event);

        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS).toHexString();
        assert.entityCount("CollectionReward", 1);
        assert.fieldEquals("CollectionReward", collRewardId, "collection", collectionAddr.toHexString());
        assert.fieldEquals("CollectionReward", collRewardId, "rewardToken", HARDCODED_REWARD_TOKEN_ADDRESS.toHexString());
        assert.fieldEquals("CollectionReward", collRewardId, "cTokenMarketAddress", HARDCODED_CTOKEN_MARKET_ADDRESS.toHexString());
        assert.fieldEquals("CollectionReward", collRewardId, "isBorrowBased", "false");
        assert.fieldEquals("CollectionReward", collRewardId, "collectionType", "ERC721");
        assert.fieldEquals("CollectionReward", collRewardId, "rewardPerSecond", "1000");
        assert.fieldEquals("CollectionReward", collRewardId, "fnType", "LINEAR");
        assert.fieldEquals("CollectionReward", collRewardId, "lastUpdate", event.block.timestamp.toString());
    });

    test("should handle NewCollectionWhitelisted (ERC1155, Borrow, unknown rewardBasis/collectionType defaults)", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x2222222222222222222222222222222222222222");
        // Using unknown types that should default
        const event = createNewCollectionWhitelistedEvent(collectionAddr, 99, 99, 2000);

        handleNewCollectionWhitelisted(event);

        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS).toHexString();
        assert.entityCount("CollectionReward", 1);
        assert.fieldEquals("CollectionReward", collRewardId, "collectionType", "ERC721"); // Default for unknown
        assert.fieldEquals("CollectionReward", collRewardId, "isBorrowBased", "true"); // Default for unknown
        assert.fieldEquals("CollectionReward", collRewardId, "rewardPerSecond", "2000");
    });

    test("should handle WhitelistCollectionRemoved", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
        const createEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
        handleNewCollectionWhitelisted(createEvent);
        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS).toHexString();
        assert.entityCount("CollectionReward", 1);

        const removeEvent = createWhitelistCollectionRemovedEvent(collectionAddr);
        handleWhitelistCollectionRemoved(removeEvent);
        assert.notInStore("CollectionReward", collRewardId);
        assert.entityCount("CollectionReward", 0);
    });

    test("should handle WhitelistCollectionRemoved for non-existent collection", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x3333333333333333333333333333333333333333");
        const removeEvent = createWhitelistCollectionRemovedEvent(collectionAddr);

        handleWhitelistCollectionRemoved(removeEvent);

        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS).toHexString();
        assert.notInStore("CollectionReward", collRewardId);
        assert.entityCount("CollectionReward", 0);
    });

    test("should handle CollectionRewardShareUpdated", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
        // Use the handler to create the initial CollectionReward entity
        const createEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
        handleNewCollectionWhitelisted(createEvent);

        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS);
        // Assert that the entity was created
        assert.entityCount("CollectionReward", 1);
        assert.fieldEquals("CollectionReward", collRewardId.toHexString(), "rewardPerSecond", "1000");

        const newShare = 1500;
        const updateEvent = createCollectionRewardShareUpdatedEvent(collectionAddr, newShare);
        handleCollectionRewardShareUpdated(updateEvent);

        assert.fieldEquals("CollectionReward", collRewardId.toHexString(), "rewardPerSecond", newShare.toString());
        assert.fieldEquals("CollectionReward", collRewardId.toHexString(), "lastUpdate", updateEvent.block.timestamp.toString());
    });

    test("should handle CollectionRewardShareUpdated for non-existent collection", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x4444444444444444444444444444444444444444");
        const updateEvent = createCollectionRewardShareUpdatedEvent(collectionAddr, 1500);
        handleCollectionRewardShareUpdated(updateEvent); // Should not throw, logs warning
        assert.entityCount("CollectionReward", 0);
    });


    test("should handle WeightFunctionSet (Linear and Exponential)", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
        const createEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
        handleNewCollectionWhitelisted(createEvent);
        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS).toHexString();

        // Test LINEAR
        let fnType: BigInt = LINEAR_FN_TYPE;
        let p1 = BigInt.fromI32(10);
        let p2 = BigInt.fromI32(20);
        let setEvent = createWeightFunctionSetEvent(collectionAddr, fnType, p1, p2);
        handleWeightFunctionSet(setEvent);
        assert.fieldEquals("CollectionReward", collRewardId, "fnType", "LINEAR");
        assert.fieldEquals("CollectionReward", collRewardId, "p1", p1.toString());
        assert.fieldEquals("CollectionReward", collRewardId, "p2", p2.toString());
        assert.fieldEquals("CollectionReward", collRewardId, "lastUpdate", setEvent.block.timestamp.toString());

        // Test EXPONENTIAL
        fnType = EXPONENTIAL_FN_TYPE;
        p1 = BigInt.fromI32(50);
        p2 = BigInt.fromI32(60);
        setEvent = createWeightFunctionSetEvent(collectionAddr, fnType, p1, p2, BigInt.fromI32(2)); // new logIndex for new event time
        handleWeightFunctionSet(setEvent);
        assert.fieldEquals("CollectionReward", collRewardId, "fnType", "EXPONENTIAL");
        assert.fieldEquals("CollectionReward", collRewardId, "p1", p1.toString());
        assert.fieldEquals("CollectionReward", collRewardId, "p2", p2.toString());
        assert.fieldEquals("CollectionReward", collRewardId, "lastUpdate", setEvent.block.timestamp.toString());

        // Test Unknown (defaults to LINEAR)
        fnType = BigInt.fromI32(99); // Unknown (type is i32)
        p1 = BigInt.fromI32(5);
        p2 = BigInt.fromI32(6);
        setEvent = createWeightFunctionSetEvent(collectionAddr, fnType, p1, p2, BigInt.fromI32(3));
        handleWeightFunctionSet(setEvent);
        assert.fieldEquals("CollectionReward", collRewardId, "fnType", "LINEAR");
    });

    test("should handle WeightFunctionSet for non-existent collection", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x5555555555555555555555555555555555555555");
        const setEvent = createWeightFunctionSetEvent(collectionAddr, LINEAR_FN_TYPE, BigInt.fromI32(1), BigInt.fromI32(1));
        handleWeightFunctionSet(setEvent); // Should not throw
        assert.entityCount("CollectionReward", 0);
    });


    test("should handle RewardsClaimedForLazy - existing CollectionReward", () => {
        clearStore();
        const userAddr = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        const collectionAddr = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        const dueAmount = BigInt.fromI32(100);
        const secondsUser = BigInt.fromI32(10);
        const incRPS = BigInt.fromI32(123); // Changed to non-zero
        const yieldSlice = BigInt.fromI32(456); // Changed to non-zero
        const nonce = BigInt.fromI32(123);

        // Explicitly create and save CollectionReward entity
        const collRewardId = generateCollectionRewardId(collectionAddr, HARDCODED_REWARD_TOKEN_ADDRESS);
        const collReward = new CollectionReward(collRewardId);
        collReward.collection = collectionAddr;
        collReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collReward.cTokenMarketAddress = HARDCODED_CTOKEN_MARKET_ADDRESS;
        collReward.isBorrowBased = false;
        collReward.collectionType = "ERC721";
        collReward.totalSecondsAccrued = ZERO_BI;
        collReward.lastUpdate = BigInt.fromI32(1672531200); // Use a fixed timestamp
        collReward.fnType = "LINEAR";
        collReward.p1 = ZERO_BI;
        collReward.p2 = ZERO_BI;
        collReward.rewardPerSecond = BigInt.fromI32(1000);
        collReward.totalRewardsPool = ZERO_BI;
        collReward.save();

        // Mock vault() to return a valid address for this test case
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vault", "vault():(address)")
            .returns([ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)]);

        const claimEvent = createRewardsClaimedForLazyEvent(userAddr, collectionAddr, dueAmount, secondsUser, incRPS, yieldSlice, nonce);
        handleRewardsClaimedForLazy(claimEvent);

        const claimId = claimEvent.transaction.hash.concatI32(claimEvent.logIndex.toI32()).toHexString();
        assert.entityCount("RewardClaim", 1);
        assert.fieldEquals("RewardClaim", claimId, "account", userAddr.toHex());
        assert.fieldEquals("RewardClaim", claimId, "collectionAddress", collectionAddr.toHex());
        assert.fieldEquals("RewardClaim", claimId, "amount", dueAmount.toString());
        assert.fieldEquals("RewardClaim", claimId, "nonce", nonce.toString());
        assert.fieldEquals("RewardClaim", claimId, "secondsUser", secondsUser.toString());

        const acrId = generateAccountCollectionRewardId(userAddr.toHexString(), collRewardId).toHexString(); // Use collRewardId directly
        assert.entityCount("AccountCollectionReward", 1);
        assert.fieldEquals("AccountCollectionReward", acrId, "lastUpdate", claimEvent.block.timestamp.toString());
    });

    test("should handle RewardsClaimedForLazy - no CollectionReward (partial claim)", () => {
        clearStore();
        const userAddr = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        const collectionAddr = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc"); // This is MOCK_CONTRACT_ADDRESS
        const dueAmount = BigInt.fromI32(200);
        const secondsUser = BigInt.fromI32(20);
        const incRPS = BigInt.fromI32(2);
        const yieldSlice = BigInt.fromI32(8);
        const nonce = BigInt.fromI32(124);

        // Mock vault() to revert for this specific test case
        // The MOCK_CONTRACT_ADDRESS is the address of the RewardsController contract emitting the event
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vault", "vault():(address)")
            .reverts();

        const claimEvent = createRewardsClaimedForLazyEvent(userAddr, collectionAddr, dueAmount, secondsUser, incRPS, yieldSlice, nonce);
        handleRewardsClaimedForLazy(claimEvent);

        // If vault() call reverts, no RewardClaim or AccountCollectionReward should be created.
        // The handler should log a critical error and return.
        assert.entityCount("RewardClaim", 0);
        assert.entityCount("AccountCollectionReward", 0);
    });

    test("should handle RewardsClaimedForLazy - vault call reverts", () => {
        clearStore();
        const userAddr = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        const collectionAddr = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");

        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vault", "vault():(address)")
            .reverts();

        const claimEvent = createRewardsClaimedForLazyEvent(userAddr, collectionAddr, BigInt.fromI32(100), BigInt.fromI32(10), BigInt.fromI32(1), BigInt.fromI32(5), BigInt.fromI32(123));
        handleRewardsClaimedForLazy(claimEvent); // Should log critical and return

        assert.entityCount("RewardClaim", 0); // No claim should be created
        assert.entityCount("AccountCollectionReward", 0);
    });


    test("should handle BatchRewardsClaimedForLazy - new Account", () => {
        clearStore();
        const callerAddr = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd");
        const totalDue = BigInt.fromI32(500);
        const numClaims = BigInt.fromI32(5);

        const event = createBatchRewardsClaimedForLazyEvent(callerAddr, totalDue, numClaims);
        handleBatchRewardsClaimedForLazy(event);

        assert.entityCount("Account", 1);
        assert.fieldEquals("Account", callerAddr.toHex(), "id", callerAddr.toHex());
    });

    test("should handle BatchRewardsClaimedForLazy - existing Account", () => {
        clearStore();
        const callerAddr = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd");
        // Pre-create account
        const account = new Account(callerAddr.toHexString()); // Use toHexString() for ID
        account.save(); // Save it to the mock store
        assert.entityCount("Account", 1);

        const totalDue = BigInt.fromI32(500);
        const numClaims = BigInt.fromI32(5);
        const event = createBatchRewardsClaimedForLazyEvent(callerAddr, totalDue, numClaims);
        handleBatchRewardsClaimedForLazy(event);

        assert.entityCount("Account", 1); // Should still be 1
        // The ID for assertion should match how it's stored. If Account ID is Bytes, toHex() is for comparison.
        assert.fieldEquals("Account", (callerAddr as Bytes).toHex(), "id", (callerAddr as Bytes).toHex());
    });


    test("should handle RewardPerBlockUpdated - new Vault", () => {
        clearStore();
        const vaultAddr = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
        const rewardPerBlock = BigInt.fromI32(10000);

        const event = createRewardPerBlockUpdatedEvent(vaultAddr, rewardPerBlock);

        const vaultInfoTuple = new ethereum.Tuple();
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(rewardPerBlock)); // uint128 rewardPerBlock
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(123))); // uint128 globalRPW
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(456))); // uint128 totalWeight
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(event.block.timestamp)); // uint32 lastUpdate
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(789))); // uint64 p1
        vaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(101))); // uint64 p2
        vaultInfoTuple.push(ethereum.Value.fromBoolean(true)); // bool useExp
        vaultInfoTuple.push(ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)); // address rewardToken
        vaultInfoTuple.push(ethereum.Value.fromAddress(vaultAddr)); // address collection
        vaultInfoTuple.push(ethereum.Value.fromBoolean(false)); // bool weightByBorrow
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint128,uint128,uint128,uint32,uint64,uint64,bool,address,address,bool))")
            .withArgs([ethereum.Value.fromAddress(vaultAddr)])
            .returns([ethereum.Value.fromTuple(vaultInfoTuple)]);

        handleRewardPerBlockUpdated(event);

        const vaultId = vaultAddr.toHex();
        assert.entityCount("Vault", 1);
        assert.fieldEquals("Vault", vaultId, "rewardPerBlock", rewardPerBlock.toString());
        assert.fieldEquals("Vault", vaultId, "globalRPW", "123");
        assert.fieldEquals("Vault", vaultId, "totalWeight", "456");
        assert.fieldEquals("Vault", vaultId, "useExp", "true");
    });

    test("should handle RewardPerBlockUpdated - existing Vault", () => {
        clearStore();
        const vaultAddr = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
        const initialRewardPerBlock = BigInt.fromI32(5000);
        const updatedRewardPerBlock = BigInt.fromI32(15000);

        const initialEvent = createRewardPerBlockUpdatedEvent(vaultAddr, initialRewardPerBlock, BigInt.fromI32(1));
        const initialVaultInfoTuple = new ethereum.Tuple();
        initialVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(5000))); // uint128 rewardPerBlock
        initialVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))); // uint128 globalRPW
        initialVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200))); // uint128 totalWeight
        initialVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(initialEvent.block.timestamp)); // uint32 lastUpdate
        initialVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(ZERO_BI)); // uint64 p1
        initialVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(ZERO_BI)); // uint64 p2
        initialVaultInfoTuple.push(ethereum.Value.fromBoolean(false)); // bool useExp
        initialVaultInfoTuple.push(ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)); // address rewardToken
        initialVaultInfoTuple.push(ethereum.Value.fromAddress(vaultAddr)); // address collection
        initialVaultInfoTuple.push(ethereum.Value.fromBoolean(false)); // bool weightByBorrow
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint128,uint128,uint128,uint32,uint64,uint64,bool,address,address,bool))")
            .withArgs([ethereum.Value.fromAddress(vaultAddr)])
            .returns([ethereum.Value.fromTuple(initialVaultInfoTuple)]);
        handleRewardPerBlockUpdated(initialEvent);

        const vaultId = vaultAddr.toHex();
        assert.fieldEquals("Vault", vaultId, "rewardPerBlock", initialRewardPerBlock.toString());

        const updateEvent = createRewardPerBlockUpdatedEvent(vaultAddr, updatedRewardPerBlock, BigInt.fromI32(2), "0x77777abcdef1234567890abcdef1234567890abcdef1234567890abcdefe");
        const updatedVaultInfoTuple = new ethereum.Tuple();
        updatedVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(updatedRewardPerBlock)); // uint128 rewardPerBlock
        updatedVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(150))); // uint128 globalRPW
        updatedVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(250))); // uint128 totalWeight
        updatedVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(updateEvent.block.timestamp)); // uint32 lastUpdate
        updatedVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))); // uint64 p1
        updatedVaultInfoTuple.push(ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(60))); // uint64 p2
        updatedVaultInfoTuple.push(ethereum.Value.fromBoolean(true)); // bool useExp
        updatedVaultInfoTuple.push(ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)); // address rewardToken
        updatedVaultInfoTuple.push(ethereum.Value.fromAddress(vaultAddr)); // address collection
        updatedVaultInfoTuple.push(ethereum.Value.fromBoolean(true)); // bool weightByBorrow
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint128,uint128,uint128,uint32,uint64,uint64,bool,address,address,bool))")
            .withArgs([ethereum.Value.fromAddress(vaultAddr)])
            .returns([ethereum.Value.fromTuple(updatedVaultInfoTuple)]);
        handleRewardPerBlockUpdated(updateEvent);

        assert.fieldEquals("Vault", vaultId, "rewardPerBlock", updatedRewardPerBlock.toString());
        assert.fieldEquals("Vault", vaultId, "globalRPW", "150");
        assert.fieldEquals("Vault", vaultId, "totalWeight", "250");
        assert.fieldEquals("Vault", vaultId, "weightByBorrow", "true");
    });

    describe("cToken-mapping Handlers", () => {
        test("should handle Borrow event and create/update CTokenMarket and Account entities", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            const borrowerAddress = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
            const borrowAmount = BigInt.fromI32(1000);
            const accountBorrows = BigInt.fromI32(5000);
            const totalBorrows = BigInt.fromI32(10000);

            const borrowEvent = createBorrowEvent(
                cTokenAddress,
                borrowerAddress,
                borrowAmount,
                accountBorrows,
                totalBorrows
            );

            // Mock getOrCreateCTokenMarket
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"), // This address doesn't matter for the mock, as it's a global function
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            )
                .withArgs([
                    ethereum.Value.fromAddress(cTokenAddress),
                    ethereum.Value.fromUnsignedBigInt(borrowEvent.block.timestamp)
                ])
                .returns([
                    ethereum.Value.fromString(cTokenAddress.toHexString()), // id
                    ethereum.Value.fromBytes(Address.fromString("0x1111111111111111111111111111111111111111")), // underlying
                    ethereum.Value.fromString("mDAI"), // underlyingSymbol
                    ethereum.Value.fromI32(18), // underlyingDecimals
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalSupplyC
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalBorrowsU
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalReservesU
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // exchangeRate
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // collateralFactor
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // borrowIndex
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // lastAccrualTimestamp
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)) // blockTimestamp
                ]);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock cToken.try_totalSupply() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial supply for new market

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial borrows for new market

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial reserves for new market

            // Mock cToken.try_exchangeRateStored() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "exchangeRateStored",
                "exchangeRateStored():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial exchangeRate for new market

            // Mock getOrCreateAccount
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"), // This address doesn't matter for the mock
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(borrowerAddress)])
                .returns([ethereum.Value.fromString(borrowerAddress.toHexString())]);

            handleBorrow(borrowEvent);

            // Assertions for CTokenMarket
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalBorrowsU", totalBorrows.toString());
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", borrowEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = borrowerAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });

        test("should update existing CTokenMarket and Account entities on Borrow event", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            const borrowerAddress = Address.fromString("0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
            const initialTotalBorrows = BigInt.fromI32(5000);
            const updatedTotalBorrows = BigInt.fromI32(15000);

            // Pre-create CTokenMarket
            const market = new CTokenMarket(cTokenAddress.toHexString());
            market.underlying = Address.fromString("0x1111111111111111111111111111111111111111");
            market.underlyingSymbol = "mDAI";
            market.underlyingDecimals = 18;
            market.totalSupplyC = BigInt.fromI32(0);
            market.totalBorrowsU = initialTotalBorrows;
            market.totalReservesU = BigInt.fromI32(0);
            market.exchangeRate = BigInt.fromI32(0);
            market.collateralFactor = BigInt.fromI32(0);
            market.borrowIndex = BigInt.fromI32(0);
            market.lastAccrualTimestamp = BigInt.fromI32(0);
            market.blockTimestamp = BigInt.fromI32(0);
            market.save();

            // Pre-create Account
            const account = new Account(borrowerAddress.toHexString());
            account.save();

            const borrowEvent = createBorrowEvent(
                cTokenAddress,
                borrowerAddress,
                BigInt.fromI32(10000), // borrowAmount
                BigInt.fromI32(10000), // accountBorrows
                updatedTotalBorrows, // totalBorrows
                BigInt.fromI32(2), // logIndex
            );

            // Mock getOrCreateCTokenMarket to return the existing market
            // Mock getOrCreateCTokenMarket to return the existing market
            const marketReturnTuple = new ethereum.Tuple();
            marketReturnTuple.push(ethereum.Value.fromString(cTokenAddress.toHexString())); // id
            marketReturnTuple.push(ethereum.Value.fromBytes(market.underlying)); // underlying
            marketReturnTuple.push(ethereum.Value.fromString(market.underlyingSymbol)); // underlyingSymbol
            marketReturnTuple.push(ethereum.Value.fromI32(market.underlyingDecimals)); // underlyingDecimals
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.totalSupplyC)); // totalSupplyC
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)); // totalBorrowsU
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.totalReservesU)); // totalReservesU
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.exchangeRate)); // exchangeRate
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.collateralFactor)); // collateralFactor
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.borrowIndex)); // borrowIndex
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.lastAccrualTimestamp)); // lastAccrualTimestamp
            marketReturnTuple.push(ethereum.Value.fromUnsignedBigInt(market.blockTimestamp)); // blockTimestamp

            const mockedMarketFunctionBorrowUpdate = createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            );
            const borrowArgsArrayUpdate: Array<ethereum.Value> = [
                ethereum.Value.fromAddress(cTokenAddress),
                ethereum.Value.fromUnsignedBigInt(borrowEvent.block.timestamp)
            ];
            const borrowReturnArray: Array<ethereum.Value> = [ethereum.Value.fromTuple(marketReturnTuple)];
            mockedMarketFunctionBorrowUpdate
                .withArgs(borrowArgsArrayUpdate)
                .returns(borrowReturnArray);

            // Mock getOrCreateAccount to return the existing account
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(borrowerAddress)])
                .returns([ethereum.Value.fromString(borrowerAddress.toHexString())]);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock cToken.try_totalSupply() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalSupplyC)]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)]);

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalReservesU)]);

            // Mock cToken.try_exchangeRateStored() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "exchangeRateStored",
                "exchangeRateStored():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.exchangeRate)]);

            handleBorrow(borrowEvent);

            // Assertions for CTokenMarket
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalBorrowsU", updatedTotalBorrows.toString());
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", borrowEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = borrowerAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });

        test("should handle Mint event and create/update CTokenMarket and Account entities", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc");
            const minterAddress = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd");
            const mintAmount = BigInt.fromI32(2000);
            const mintTokens = BigInt.fromI32(200);
            const newTotalSupply = BigInt.fromI32(100000);

            const mintEvent = createMintEvent(
                cTokenAddress,
                minterAddress,
                mintAmount,
                mintTokens
            );

            // Mock getOrCreateCTokenMarket
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            )
                .withArgs([
                    ethereum.Value.fromAddress(cTokenAddress),
                    ethereum.Value.fromUnsignedBigInt(mintEvent.block.timestamp)
                ])
                .returns([
                    ethereum.Value.fromString(cTokenAddress.toHexString()), // id
                    ethereum.Value.fromBytes(Address.fromString("0x1111111111111111111111111111111111111111")), // underlying
                    ethereum.Value.fromString("mDAI"), // underlyingSymbol
                    ethereum.Value.fromI32(18), // underlyingDecimals
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalSupplyC
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalBorrowsU
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalReservesU
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // exchangeRate
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // collateralFactor
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // borrowIndex
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // lastAccrualTimestamp
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)) // blockTimestamp
                ]);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock getOrCreateAccount
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(minterAddress)])
                .returns([ethereum.Value.fromString(minterAddress.toHexString())]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial borrows for new market

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial reserves for new market

            // Mock cToken.try_exchangeRateStored() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "exchangeRateStored",
                "exchangeRateStored():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial exchangeRate for new market

            // Mock cToken.try_totalSupply()
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(newTotalSupply)]);

            handleMint(mintEvent);

            // Assertions for CTokenMarket
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalSupplyC", newTotalSupply.toString());
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", mintEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = minterAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });

        test("should update existing CTokenMarket and Account entities on Mint event", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc");
            const minterAddress = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd");
            const initialTotalSupply = BigInt.fromI32(50000);
            const updatedTotalSupply = BigInt.fromI32(150000);

            // Pre-create CTokenMarket
            const market = new CTokenMarket(cTokenAddress.toHexString());
            market.underlying = Address.fromString("0x1111111111111111111111111111111111111111");
            market.underlyingSymbol = "mDAI";
            market.underlyingDecimals = 18;
            market.totalSupplyC = initialTotalSupply;
            market.totalBorrowsU = BigInt.fromI32(0);
            market.totalReservesU = BigInt.fromI32(0);
            market.exchangeRate = BigInt.fromI32(0);
            market.collateralFactor = BigInt.fromI32(0);
            market.borrowIndex = BigInt.fromI32(0);
            market.lastAccrualTimestamp = BigInt.fromI32(0);
            market.blockTimestamp = BigInt.fromI32(0);
            market.save();

            // Pre-create Account
            const account = new Account(minterAddress.toHexString());
            account.save();

            const mintEvent = createMintEvent(
                cTokenAddress,
                minterAddress,
                BigInt.fromI32(10000), // mintAmount
                BigInt.fromI32(1000), // mintTokens
                BigInt.fromI32(2), // logIndex
            );

            // Mock getOrCreateCTokenMarket to return the existing market
            const marketReturnTupleMintUpdate = new ethereum.Tuple();
            marketReturnTupleMintUpdate.push(ethereum.Value.fromString(cTokenAddress.toHexString())); // id
            marketReturnTupleMintUpdate.push(ethereum.Value.fromBytes(market.underlying)); // underlying
            marketReturnTupleMintUpdate.push(ethereum.Value.fromString(market.underlyingSymbol)); // underlyingSymbol
            marketReturnTupleMintUpdate.push(ethereum.Value.fromI32(market.underlyingDecimals)); // underlyingDecimals
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.totalSupplyC)); // totalSupplyC
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)); // totalBorrowsU
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.totalReservesU)); // totalReservesU
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.exchangeRate)); // exchangeRate
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.collateralFactor)); // collateralFactor
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.borrowIndex)); // borrowIndex
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.lastAccrualTimestamp)); // lastAccrualTimestamp
            marketReturnTupleMintUpdate.push(ethereum.Value.fromUnsignedBigInt(market.blockTimestamp)); // blockTimestamp

            const mockedMarketFunctionMintUpdate = createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            );
            const mintArgsArrayUpdate: Array<ethereum.Value> = [
                ethereum.Value.fromAddress(cTokenAddress),
                ethereum.Value.fromUnsignedBigInt(mintEvent.block.timestamp)
            ];
            const mintReturnArrayUpdate: Array<ethereum.Value> = [ethereum.Value.fromTuple(marketReturnTupleMintUpdate)];
            mockedMarketFunctionMintUpdate
                .withArgs(mintArgsArrayUpdate)
                .returns(mintReturnArrayUpdate);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock getOrCreateAccount to return the existing account
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(minterAddress)])
                .returns([ethereum.Value.fromString(minterAddress.toHexString())]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)]);

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalReservesU)]);

            // Mock cToken.try_exchangeRateStored() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "exchangeRateStored",
                "exchangeRateStored():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.exchangeRate)]);

            // Mock cToken.try_totalSupply()
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(updatedTotalSupply)]);

            handleMint(mintEvent);

            // Assertions for CTokenMarket
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalSupplyC", updatedTotalSupply.toString());
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", mintEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = minterAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });

        test("should handle Mint event when totalSupply() call reverts", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc");
            const minterAddress = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd");
            const mintAmount = BigInt.fromI32(2000);
            const mintTokens = BigInt.fromI32(200);

            const mintEvent = createMintEvent(
                cTokenAddress,
                minterAddress,
                mintAmount,
                mintTokens
            );

            // Pre-create CTokenMarket with some initial data
            const market = new CTokenMarket(cTokenAddress.toHexString());
            market.underlying = Address.fromString("0x1111111111111111111111111111111111111111");
            market.underlyingSymbol = "mDAI";
            market.underlyingDecimals = 18;
            market.totalSupplyC = BigInt.fromI32(50000); // Initial supply
            market.totalBorrowsU = BigInt.fromI32(0);
            market.totalReservesU = BigInt.fromI32(0);
            market.exchangeRate = BigInt.fromI32(0);
            market.collateralFactor = BigInt.fromI32(0);
            market.borrowIndex = BigInt.fromI32(0);
            market.lastAccrualTimestamp = BigInt.fromI32(0);
            market.blockTimestamp = BigInt.fromI32(0);
            market.save();

            // Mock getOrCreateCTokenMarket to return the existing market
            const marketReturnTupleMintRevert = new ethereum.Tuple();
            marketReturnTupleMintRevert.push(ethereum.Value.fromString(cTokenAddress.toHexString())); // id
            marketReturnTupleMintRevert.push(ethereum.Value.fromBytes(market.underlying)); // underlying
            marketReturnTupleMintRevert.push(ethereum.Value.fromString(market.underlyingSymbol)); // underlyingSymbol
            marketReturnTupleMintRevert.push(ethereum.Value.fromI32(market.underlyingDecimals)); // underlyingDecimals
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.totalSupplyC)); // totalSupplyC
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)); // totalBorrowsU
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.totalReservesU)); // totalReservesU
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.exchangeRate)); // exchangeRate
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.collateralFactor)); // collateralFactor
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.borrowIndex)); // borrowIndex
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.lastAccrualTimestamp)); // lastAccrualTimestamp
            marketReturnTupleMintRevert.push(ethereum.Value.fromUnsignedBigInt(market.blockTimestamp)); // blockTimestamp

            const mockedMarketFunctionMintRevert = createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            );
            const mintArgsArrayRevert: Array<ethereum.Value> = [
                ethereum.Value.fromAddress(cTokenAddress),
                ethereum.Value.fromUnsignedBigInt(mintEvent.block.timestamp)
            ];
            const mintReturnArrayRevert: Array<ethereum.Value> = [ethereum.Value.fromTuple(marketReturnTupleMintRevert)];
            mockedMarketFunctionMintRevert
                .withArgs(mintArgsArrayRevert)
                .returns(mintReturnArrayRevert);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock getOrCreateAccount
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(minterAddress)])
                .returns([ethereum.Value.fromString(minterAddress.toHexString())]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)]);

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalReservesU)]);

            // Mock cToken.try_exchangeRateStored() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "exchangeRateStored",
                "exchangeRateStored():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.exchangeRate)]);

            // Mock cToken.try_totalSupply() to revert
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .reverts();

            handleMint(mintEvent);

            // Assertions for CTokenMarket - totalSupplyC should remain unchanged
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalSupplyC", market.totalSupplyC.toString()); // Should be initial value
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", mintEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = minterAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });
        test("should handle Redeem event and create/update CTokenMarket and Account entities", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
            const redeemerAddress = Address.fromString("0xffffffffffffffffffffffffffffffffffffffff");
            const redeemAmount = BigInt.fromI32(500);
            const redeemTokens = BigInt.fromI32(50);
            const newTotalSupply = BigInt.fromI32(90000);

            const redeemEvent = createRedeemEvent(
                cTokenAddress,
                redeemerAddress,
                redeemAmount,
                redeemTokens
            );

            // Mock getOrCreateCTokenMarket
            const newMarketRedeem = new CTokenMarket(cTokenAddress.toHexString());
            newMarketRedeem.underlying = Address.fromString("0x1111111111111111111111111111111111111111");
            newMarketRedeem.underlyingSymbol = "mDAI";
            newMarketRedeem.underlyingDecimals = 18;
            newMarketRedeem.totalSupplyC = BigInt.fromI32(100000);
            newMarketRedeem.totalBorrowsU = BigInt.fromI32(0);
            newMarketRedeem.totalReservesU = BigInt.fromI32(0);
            newMarketRedeem.exchangeRate = BigInt.fromI32(0);
            newMarketRedeem.collateralFactor = BigInt.fromI32(0);
            newMarketRedeem.borrowIndex = BigInt.fromI32(0);
            newMarketRedeem.lastAccrualTimestamp = BigInt.fromI32(0);
            newMarketRedeem.blockTimestamp = BigInt.fromI32(0);
            newMarketRedeem.save();

            // Mock getOrCreateCTokenMarket
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            )
                .withArgs([
                    ethereum.Value.fromAddress(cTokenAddress),
                    ethereum.Value.fromUnsignedBigInt(redeemEvent.block.timestamp)
                ])
                .returns([
                    ethereum.Value.fromString(cTokenAddress.toHexString()), // id
                    ethereum.Value.fromBytes(Address.fromString("0x1111111111111111111111111111111111111111")), // underlying
                    ethereum.Value.fromString("mDAI"), // underlyingSymbol
                    ethereum.Value.fromI32(18), // underlyingDecimals
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100000)), // totalSupplyC (initial value)
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalBorrowsU
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // totalReservesU
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // exchangeRate
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // collateralFactor
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // borrowIndex
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)), // lastAccrualTimestamp
                    ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0)) // blockTimestamp
                ]);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock getOrCreateAccount
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(redeemerAddress)])
                .returns([ethereum.Value.fromString(redeemerAddress.toHexString())]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial borrows for new market

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial reserves for new market

            // Mock cToken.try_exchangeRateStored() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "exchangeRateStored",
                "exchangeRateStored():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(0))]); // Initial exchangeRate for new market

            // Mock cToken.try_totalSupply()
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(newTotalSupply)]);

            handleRedeem(redeemEvent);

            // Assertions for CTokenMarket
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalSupplyC", newTotalSupply.toString());
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", redeemEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = redeemerAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });

        test("should update existing CTokenMarket and Account entities on Redeem event", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
            const redeemerAddress = Address.fromString("0xffffffffffffffffffffffffffffffffffffffff");
            const initialTotalSupply = BigInt.fromI32(100000);
            const updatedTotalSupply = BigInt.fromI32(95000);

            // Pre-create CTokenMarket
            const market = new CTokenMarket(cTokenAddress.toHexString());
            market.underlying = Address.fromString("0x1111111111111111111111111111111111111111");
            market.underlyingSymbol = "mDAI";
            market.underlyingDecimals = 18;
            market.totalSupplyC = initialTotalSupply;
            market.totalBorrowsU = BigInt.fromI32(0);
            market.totalReservesU = BigInt.fromI32(0);
            market.exchangeRate = BigInt.fromI32(0);
            market.collateralFactor = BigInt.fromI32(0);
            market.borrowIndex = BigInt.fromI32(0);
            market.lastAccrualTimestamp = BigInt.fromI32(0);
            market.blockTimestamp = BigInt.fromI32(0);
            market.save();

            // Pre-create Account
            const account = new Account(redeemerAddress.toHexString());
            account.save();

            const redeemEvent = createRedeemEvent(
                cTokenAddress,
                redeemerAddress,
                BigInt.fromI32(500), // redeemAmount
                BigInt.fromI32(50), // redeemTokens
                BigInt.fromI32(2), // logIndex
            );

            // Mock getOrCreateCTokenMarket to return the existing market
            const marketReturnTupleRedeemUpdate = new ethereum.Tuple();
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromString(cTokenAddress.toHexString())); // id
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromBytes(market.underlying)); // underlying
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromString(market.underlyingSymbol)); // underlyingSymbol
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromI32(market.underlyingDecimals)); // underlyingDecimals
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.totalSupplyC)); // totalSupplyC
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)); // totalBorrowsU
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.totalReservesU)); // totalReservesU
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.exchangeRate)); // exchangeRate
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.collateralFactor)); // collateralFactor
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.borrowIndex)); // borrowIndex
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.lastAccrualTimestamp)); // lastAccrualTimestamp
            marketReturnTupleRedeemUpdate.push(ethereum.Value.fromUnsignedBigInt(market.blockTimestamp)); // blockTimestamp

            const mockedMarketFunctionRedeemUpdate = createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            );
            const redeemArgsArrayUpdate: Array<ethereum.Value> = [
                ethereum.Value.fromAddress(cTokenAddress),
                ethereum.Value.fromUnsignedBigInt(redeemEvent.block.timestamp)
            ];
            const redeemReturnArrayUpdate: Array<ethereum.Value> = [ethereum.Value.fromTuple(marketReturnTupleRedeemUpdate)];
            mockedMarketFunctionRedeemUpdate
                .withArgs(redeemArgsArrayUpdate)
                .returns(redeemReturnArrayUpdate);

            // Mock getOrCreateAccount to return the existing account
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(redeemerAddress)])
                .returns([ethereum.Value.fromString(redeemerAddress.toHexString())]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)]);

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalReservesU)]);

            // Mock cToken.try_totalSupply()
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(updatedTotalSupply)]);

            handleRedeem(redeemEvent);

            // Assertions for CTokenMarket
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalSupplyC", updatedTotalSupply.toString());
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", redeemEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = redeemerAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });

        test("should handle Redeem event when totalSupply() call reverts", () => {
            clearStore();

            const cTokenAddress = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
            const redeemerAddress = Address.fromString("0xffffffffffffffffffffffffffffffffffffffff");
            const redeemAmount = BigInt.fromI32(500);
            const redeemTokens = BigInt.fromI32(50);

            const redeemEvent = createRedeemEvent(
                cTokenAddress,
                redeemerAddress,
                redeemAmount,
                redeemTokens
            );

            // Pre-create CTokenMarket with some initial data
            const market = new CTokenMarket(cTokenAddress.toHexString());
            market.underlying = Address.fromString("0x1111111111111111111111111111111111111111");
            market.underlyingSymbol = "mDAI";
            market.underlyingDecimals = 18;
            market.totalSupplyC = BigInt.fromI32(100000); // Initial supply
            market.totalBorrowsU = BigInt.fromI32(0);
            market.totalReservesU = BigInt.fromI32(0);
            market.exchangeRate = BigInt.fromI32(0);
            market.collateralFactor = BigInt.fromI32(0);
            market.borrowIndex = BigInt.fromI32(0);
            market.lastAccrualTimestamp = BigInt.fromI32(0);
            market.blockTimestamp = BigInt.fromI32(0);
            market.save();

            // Mock getOrCreateCTokenMarket to return the existing market
            const marketReturnTupleRedeemRevert = new ethereum.Tuple();
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromString(cTokenAddress.toHexString())); // id
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromBytes(market.underlying)); // underlying
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromString(market.underlyingSymbol)); // underlyingSymbol
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromI32(market.underlyingDecimals)); // underlyingDecimals
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.totalSupplyC)); // totalSupplyC
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)); // totalBorrowsU
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.totalReservesU)); // totalReservesU
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.exchangeRate)); // exchangeRate
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.collateralFactor)); // collateralFactor
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.borrowIndex)); // borrowIndex
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.lastAccrualTimestamp)); // lastAccrualTimestamp
            marketReturnTupleRedeemRevert.push(ethereum.Value.fromUnsignedBigInt(market.blockTimestamp)); // blockTimestamp

            const mockedMarketFunctionRedeemRevert = createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateCTokenMarket",
                "getOrCreateCTokenMarket(address,uint256):(string,bytes,string,int32,uint256,uint256,uint256,uint256,uint256,uint256,uint256,uint256)"
            );
            const redeemArgsArrayRevert: Array<ethereum.Value> = [
                ethereum.Value.fromAddress(cTokenAddress),
                ethereum.Value.fromUnsignedBigInt(redeemEvent.block.timestamp)
            ];
            const redeemReturnArrayRevert: Array<ethereum.Value> = [ethereum.Value.fromTuple(marketReturnTupleRedeemRevert)];
            mockedMarketFunctionRedeemRevert
                .withArgs(redeemArgsArrayRevert)
                .returns(redeemReturnArrayRevert);

            // Mock comptroller() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "comptroller",
                "comptroller():(address)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromAddress(Address.fromString("0x0000000000000000000000000000000000000000"))]); // Mock with a dummy address

            // Mock getOrCreateAccount
            createMockedFunction(
                Address.fromString("0x0000000000000000000000000000000000000000"),
                "getOrCreateAccount",
                "getOrCreateAccount(address):(string)"
            )
                .withArgs([ethereum.Value.fromAddress(redeemerAddress)])
                .returns([ethereum.Value.fromString(redeemerAddress.toHexString())]);

            // Mock cToken.try_totalBorrows() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalBorrows",
                "totalBorrows():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalBorrowsU)]);

            // Mock cToken.try_totalReserves() for getOrCreateCTokenMarket
            createMockedFunction(
                cTokenAddress,
                "totalReserves",
                "totalReserves():(uint256)"
            )
                .withArgs([])
                .returns([ethereum.Value.fromUnsignedBigInt(market.totalReservesU)]);

            // Mock cToken.try_totalSupply() to revert
            createMockedFunction(
                cTokenAddress,
                "totalSupply",
                "totalSupply():(uint256)"
            )
                .withArgs([])
                .reverts();

            handleRedeem(redeemEvent);

            // Assertions for CTokenMarket - totalSupplyC should remain unchanged
            const marketId = cTokenAddress.toHexString();
            assert.entityCount("CTokenMarket", 1);
            assert.fieldEquals("CTokenMarket", marketId, "totalSupplyC", market.totalSupplyC.toString()); // Should be initial value
            assert.fieldEquals("CTokenMarket", marketId, "blockTimestamp", redeemEvent.block.timestamp.toString());

            // Assertions for Account
            const accountId = redeemerAddress.toHexString();
            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", accountId, "id", accountId);
        });
    });

});

test("should handle RewardPerBlockUpdated - contract call reverts", () => {
    clearStore();
    const vaultAddr = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
    const rewardPerBlock = BigInt.fromI32(10000);
    const event = createRewardPerBlockUpdatedEvent(vaultAddr, rewardPerBlock);

    createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint128,uint128,uint128,uint32,uint64,uint64,bool,address,address,bool))")
        .withArgs([ethereum.Value.fromAddress(vaultAddr)])
        .reverts();

    handleRewardPerBlockUpdated(event); // Should log error and return

    assert.entityCount("Vault", 0); // No vault should be created or updated
});