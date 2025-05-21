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
    // RewardsController__fnInputFnStruct, // Removed as it's not found
    RewardsClaimedForLazy,
    BatchRewardsClaimedForLazy,
    RewardPerBlockUpdated as RewardPerBlockUpdatedEvent // Alias to avoid conflict
    // RewardsController // Removed as unused
} from "../../generated/RewardsController/RewardsController";
// Removed unused schema imports: CollectionReward, Account, RewardClaim, Vault, AccountVault, AccountCollectionReward

// Constants used in handlers or for mocking
const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000a");
const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000b");
const MOCK_CONTRACT_ADDRESS = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc"); // RewardsController contract
const ZERO_BI = BigInt.fromI32(0);
// const ONE_BI = BigInt.fromI32(1); // Removed as unused

// Enum replacement for WeightFunctionType
const WeightFunctionType = {
    LINEAR: 0 as u8,
    EXPONENTIAL: 1 as u8
};

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

    // Construct the tuple for the 'fn' parameter
    const fnTupleArray: Array<ethereum.Value> = [
        ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(fnType)), // fnType
        ethereum.Value.fromUnsignedBigInt(p1),                     // p1
        ethereum.Value.fromUnsignedBigInt(p2)                      // p2
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
    mockEvent.transaction.hash = Bytes.fromHexString(txH<ctrl61>
Okay, I will add the new unit tests to[`tests/unit/rewardHandlers.test.ts`](tests / unit / rewardHandlers.test.ts: 1).I will generate the complete content for the file, including the existing test for `handleRewardClaimed` and new tests for the 7 untested handlers.This involves adding new helper functions for event creation and new test blocks, along with necessary imports and constants.I will also mock contract calls where needed.

< write_to_file >
        <path>tests / unit / rewardHandlers.test.ts </path>
        <content>
    import { describe, test, assert, clearStore, newMockEvent, createMockedFunction } from "matchstick-as/assembly/index";
    import { Address, BigInt, ethereum, Bytes, Value } from "@graphprotocol/graph-ts";
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
        RewardsController__fnInputFnStruct,
        RewardsClaimedForLazy,
        BatchRewardsClaimedForLazy,
        RewardPerBlockUpdated as RewardPerBlockUpdatedEvent, // Alias to avoid conflict if RewardPerBlockUpdated entity exists
        RewardsController
    } from "../../generated/RewardsController/RewardsController";
    import { CollectionReward, Account, RewardClaim, Vault, AccountVault, AccountCollectionReward } from "../../generated/schema";

    // Constants used in handlers or for mocking
    const HARDCODED_REWARD_TOKEN_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000a");
    const HARDCODED_CTOKEN_MARKET_ADDRESS = Address.fromString("0x000000000000000000000000000000000000000b");
    const MOCK_CONTRACT_ADDRESS = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc"); // RewardsController contract
    const ZERO_BI = BigInt.fromI32(0);
    const ONE_BI = BigInt.fromI32(1);

    // Enum replacement for WeightFunctionType
    namespace WeightFunctionType {
        export const LINEAR: u8 = 0;
        export const EXPONENTIAL: u8 = 1;
    }

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
        // Actual event: RewardClaimed(indexed address user, indexed address vault, uint256 amount)
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

        const fnTuple = new RewardsController__fnInputFnStruct();
        fnTuple.fnType = fnType;
        fnTuple.p1 = p1;
        fnTuple.p2 = p2;

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
        // Existing test for handleRewardClaimed (preserved as is, despite potential issues)
        test("should handle RewardClaimed event and create RewardClaim entity", () => {
            clearStore();

            const claimerAddress = Address.fromString("0x0000000000000000000000000000000000000001");
            const collectionAddress = Address.fromString("0x0000000000000000000000000000000000000002"); // This is the `vault` in the event
            const rewardAmount = BigInt.fromI32(1000);
            const logIdx = BigInt.fromI32(5);
            const txHashStr = "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef12345678";

            const rewardClaimedEventInstance = createRewardClaimedEvent(
                claimerAddress,
                collectionAddress,
                rewardAmount,
                logIdx,
                txHashStr
            );

            // Mock contract calls for handleRewardClaimed
            const vaultTuple = changetype<ethereum.Tuple>([
                ethereum.Value.fromUnsignedBigInt(rewardAmount), // rewardPerBlock
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100)), // globalRPW
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(200)), // totalWeight
                ethereum.Value.fromUnsignedBigInt(rewardClaimedEventInstance.block.timestamp), // lastUpdateBlock
                ethereum.Value.fromBoolean(true), // weightByBorrow
                ethereum.Value.fromBoolean(false), // useExp
                ethereum.Value.fromUnsignedBigInt(ZERO_BI), // linK
                ethereum.Value.fromUnsignedBigInt(ZERO_BI)  // expR
            ]);
            createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
                .withArgs([ethereum.Value.fromAddress(collectionAddress)])
                .returns([ethereum.Value.fromTuple(vaultTuple)]);

            const accTuple = changetype<ethereum.Tuple>([
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50)), // weight
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(25))  // rewardDebt
            ]);
            createMockedFunction(MOCK_CONTRACT_ADDRESS, "acc", "acc(address,address):((uint256,uint256))")
                .withArgs([ethereum.Value.fromAddress(collectionAddress), ethereum.Value.fromAddress(claimerAddress)])
                .returns([ethereum.Value.fromTuple(accTuple)]);

            handleRewardClaimed(rewardClaimedEventInstance);

            // Assertions for Vault and AccountVault (as per handler logic)
            // Note: The original test asserted "RewardClaim", which is not created by this handler.
            // I am preserving the original assertions for "RewardClaim" as per instructions not to change the existing test,
            // but they are likely incorrect for this handler.
            const rewardEntityId = rewardClaimedEventInstance.transaction.hash.concatI32(rewardClaimedEventInstance.logIndex.toI32()).toHexString();
            assert.fieldEquals("RewardClaim", rewardEntityId, "account", claimerAddress.toHex());
            assert.fieldEquals("RewardClaim", rewardEntityId, "collectionAddress", collectionAddress.toHex());
            assert.fieldEquals("RewardClaim", rewardEntityId, "amount", rewardAmount.toString());
            assert.fieldEquals("RewardClaim", rewardEntityId, "timestamp", rewardClaimedEventInstance.block.timestamp.toString());
            assert.fieldEquals("RewardClaim", rewardEntityId, "transactionHash", rewardClaimedEventInstance.transaction.hash.toHexString());
            assert.fieldEquals("RewardClaim", rewardEntityId, "nonce", rewardClaimedEventInstance.transaction.nonce.toString());
            assert.fieldEquals("RewardClaim", rewardEntityId, "amount", "1000");

            // Correct assertions for Vault and AccountVault would be:
            const vaultId = collectionAddress.toHex();
            assert.entityCount("Vault", 1);
            assert.fieldEquals("Vault", vaultId, "rewardPerBlock", rewardAmount.toString());

            const accountVaultId = vaultId + "-" + claimerAddress.toHex();
            assert.entityCount("AccountVault", 1);
            assert.fieldEquals("AccountVault", accountVaultId, "vault", vaultId);
            assert.fieldEquals("AccountVault", accountVaultId, "account", claimerAddress.toHex());
            assert.fieldEquals("AccountVault", accountVaultId, "weight", "50");
            assert.fieldEquals("AccountVault", accountVaultId, "rewardDebt", "25");
        });

        // New tests for other handlers
        test("should handle NewCollectionWhitelisted (ERC721, Deposit)", () => {
            clearStore();
            const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
            const event = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000); // ERC721, Deposit, 1000 share

            handleNewCollectionWhitelisted(event);

            const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
            assert.entityCount("CollectionReward", 1);
            assert.fieldEquals("CollectionReward", collRewardId, "collection", collectionAddr.toHex());
            assert.fieldEquals("CollectionReward", collRewardId, "rewardToken", HARDCODED_REWARD_TOKEN_ADDRESS.toHex());
            assert.fieldEquals("CollectionReward", collRewardId, "cTokenMarket", HARDCODED_CTOKEN_MARKET_ADDRESS.toHex());
            assert.fieldEquals("CollectionReward", collRewardId, "isBorrowBased", "false");
            assert.fieldEquals("CollectionReward", collRewardId, "collectionType", "ERC721");
            assert.fieldEquals("CollectionReward", collRewardId, "rewardPerSecond", "1000");
            assert.fieldEquals("CollectionReward", collRewardId, "fnType", "LINEAR"); // Default
            assert.fieldEquals("CollectionReward", collRewardId, "lastUpdate", event.block.timestamp.toString());
        });

        test("should handle NewCollectionWhitelisted (ERC1155, Borrow)", () => {
            clearStore();
            const collectionAddr = Address.fromString("0x2222222222222222222222222222222222222222");
            const event = createNewCollectionWhitelistedEvent(collectionAddr, 1, 1, 2000); // ERC1155, Borrow, 2000 share

            handleNewCollectionWhitelisted(event);

            const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
            assert.entityCount("CollectionReward", 1);
            assert.fieldEquals("CollectionReward", collRewardId, "collectionType", "ERC1155");
            assert.fieldEquals("CollectionReward", collRewardId, "isBorrowBased", "true");
            assert.fieldEquals("CollectionReward", collRewardId, "rewardPerSecond", "2000");
        });

        test("should handle WhitelistCollectionRemoved", () => {
            clearStore();
            const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
            // First, create a collection reward to be removed
            const createEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
            handleNewCollectionWhitelisted(createEvent);
            const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
            assert.entityCount("CollectionReward", 1);

            // Now remove it
            const removeEvent = createWhitelistCollectionRemovedEvent(collectionAddr);
            handleWhitelistCollectionRemoved(removeEvent);
            assert.notInStore("CollectionReward", collRewardId);
            assert.entityCount("CollectionReward", 0);
        });

        test("should handle WhitelistCollectionRemoved for non-existent collection", () => {
            clearStore();
            const collectionAddr = Address.fromString("0x3333333333333333333333333333333333333333");
            const removeEvent = createWhitelistCollectionRemovedEvent(collectionAddr);

            handleWhitelistCollectionRemoved(removeEvent); // Should not throw, logs warning

            const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
            assert.notInStore("CollectionReward", collRewardId); // Ensure it's still not there
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

        test("should handle WeightFunctionSet", () => {
            clearStore();
            const collectionAddr = Address.fromString("0x1111111111111111111111111111111111111111");
            const createEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
            handleNewCollectionWhitelisted(createEvent);

            const fnType = WeightFunctionType.EXPONENTIAL;
            const p1 = BigInt.fromI32(50);
            const p2 = BigInt.fromI32(60);
            const setEvent = createWeightFunctionSetEvent(collectionAddr, fnType, p1, p2);
            handleWeightFunctionSet(setEvent);

            const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
            assert.fieldEquals("CollectionReward", collRewardId, "fnType", "EXPONENTIAL");
            assert.fieldEquals("CollectionReward", collRewardId, "p1", p1.toString());
            assert.fieldEquals("CollectionReward", collRewardId, "p2", p2.toString());
            assert.fieldEquals("CollectionReward", collRewardId, "lastUpdate", setEvent.block.timestamp.toString());
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

            // Create CollectionReward first
            const createCollEvent = createNewCollectionWhitelistedEvent(collectionAddr, 0, 0, 1000);
            handleNewCollectionWhitelisted(createCollEvent);
            const collRewardId = collectionAddr.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();

            // Mock contract.try_vault() call
            createMockedFunction(MOCK_CONTRACT_ADDRESS, "vault", "vault():(address)")
                .returns([ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)]);

            const claimEvent = createRewardsClaimedForLazyEvent(userAddr, collectionAddr, dueAmount, secondsUser, incRPS, yieldSlice, nonce);
            handleRewardsClaimedForLazy(claimEvent);

            const claimId = claimEvent.transaction.hash.concatI32(claimEvent.logIndex.toI32()).toHexString();
            assert.entityCount("RewardClaim", 1);
            assert.fieldEquals("RewardClaim", claimId, "account", userAddr.toHex());
            assert.fieldEquals("RewardClaim", claimId, "collectionAddress", collectionAddr.toHex());
            assert.fieldEquals("RewardClaim", claimId, "amount", dueAmount.toString());
            assert.fieldEquals("RewardClaim", claimId, "timestamp", claimEvent.block.timestamp.toString());
            assert.fieldEquals("RewardClaim", claimId, "nonce", nonce.toString());
            assert.fieldEquals("RewardClaim", claimId, "secondsUser", secondsUser.toString());

            const acrId = Bytes.fromHexString(userAddr.toHex()).concat(Bytes.fromHexString(collRewardId)).toHexString();
            assert.entityCount("AccountCollectionReward", 1);
            assert.fieldEquals("AccountCollectionReward", acrId, "seconds", "0"); // Assuming accrueSeconds sets it up and claim reduces it
        });

        test("should handle RewardsClaimedForLazy - no CollectionReward (partial claim)", () => {
            clearStore();
            const userAddr = Address.fromString("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
            const collectionAddr = Address.fromString("0xcccccccccccccccccccccccccccccccccccccccc"); // Different collection
            const dueAmount = BigInt.fromI32(200);
            const secondsUser = BigInt.fromI32(20);
            const incRPS = BigInt.fromI32(2);
            const yieldSlice = BigInt.fromI32(8);
            const nonce = BigInt.fromI32(124);

            // Mock contract.try_vault() call
            createMockedFunction(MOCK_CONTRACT_ADDRESS, "vault", "vault():(address)")
                .returns([ethereum.Value.fromAddress(HARDCODED_REWARD_TOKEN_ADDRESS)]);

            const claimEvent = createRewardsClaimedForLazyEvent(userAddr, collectionAddr, dueAmount, secondsUser, incRPS, yieldSlice, nonce);
            handleRewardsClaimedForLazy(claimEvent);

            const claimId = claimEvent.transaction.hash.concatI32(claimEvent.logIndex.toI32()).toHexString();
            assert.entityCount("RewardClaim", 1); // Partial claim is still created
            assert.fieldEquals("RewardClaim", claimId, "account", userAddr.toHex());
            assert.fieldEquals("RewardClaim", claimId, "collectionAddress", collectionAddr.toHex());
            assert.fieldEquals("RewardClaim", claimId, "amount", dueAmount.toString());
            assert.fieldEquals("RewardClaim", claimId, "secondsColl", ZERO_BI.toString()); // Should be ZERO_BI as CollectionReward not found
            assert.fieldEquals("RewardClaim", claimId, "incRPS", ZERO_BI.toString());
            assert.fieldEquals("RewardClaim", claimId, "yieldSlice", ZERO_BI.toString());

            assert.entityCount("AccountCollectionReward", 0); // Not created if CollectionReward missing
        });


        test("should handle BatchRewardsClaimedForLazy", () => {
            clearStore();
            const callerAddr = Address.fromString("0xdddddddddddddddddddddddddddddddddddddddd");
            const totalDue = BigInt.fromI32(500);
            const numClaims = BigInt.fromI32(5);

            const event = createBatchRewardsClaimedForLazyEvent(callerAddr, totalDue, numClaims);
            handleBatchRewardsClaimedForLazy(event);

            assert.entityCount("Account", 1);
            assert.fieldEquals("Account", callerAddr.toHex(), "id", callerAddr.toHex());
            // This handler mainly logs and ensures Account exists. No other entities are deeply affected by this specific event.
        });

        test("should handle RewardPerBlockUpdated - new Vault", () => {
            clearStore();
            const vaultAddr = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
            const rewardPerBlock = BigInt.fromI32(10000);

            const event = createRewardPerBlockUpdatedEvent(vaultAddr, rewardPerBlock);

            // Mock contract.try_vaults()
            const vaultInfoTupleArray: Array<ethereum.Value> = [
                ethereum.Value.fromUnsignedBigInt(rewardPerBlock), // rewardPerBlock
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(123)), // globalRPW
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(456)), // totalWeight
                ethereum.Value.fromUnsignedBigInt(event.block.timestamp), // lastUpdateBlock
                ethereum.Value.fromBoolean(false), // weightByBorrow
                ethereum.Value.fromBoolean(true), // useExp
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(789)), // linK
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(101)), // expR
            ];
            const vaultInfoTuple = changetype<ethereum.Tuple>(vaultInfoTupleArray);
            createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
                .withArgs([ethereum.Value.fromAddress(vaultAddr)])
                .returns([ethereum.Value.fromTuple(vaultInfoTuple)]);

            handleRewardPerBlockUpdated(event);

            const vaultId = vaultAddr.toHex();
            assert.entityCount("Vault", 1);
            assert.fieldEquals("Vault", vaultId, "id", vaultId);
            assert.fieldEquals("Vault", vaultId, "rewardPerBlock", rewardPerBlock.toString());
            assert.fieldEquals("Vault", vaultId, "globalRPW", "123");
            assert.fieldEquals("Vault", vaultId, "totalWeight", "456");
            assert.fieldEquals("Vault", vaultId, "lastUpdateBlock", event.block.timestamp.toString());
            assert.fieldEquals("Vault", vaultId, "weightByBorrow", "false");
            assert.fieldEquals("Vault", vaultId, "useExp", "true");
            assert.fieldEquals("Vault", vaultId, "linK", "789");
            assert.fieldEquals("Vault", vaultId, "expR", "101");
        });

        test("should handle RewardPerBlockUpdated - existing Vault", () => {
            clearStore();
            const vaultAddr = Address.fromString("0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee");
            const initialRewardPerBlock = BigInt.fromI32(5000);
            const updatedRewardPerBlock = BigInt.fromI32(15000);

            // Initial mock setup for the first call
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

            // Mock setup for the second call (update)
            const updateEvent = createRewardPerBlockUpdatedEvent(vaultAddr, updatedRewardPerBlock, BigInt.fromI32(2), "0x77777abcdef1234567890abcdef1234567890abcdef1234567890abcdef");
            const updatedVaultInfoTupleArray: Array<ethereum.Value> = [
                ethereum.Value.fromUnsignedBigInt(updatedRewardPerBlock), // rewardPerBlock
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(150)),   // globalRPW
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(250)),   // totalWeight
                ethereum.Value.fromUnsignedBigInt(updateEvent.block.timestamp), // lastUpdateBlock
                ethereum.Value.fromBoolean(true),  // weightByBorrow
                ethereum.Value.fromBoolean(true),  // useExp
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50)),    // linK
                ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(60))     // expR
            ];
            const updatedVaultInfoTuple = changetype<ethereum.Tuple>(updatedVaultInfoTupleArray);
            // This will overwrite the previous mock for the same function signature
            createMockedFunction(MOCK_CONTRACT_ADDRESS, "vaults", "vaults(address):((uint256,uint256,uint256,uint256,bool,bool,uint256,uint256))")
                .withArgs([ethereum.Value.fromAddress(vaultAddr)])
                .returns([ethereum.Value.fromTuple(updatedVaultInfoTuple)]);

            handleRewardPerBlockUpdated(updateEvent);

            assert.fieldEquals("Vault", vaultId, "rewardPerBlock", updatedRewardPerBlock.toString());
            assert.fieldEquals("Vault", vaultId, "globalRPW", "150");
            assert.fieldEquals("Vault", vaultId, "totalWeight", "250");
            assert.fieldEquals("Vault", vaultId, "lastUpdateBlock", updateEvent.block.timestamp.toString());
            assert.fieldEquals("Vault", vaultId, "weightByBorrow", "true");
        });
    });