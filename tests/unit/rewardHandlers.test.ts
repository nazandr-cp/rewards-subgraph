import { describe, test, assert, clearStore, newMockEvent, createMockedFunction } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum, Bytes } from "@graphprotocol/graph-ts";
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
import { Account } from "../../generated/schema"; // Import Account for direct instantiation

// Constants used in handlers or for mocking
const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000a");
const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000b");
const MOCK_CONTRACT_ADDRESS = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc"); // RewardsController contract
const ZERO_BI = BigInt.fromI32(0);

// Weight Function Type constants
const LINEAR_FN_TYPE: u8 = 0;
const EXPONENTIAL_FN_TYPE: u8 = 1;

// Helper function to create a RewardClaimed event (existing)
function createRewardClaimedEvent(
    claimer: Address, // maps to 'user' in event
    collection: Address, // maps to 'vault' in event
    amount: BigInt,
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
    const userParam = new ethereum.EventParam("user", ethereum.Value.fromAddress(claimer));
    const vaultParam = new ethereum.EventParam("vault", ethereum.Value.fromAddress(collection));
    const amountParam = new ethereum.EventParam("amount", ethereum.Value.fromUnsignedBigInt(amount));

    rewardClaimedEvent.parameters.push(userParam);
    rewardClaimedEvent.parameters.push(vaultParam);
    rewardClaimedEvent.parameters.push(amountParam);

    return rewardClaimedEvent;
}

// Helper to create NewCollectionWhitelisted event
function createNewCollectionWhitelistedEvent(
    collection: Address,
    collectionType: u8, // 0 for ERC721, 1 for ERC1155
    rewardBasis: u8,   // 0 for DEPOSIT, 1 for BORROW
    sharePercentage: u32,
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
    event.parameters.push(new ethereum.EventParam("collectionType", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(collectionType))));
    event.parameters.push(new ethereum.EventParam("rewardBasis", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(rewardBasis))));
    event.parameters.push(new ethereum.EventParam("sharePercentage", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(sharePercentage))));
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
    newSharePercentage: u32,
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
    event.parameters.push(new ethereum.EventParam("newSharePercentage", ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(newSharePercentage))));
    return event;
}

// Helper to create WeightFunctionSet event
function createWeightFunctionSetEvent(
    collection: Address,
    fnType: u8,
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

    const fnTupleArray: Array<ethereum.Value> = [
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(fnType)),
        ethereum.Value.fromUnsignedBigInt(p1),
        ethereum.Value.fromUnsignedBigInt(p2)
    ];
    const fnTuple = changetype<ethereum.Tuple>(fnTupleArray);

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
    event.parameters.push(new ethereum.EventParam("incRPS", ethereum.Value.fromUnsignedBigInt(incRPS)));
    event.parameters.push(new ethereum.EventParam("yieldSlice", ethereum.Value.fromUnsignedBigInt(yieldSlice)));
    event.parameters.push(new ethereum.EventParam("nonce", ethereum.Value.fromUnsignedBigInt(nonce)));
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


describe("Reward Handlers", () => {
    test("should handle RewardClaimed event and create/update Vault and AccountVault entities", () => {
        clearStore();

        const userAddress = Address.fromString("0x0000000000000000000000000000000000000001");
        const vaultAddress = Address.fromString("0x0000000000000000000000000000000000000002");
        const rewardAmount = BigInt.fromI32(1000);
        const logIdx = BigInt.fromI32(5);
        const txHashStr = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

        const rewardClaimedEventInstance = createRewardClaimedEvent(
            userAddress,
            vaultAddress,
            rewardAmount,
            logIdx,
            txHashStr
        );

        const vaultInfoTupleArray: Array<ethereum.Value> = [
            ethereum.Value.fromUnsignedBigInt(rewardAmount),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200)),
            ethereum.Value.fromUnsignedBigInt(rewardClaimedEventInstance.block.timestamp),
            ethereum.Value.fromBoolean(true),
            ethereum.Value.fromBoolean(false),
            ethereum.Value.fromUnsignedBigInt(ZERO_BI),
            ethereum.Value.fromUnsignedBigInt(ZERO_BI)
        ];
        const vaultInfoTuple = changetype<ethereum.Tuple>(vaultInfoTupleArray);
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
            .withArgs([ethereum.Value.fromAddress(vaultAddress)])
            .returns([ethereum.Value.fromTuple(vaultInfoTuple)]);

        const accInfoTupleArray: Array<ethereum.Value> = [
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(25))
        ];
        const accInfoTuple = changetype<ethereum.Tuple>(accInfoTupleArray);
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "acc", "acc(address,address):((uint256,uint256))")
            .withArgs([ethereum.Value.fromAddress(vaultAddress), ethereum.Value.fromAddress(userAddress)])
            .returns([ethereum.Value.fromTuple(accInfoTuple)]);

        handleRewardClaimed(rewardClaimedEventInstance);

        const vaultId = vaultAddress.toHex();
        assert.entityCount("Vault", 1);
        assert.fieldEquals("Vault", vaultId, "rewardPerBlock", rewardAmount.toString());
        assert.fieldEquals("Vault", vaultId, "globalRPW", "100");
        assert.fieldEquals("Vault", vaultId, "totalWeight", "200");

        const accountVaultId = vaultId + "-" + userAddress.toHex();
        assert.entityCount("AccountVault", 1);
        assert.fieldEquals("AccountVault", accountVaultId, "vault", vaultId);
        assert.fieldEquals("AccountVault", accountVaultId, "account", userAddress.toHex());
        assert.fieldEquals("AccountVault", accountVaultId, "weight", "50");
        assert.fieldEquals("AccountVault", accountVaultId, "rewardDebt", "25");
        assert.fieldEquals("AccountVault", accountVaultId, "accrued", ZERO_BI.toString());
        assert.fieldEquals("AccountVault", accountVaultId, "claimable", ZERO_BI.toString());
    });

    test("should handle NewCollectionWhitelisted (ERC721, Deposit)", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
        const event = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);

        handleNewCollectionWhitelisted(event);

        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        assert.entityCount("CollectionReward", 1);
        assert.fieldEquals("CollectionReward", collRewardId, "collection", collectionAddr.toHex());
        assert.fieldEquals("CollectionReward", collRewardId, "rewardToken", HARDCODED_REWARD_TOKEN_ADDRESS.toHex());
        assert.fieldEquals("CollectionReward", collRewardId, "cTokenMarket", HARDCODED_CTOKEN_MARKET_ADDRESS.toHex());
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

        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
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
        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
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

        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        assert.notInStore("CollectionReward", collRewardId);
        assert.entityCount("CollectionReward", 0);
    });

    test("should handle CollectionRewardShareUpdated", () => {
        clearStore();
        const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
        const createEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
        handleNewCollectionWhitelisted(createEvent);

        const newShare = 1500;
        const updateEvent = createCollectionRewardShareUpdatedEvent(collectionAddr, newShare);
        handleCollectionRewardShareUpdated(updateEvent);

        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        assert.fieldEquals("CollectionReward", collRewardId, "rewardPerSecond", newShare.toString());
        assert.fieldEquals("CollectionReward", collRewardId, "lastUpdate", updateEvent.block.timestamp.toString());
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
        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();

        // Test LINEAR
        let fnType: u8 = LINEAR_FN_TYPE;
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
        fnType = 99 as u8; // Unknown
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
        const incRPS = BigInt.fromI32(1);
        const yieldSlice = BigInt.fromI32(5);
        const nonce = BigInt.fromI32(123);

        const createCollEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
        handleNewCollectionWhitelisted(createCollEvent);
        const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();

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

        const acrId = userAddr.toHex() + "-" + collRewardId;
        assert.entityCount("AccountCollectionReward", 1);
        assert.fieldEquals("AccountCollectionReward", acrId, "lastUpdate", claimEvent.block.timestamp.toString());
    });

    test("should handle RewardsClaimedForLazy - no CollectionReward (partial claim)", () => {
        clearStore();
        const userAddr = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
        const collectionAddr = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc");
        const dueAmount = BigInt.fromI32(200);
        const secondsUser = BigInt.fromI32(20);
        const incRPS = BigInt.fromI32(2);
        const yieldSlice = BigInt.fromI32(8);
        const nonce = BigInt.fromI32(124);

        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vault", "vault():(address)")
            .returns([ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)]);

        const claimEvent = createRewardsClaimedForLazyEvent(userAddr, collectionAddr, dueAmount, secondsUser, incRPS, yieldSlice, nonce);
        handleRewardsClaimedForLazy(claimEvent);

        const claimId = claimEvent.transaction.hash.concatI32(claimEvent.logIndex.toI32()).toHexString();
        assert.entityCount("RewardClaim", 1);
        assert.fieldEquals("RewardClaim", claimId, "account", userAddr.toHex());
        assert.fieldEquals("RewardClaim", claimId, "amount", dueAmount.toString());
        assert.fieldEquals("RewardClaim", claimId, "secondsColl", ZERO_BI.toString());
        assert.fieldEquals("RewardClaim", claimId, "incRPS", ZERO_BI.toString());
        assert.fieldEquals("RewardClaim", claimId, "yieldSlice", ZERO_BI.toString());

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
        const account = new Account(callerAddr as Bytes); // Use 'as Bytes' for ID
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

        const vaultInfoTupleArray: Array<ethereum.Value> = [
            ethereum.Value.fromUnsignedBigInt(rewardPerBlock),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(123)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(456)),
            ethereum.Value.fromUnsignedBigInt(event.block.timestamp),
            ethereum.Value.fromBoolean(false),
            ethereum.Value.fromBoolean(true),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(789)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(101)),
        ];
        const vaultInfoTuple = changetype<ethereum.Tuple>(vaultInfoTupleArray);
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
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
        const initialVaultInfoTupleArray: Array<ethereum.Value> = [
            ethereum.Value.fromUnsignedBigInt(initialRewardPerBlock), ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200)), ethereum.Value.fromUnsignedBigInt(initialEvent.block.timestamp),
            ethereum.Value.fromBoolean(false), ethereum.Value.fromBoolean(false),
            ethereum.Value.fromUnsignedBigInt(ZERO_BI), ethereum.Value.fromUnsignedBigInt(ZERO_BI)
        ];
        const initialVaultInfoTuple = changetype<ethereum.Tuple>(initialVaultInfoTupleArray);
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
            .withArgs([ethereum.Value.fromAddress(vaultAddr)])
            .returns([ethereum.Value.fromTuple(initialVaultInfoTuple)]);
        handleRewardPerBlockUpdated(initialEvent);

        const vaultId = vaultAddr.toHex();
        assert.fieldEquals("Vault", vaultId, "rewardPerBlock", initialRewardPerBlock.toString());

        const updateEvent = createRewardPerBlockUpdatedEvent(vaultAddr, updatedRewardPerBlock, BigInt.fromI32(2), "0x77777abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
        const updatedVaultInfoTupleArray: Array<ethereum.Value> = [
            ethereum.Value.fromUnsignedBigInt(updatedRewardPerBlock),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(150)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(250)),
            ethereum.Value.fromUnsignedBigInt(updateEvent.block.timestamp),
            ethereum.Value.fromBoolean(true),
            ethereum.Value.fromBoolean(true),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50)),
            ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(60))
        ];
        const updatedVaultInfoTuple = changetype<ethereum.Tuple>(updatedVaultInfoTupleArray);
        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
            .withArgs([ethereum.Value.fromAddress(vaultAddr)])
            .returns([ethereum.Value.fromTuple(updatedVaultInfoTuple)]);
        handleRewardPerBlockUpdated(updateEvent);

        assert.fieldEquals("Vault", vaultId, "rewardPerBlock", updatedRewardPerBlock.toString());
        assert.fieldEquals("Vault", vaultId, "globalRPW", "150");
        assert.fieldEquals("Vault", vaultId, "totalWeight", "250");
        assert.fieldEquals("Vault", vaultId, "weightByBorrow", "true");
    });

    test("should handle RewardPerBlockUpdated - contract call reverts", () => {
        clearStore();
        const vaultAddr = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
        const rewardPerBlock = BigInt.fromI32(10000);
        const event = createRewardPerBlockUpdatedEvent(vaultAddr, rewardPerBlock);

        createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
            .withArgs([ethereum.Value.fromAddress(vaultAddr)])
            .reverts();

        handleRewardPerBlockUpdated(event); // Should log error and return

        assert.entityCount("Vault", 0); // No vault should be created or updated
    });
});