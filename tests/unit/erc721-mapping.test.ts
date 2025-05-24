import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/templates/ERC721/ERC721";
import { handleTransfer } from "../../src/erc721-mapping";
import { Account, AccountCollectionReward, CollectionReward } from "../../generated/schema";
import { HARDCODED_REWARD_TOKEN_ADDRESS, generateCollectionRewardId, generateAccountCollectionRewardId } from "../../src/utils/rewards";
import { clearStore, test, assert, newMockEvent, describe, beforeEach, afterEach, mockFunction } from "matchstick-as/assembly/index";
import { cToken } from "../../generated/cToken/cToken";

const COLLECTION_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000001");
const FROM_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000002");
const TO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000003");
const ZERO_ADDRESS = Address.fromString("0x0000000000000000000000000000000000000000");
const TOKEN_ID = BigInt.fromI32(1);
const TIMESTAMP = BigInt.fromI32(1000);

function createTransferEvent(
    collection: Address,
    from: Address,
    to: Address,
    tokenId: BigInt,
    timestamp: BigInt,
    blockNumber: BigInt = BigInt.fromI32(1)
): Transfer {
    const mockEvent = newMockEvent(); // Get a basic mock event with dummy block and transaction

    const transferEvent = new Transfer(
        collection, // address
        mockEvent.logIndex, // Use logIndex from mockEvent
        mockEvent.transactionLogIndex, // Use transactionLogIndex from mockEvent
        mockEvent.logType, // Use logType from mockEvent
        mockEvent.block, // Use block from mockEvent
        mockEvent.transaction, // Use transaction from mockEvent
        [], // parameters (will be populated)
        mockEvent.receipt // Use receipt from mockEvent
    );

    transferEvent.address = collection; // Set address
    transferEvent.parameters = new Array<ethereum.EventParam>();
    transferEvent.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
    transferEvent.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
    transferEvent.parameters.push(new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(tokenId)));

    // Set block properties (override mockEvent's block properties)
    transferEvent.block.timestamp = timestamp;
    transferEvent.block.number = blockNumber;
    return transferEvent;
}

describe("ERC721 - handleTransfer", () => {
    beforeEach(() => {
        clearStore();
    });

    afterEach(() => {
        // No explicit restore needed for mockFunction with module paths
    });

    test("Should process a standard transfer correctly", () => {
        const collectionRewardId = generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS);
        // log.info("Generated CollectionReward ID: {}", [collectionRewardId.toHexString()]);
        const collectionReward = new CollectionReward(collectionRewardId);
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.totalRewardsPool = BigInt.fromI32(1000);
        collectionReward.fnType = "LINEAR";
        collectionReward.p1 = BigInt.fromI32(1);
        collectionReward.p2 = BigInt.fromI32(1);
        collectionReward.cTokenMarketAddress = ZERO_ADDRESS;
        collectionReward.isBorrowBased = false;
        collectionReward.collectionType = "ERC721";
        log.info("CollectionReward before save: id={}, rewardToken={}, collection={}, rewardPerSecond={}, totalSecondsAccrued={}, lastUpdate={}, totalRewardsPool={}, fnType={}, p1={}, p2={}, cTokenMarketAddress={}, isBorrowBased={}, collectionType={}", [
            collectionReward.id.toHexString(),
            collectionReward.rewardToken.toHexString(),
            collectionReward.collection.toHexString(),
            collectionReward.rewardPerSecond.toString(),
            collectionReward.totalSecondsAccrued.toString(),
            collectionReward.lastUpdate.toString(),
            collectionReward.totalRewardsPool.toString(),
            collectionReward.fnType,
            collectionReward.p1.toString(),
            collectionReward.p2.toString(),
            collectionReward.cTokenMarketAddress.toHexString(),
            collectionReward.isBorrowBased.toString(),
            collectionReward.collectionType
        ]);
        collectionReward.save();

        const fromAccount = new Account(FROM_ADDRESS.toHexString());
        // log.info("Generated From Account ID: {}", [fromAccount.id]);
        fromAccount.save();
        const toAccount = new Account(TO_ADDRESS.toHexString());
        // log.info("Generated To Account ID: {}", [toAccount.id]);
        toAccount.save();

        const fromAcrId = generateAccountCollectionRewardId(fromAccount.id, collectionReward.id);
        // log.info("Generated From ACR ID: {}", [fromAcrId.toHexString()]);
        const fromAcr = new AccountCollectionReward(fromAcrId);
        fromAcr.account = FROM_ADDRESS.toHexString(); // Changed
        fromAcr.collection = collectionRewardId;
        fromAcr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        fromAcr.balanceNFT = BigInt.fromI32(1);
        fromAcr.seconds = BigInt.fromI32(0);
        fromAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        fromAcr.save();

        const toAcrId = generateAccountCollectionRewardId(toAccount.id, collectionReward.id);
        // log.info("Generated To ACR ID: {}", [toAcrId.toHexString()]);
        const toAcr = new AccountCollectionReward(toAcrId);
        toAcr.account = TO_ADDRESS.toHexString(); // Changed
        toAcr.collection = collectionRewardId;
        toAcr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        toAcr.balanceNFT = BigInt.fromI32(0);
        toAcr.seconds = BigInt.fromI32(0);
        toAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        toAcr.save();


        // Mock cToken.try_balanceOf for ZERO_ADDRESS
        mockFunction(
            ZERO_ADDRESS,
            "balanceOf",
            "balanceOf(address):(uint256)",
            [ethereum.Value.fromAddress(FROM_ADDRESS)],
            [ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(100))], // Mock a balance
            true // success
        );
        mockFunction(
            ZERO_ADDRESS,
            "balanceOf",
            "balanceOf(address):(uint256)",
            [ethereum.Value.fromAddress(TO_ADDRESS)],
            [ethereum.Value.fromUnsignedBigInt(BigInt.fromI32(50))], // Mock a balance
            true // success
        );

        // Mock cToken.try_exchangeRateStored for ZERO_ADDRESS
        mockFunction(
            ZERO_ADDRESS,
            "exchangeRateStored",
            "exchangeRateStored():(uint256)",
            [],
            [ethereum.Value.fromUnsignedBigInt(BigInt.fromString("1000000000000000000"))], // Mock exchange rate
            true // success
        );

        // Mock getOrCreateAccount for FROM_ADDRESS
        mockFunction(
            ZERO_ADDRESS, // Contract address for module mock workaround
            "getOrCreateAccount",
            "getOrCreateAccount(bytes):(string)", // Account ID is string
            [ethereum.Value.fromBytes(Bytes.fromHexString(FROM_ADDRESS.toHexString()))],
            [ethereum.Value.fromString(fromAccount.id)],
            false
        );
        // Mock getOrCreateAccount for TO_ADDRESS
        mockFunction(
            ZERO_ADDRESS, // Contract address for module mock workaround
            "getOrCreateAccount",
            "getOrCreateAccount(bytes):(string)",
            [ethereum.Value.fromBytes(Bytes.fromHexString(TO_ADDRESS.toHexString()))],
            [ethereum.Value.fromString(toAccount.id)],
            false
        );

        // Mock getOrCreateAccountCollectionReward for fromAccount
        mockFunction(
            ZERO_ADDRESS, // Contract address for module mock workaround
            "getOrCreateAccountCollectionReward",
            "getOrCreateAccountCollectionReward(string,bytes,uint256):(bytes)", // IDs are Bytes, BigInt is uint256
            [
                ethereum.Value.fromString(fromAccount.id), // account.id is string
                ethereum.Value.fromBytes(collectionReward.id), // cr.id is Bytes
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromBytes(fromAcr.id)], // ACR ID is Bytes
            false
        );
        // Mock getOrCreateAccountCollectionReward for toAccount
        mockFunction(
            ZERO_ADDRESS, // Contract address for module mock workaround
            "getOrCreateAccountCollectionReward",
            "getOrCreateAccountCollectionReward(string,bytes,uint256):(bytes)",
            [
                ethereum.Value.fromString(toAccount.id), // account.id is string
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromBytes(toAcr.id)],
            false
        );

        // Mock accrueSeconds for fromAcr
        mockFunction(
            ZERO_ADDRESS, // Contract address for module mock workaround
            "accrueSeconds",
            "accrueSeconds(bytes,bytes,uint256):()", // Void return
            [
                ethereum.Value.fromBytes(fromAcr.id),
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromI32(0)], // Placeholder for void return
            false
        );
        // Mock accrueSeconds for toAcr
        mockFunction(
            ZERO_ADDRESS, // Contract address for module mock workaround
            "accrueSeconds",
            "accrueSeconds(bytes,bytes,uint256):()",
            [
                ethereum.Value.fromBytes(toAcr.id),
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromI32(0)], // Placeholder for void return
            false
        );

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 1);
        assert.entityCount("AccountCollectionReward", 2);

        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHexString(), "balanceNFT", "0");
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHexString(), "lastUpdate", TIMESTAMP.toString());

        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHexString(), "balanceNFT", "1");
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHexString(), "lastUpdate", TIMESTAMP.toString());

        assert.fieldEquals("CollectionReward", collectionRewardId.toHexString(), "lastUpdate", TIMESTAMP.toString());
    });

    test("Should handle mint (from zero address)", () => {
        const collectionRewardId = generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS);
        const collectionReward = new CollectionReward(collectionRewardId);
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.totalRewardsPool = BigInt.fromI32(1000);
        collectionReward.fnType = "LINEAR";
        collectionReward.p1 = BigInt.fromI32(1);
        collectionReward.p2 = BigInt.fromI32(1);
        collectionReward.cTokenMarketAddress = ZERO_ADDRESS;
        collectionReward.isBorrowBased = false;
        collectionReward.collectionType = "ERC721";
        log.info("CollectionReward before save: id={}, rewardToken={}, collection={}, rewardPerSecond={}, totalSecondsAccrued={}, lastUpdate={}, totalRewardsPool={}, fnType={}, p1={}, p2={}, cTokenMarketAddress={}, isBorrowBased={}, collectionType={}", [
            collectionReward.id.toHexString(),
            collectionReward.rewardToken.toHexString(),
            collectionReward.collection.toHexString(),
            collectionReward.rewardPerSecond.toString(),
            collectionReward.totalSecondsAccrued.toString(),
            collectionReward.lastUpdate.toString(),
            collectionReward.totalRewardsPool.toString(),
            collectionReward.fnType,
            collectionReward.p1.toString(),
            collectionReward.p2.toString(),
            collectionReward.cTokenMarketAddress.toHexString(),
            collectionReward.isBorrowBased.toString(),
            collectionReward.collectionType
        ]);
        collectionReward.save();

        const toAccount = new Account(TO_ADDRESS.toHexString());
        toAccount.save();
        assert.entityCount("Account", 1);
        assert.fieldEquals("Account", toAccount.id, "id", TO_ADDRESS.toHexString());

        const toAcrId = generateAccountCollectionRewardId(toAccount.id, collectionReward.id);
        const toAcr = new AccountCollectionReward(toAcrId);
        toAcr.account = TO_ADDRESS.toHexString(); // Changed
        toAcr.collection = collectionRewardId;
        toAcr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        toAcr.balanceNFT = BigInt.fromI32(0);
        toAcr.seconds = BigInt.fromI32(0);
        toAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        toAcr.save();

        // Mock getOrCreateAccount for TO_ADDRESS
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccount",
            "getOrCreateAccount(bytes):(string)",
            [ethereum.Value.fromBytes(Bytes.fromHexString(TO_ADDRESS.toHexString()))],
            [ethereum.Value.fromString(toAccount.id)],
            false
        );
        // Note: If getOrCreateAccount is called with ZERO_ADDRESS in this test, it needs a mock too.
        // e.g. mockFunction("../../src/utils/rewards", "getOrCreateAccount", "getOrCreateAccount(address):(bytes)", [ethereum.Value.fromAddress(ZERO_ADDRESS)], ethereum.Value.fromBytes(Bytes.fromHexString(ZERO_ADDRESS.toHex())), false);


        // Mock getOrCreateAccountCollectionReward for toAccount
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccountCollectionReward",
            "getOrCreateAccountCollectionReward(string,bytes,uint256):(bytes)",
            [
                ethereum.Value.fromString(toAccount.id), // account.id is string
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromBytes(toAcr.id)],
            false
        );

        // Mock accrueSeconds for toAcr
        mockFunction(
            ZERO_ADDRESS,
            "accrueSeconds",
            "accrueSeconds(bytes,bytes,uint256):()",
            [
                ethereum.Value.fromBytes(toAcr.id),
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromI32(0)], // Placeholder for void return
            false
        );

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, ZERO_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 1);
        assert.entityCount("AccountCollectionReward", 1);

        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHexString(), "balanceNFT", "1");
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHexString(), "lastUpdate", TIMESTAMP.toString());

        assert.fieldEquals("CollectionReward", collectionRewardId.toHexString(), "lastUpdate", TIMESTAMP.toString());
    });

    test("Should handle burn (to zero address)", () => {
        const collectionRewardId = generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS);
        const collectionReward = new CollectionReward(collectionRewardId);
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.totalRewardsPool = BigInt.fromI32(1000);
        collectionReward.fnType = "LINEAR";
        collectionReward.p1 = BigInt.fromI32(1);
        collectionReward.p2 = BigInt.fromI32(1);
        collectionReward.cTokenMarketAddress = ZERO_ADDRESS;
        collectionReward.isBorrowBased = false;
        collectionReward.collectionType = "ERC721";
        log.info("CollectionReward before save: id={}, rewardToken={}, collection={}, rewardPerSecond={}, totalSecondsAccrued={}, lastUpdate={}, totalRewardsPool={}, fnType={}, p1={}, p2={}, cTokenMarketAddress={}, isBorrowBased={}, collectionType={}", [
            collectionReward.id.toHexString(),
            collectionReward.rewardToken.toHexString(),
            collectionReward.collection.toHexString(),
            collectionReward.rewardPerSecond.toString(),
            collectionReward.totalSecondsAccrued.toString(),
            collectionReward.lastUpdate.toString(),
            collectionReward.totalRewardsPool.toString(),
            collectionReward.fnType,
            collectionReward.p1.toString(),
            collectionReward.p2.toString(),
            collectionReward.cTokenMarketAddress.toHexString(),
            collectionReward.isBorrowBased.toString(),
            collectionReward.collectionType
        ]);
        collectionReward.save();

        const fromAccount = new Account(FROM_ADDRESS.toHexString());
        fromAccount.save();
        assert.entityCount("Account", 1);
        assert.fieldEquals("Account", fromAccount.id, "id", FROM_ADDRESS.toHexString());

        const fromAcrId = generateAccountCollectionRewardId(fromAccount.id, collectionReward.id);
        const fromAcr = new AccountCollectionReward(fromAcrId);
        fromAcr.account = FROM_ADDRESS.toHexString(); // Changed
        fromAcr.collection = collectionRewardId;
        fromAcr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        fromAcr.balanceNFT = BigInt.fromI32(1);
        fromAcr.seconds = BigInt.fromI32(0);
        fromAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        fromAcr.save();

        // Mock getOrCreateAccount for FROM_ADDRESS
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccount",
            "getOrCreateAccount(bytes):(string)",
            [ethereum.Value.fromBytes(Bytes.fromHexString(FROM_ADDRESS.toHexString()))],
            [ethereum.Value.fromString(fromAccount.id)],
            false
        );
        // Note: If getOrCreateAccount is called with ZERO_ADDRESS in this test, it needs a mock too.

        // Mock getOrCreateAccountCollectionReward for fromAccount
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccountCollectionReward",
            "getOrCreateAccountCollectionReward(string,bytes,uint256):(bytes)",
            [
                ethereum.Value.fromString(fromAccount.id), // account.id is string
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromBytes(fromAcr.id)],
            false
        );

        // Mock accrueSeconds for fromAcr
        mockFunction(
            ZERO_ADDRESS,
            "accrueSeconds",
            "accrueSeconds(bytes,bytes,uint256):()",
            [
                ethereum.Value.fromBytes(fromAcr.id),
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromI32(0)], // Placeholder for void return
            false
        );

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, ZERO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 1);
        assert.entityCount("AccountCollectionReward", 1);

        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHexString(), "balanceNFT", "0");
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHexString(), "lastUpdate", TIMESTAMP.toString());

        assert.fieldEquals("CollectionReward", collectionRewardId.toHexString(), "lastUpdate", TIMESTAMP.toString());
    });

    test("Should skip if CollectionReward entity does not exist", () => {
        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 0);
        assert.entityCount("AccountCollectionReward", 0);
    });

    test("Should handle negative balance gracefully for 'from' account (and log warning)", () => {
        const collectionRewardId = generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS);
        const collectionReward = new CollectionReward(collectionRewardId);
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.totalRewardsPool = BigInt.fromI32(1000);
        collectionReward.fnType = "LINEAR";
        collectionReward.p1 = BigInt.fromI32(1);
        collectionReward.p2 = BigInt.fromI32(1);
        collectionReward.cTokenMarketAddress = ZERO_ADDRESS;
        collectionReward.isBorrowBased = false;
        collectionReward.collectionType = "ERC721";
        log.info("CollectionReward before save: id={}, rewardToken={}, collection={}, rewardPerSecond={}, totalSecondsAccrued={}, lastUpdate={}, totalRewardsPool={}, fnType={}, p1={}, p2={}, cTokenMarketAddress={}, isBorrowBased={}, collectionType={}", [
            collectionReward.id.toHexString(),
            collectionReward.rewardToken.toHexString(),
            collectionReward.collection.toHexString(),
            collectionReward.rewardPerSecond.toString(),
            collectionReward.totalSecondsAccrued.toString(),
            collectionReward.lastUpdate.toString(),
            collectionReward.totalRewardsPool.toString(),
            collectionReward.fnType,
            collectionReward.p1.toString(),
            collectionReward.p2.toString(),
            collectionReward.cTokenMarketAddress.toHexString(),
            collectionReward.isBorrowBased.toString(),
            collectionReward.collectionType
        ]);
        collectionReward.save();

        const fromAccount = new Account(FROM_ADDRESS.toHexString());
        fromAccount.save();
        assert.entityCount("Account", 1);
        assert.fieldEquals("Account", fromAccount.id, "id", FROM_ADDRESS.toHexString());

        const toAccount = new Account(TO_ADDRESS.toHexString());
        toAccount.save();
        assert.entityCount("Account", 2);
        assert.fieldEquals("Account", toAccount.id, "id", TO_ADDRESS.toHexString());

        const fromAcrId = generateAccountCollectionRewardId(fromAccount.id, collectionReward.id);
        const fromAcr = new AccountCollectionReward(fromAcrId);
        fromAcr.account = FROM_ADDRESS.toHexString(); // Changed
        fromAcr.collection = collectionRewardId;
        fromAcr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        fromAcr.balanceNFT = BigInt.fromI32(0);
        fromAcr.seconds = BigInt.fromI32(0);
        fromAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        fromAcr.save();

        const toAcrId = generateAccountCollectionRewardId(toAccount.id, collectionReward.id);
        const toAcr = new AccountCollectionReward(toAcrId);
        toAcr.account = TO_ADDRESS.toHexString(); // Changed
        toAcr.collection = collectionRewardId;
        toAcr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        toAcr.balanceNFT = BigInt.fromI32(0);
        toAcr.seconds = BigInt.fromI32(0);
        toAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        toAcr.save();

        // Mock getOrCreateAccount for FROM_ADDRESS
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccount",
            "getOrCreateAccount(bytes):(string)",
            [ethereum.Value.fromBytes(Bytes.fromHexString(FROM_ADDRESS.toHexString()))],
            [ethereum.Value.fromString(fromAccount.id)],
            false
        );
        // Mock getOrCreateAccount for TO_ADDRESS
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccount",
            "getOrCreateAccount(bytes):(string)",
            [ethereum.Value.fromBytes(Bytes.fromHexString(TO_ADDRESS.toHexString()))],
            [ethereum.Value.fromString(toAccount.id)],
            false
        );

        // Mock getOrCreateAccountCollectionReward for fromAccount
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccountCollectionReward",
            "getOrCreateAccountCollectionReward(string,bytes,uint256):(bytes)",
            [
                ethereum.Value.fromString(fromAccount.id), // account.id is string
                ethereum.Value.fromBytes(collectionReward.id), // cr.id is Bytes
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromBytes(fromAcr.id)], // ACR ID is Bytes
            false
        );
        // Mock getOrCreateAccountCollectionReward for toAccount
        mockFunction(
            ZERO_ADDRESS,
            "getOrCreateAccountCollectionReward",
            "getOrCreateAccountCollectionReward(string,bytes,uint256):(bytes)",
            [
                ethereum.Value.fromString(toAccount.id), // account.id is string
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromBytes(toAcr.id)],
            false
        );

        // Mock accrueSeconds for fromAcr
        mockFunction(
            ZERO_ADDRESS,
            "accrueSeconds",
            "accrueSeconds(bytes,bytes,uint256):()",
            [
                ethereum.Value.fromBytes(fromAcr.id),
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromI32(0)], // Placeholder for void return
            false
        );
        // Mock accrueSeconds for toAcr
        mockFunction(
            ZERO_ADDRESS,
            "accrueSeconds",
            "accrueSeconds(bytes,bytes,uint256):()",
            [
                ethereum.Value.fromBytes(toAcr.id),
                ethereum.Value.fromBytes(collectionReward.id),
                ethereum.Value.fromUnsignedBigInt(TIMESTAMP)
            ],
            [ethereum.Value.fromI32(0)], // Placeholder for void return
            false
        );

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHexString(), "balanceNFT", "0");
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHexString(), "balanceNFT", "1");
    });
});