import { clearStore, test, assert, newMockEvent } from "matchstick-as/assembly/index";
import { Address, BigInt, ethereum } from "@graphprotocol/graph-ts";
// AccountCollectionReward is used for type assertions with assert.fieldEquals
import { CollectionReward } from "../../generated/schema"; // Account and AccountCollectionReward removed as direct import if not used for instantiation
import { handleTransferSingle, handleTransferBatch } from "../../src/erc1155-mapping";
import { TransferSingle, TransferBatch } from "../../generated/templates/ERC1155/ERC1155";
import { ADDRESS_ZERO_STR, HARDCODED_REWARD_TOKEN_ADDRESS, generateCollectionRewardId, generateAccountCollectionRewardId } from "../../src/utils/rewards";

// Mock constants
const COLLECTION_ADDRESS_STR = "0x1234567890123456789012345678901234567890";
const USER1_ADDRESS_STR = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const USER2_ADDRESS_STR = "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TOKEN_ID1 = BigInt.fromI32(1);
const TOKEN_ID2 = BigInt.fromI32(2);
const VALUE1 = BigInt.fromI32(10);
const VALUE2 = BigInt.fromI32(5);
const TIMESTAMP = BigInt.fromI32(1000);
const BLOCK_NUMBER = BigInt.fromI32(1);
const LOG_INDEX = BigInt.fromI32(0);

const COLLECTION_ADDRESS = Address.fromString(COLLECTION_ADDRESS_STR);
const USER1_ADDRESS = Address.fromString(USER1_ADDRESS_STR);
const USER2_ADDRESS = Address.fromString(USER2_ADDRESS_STR);
const ADDRESS_ZERO = Address.fromString(ADDRESS_ZERO_STR);

function createTransferSingleEvent(
    operator: Address,
    from: Address,
    to: Address,
    id: BigInt,
    value: BigInt
): TransferSingle {
    const event = changetype<TransferSingle>(newMockEvent());
    event.address = COLLECTION_ADDRESS;
    event.block.timestamp = TIMESTAMP;
    event.block.number = BLOCK_NUMBER;
    event.logIndex = LOG_INDEX;
    event.parameters = new Array<ethereum.EventParam>();
    event.parameters.push(
        new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
    );
    event.parameters.push(
        new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
    );
    event.parameters.push(
        new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
    );
    event.parameters.push(
        new ethereum.EventParam("id", ethereum.Value.fromUnsignedBigInt(id))
    );
    event.parameters.push(
        new ethereum.EventParam("value", ethereum.Value.fromUnsignedBigInt(value))
    );
    return event;
}

function createTransferBatchEvent(
    operator: Address,
    from: Address,
    to: Address,
    ids: BigInt[],
    values: BigInt[]
): TransferBatch {
    const event = changetype<TransferBatch>(newMockEvent());
    event.address = COLLECTION_ADDRESS;
    event.block.timestamp = TIMESTAMP;
    event.block.number = BLOCK_NUMBER;
    event.logIndex = LOG_INDEX;
    event.parameters = new Array<ethereum.EventParam>();
    event.parameters.push(
        new ethereum.EventParam("operator", ethereum.Value.fromAddress(operator))
    );
    event.parameters.push(
        new ethereum.EventParam("from", ethereum.Value.fromAddress(from))
    );
    event.parameters.push(
        new ethereum.EventParam("to", ethereum.Value.fromAddress(to))
    );
    event.parameters.push(
        new ethereum.EventParam("ids", ethereum.Value.fromUnsignedBigIntArray(ids))
    );
    event.parameters.push(
        new ethereum.EventParam("values", ethereum.Value.fromUnsignedBigIntArray(values))
    );
    return event;
}

function createMockCollectionReward(): CollectionReward {
    const collectionRewardId = generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS);
    const cr = new CollectionReward(collectionRewardId);
    cr.collection = COLLECTION_ADDRESS;
    cr.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
    cr.rewardPerSecond = BigInt.fromI32(10);
    cr.totalSecondsAccrued = BigInt.fromI32(0);
    cr.lastUpdate = BigInt.fromI32(1000);
    cr.totalRewardsPool = BigInt.fromI32(1000);
    cr.fnType = "LINEAR";
    cr.p1 = BigInt.fromI32(1);
    cr.p2 = BigInt.fromI32(1);
    cr.cTokenMarketAddress = Address.fromString("0x0000000000000000000000000000000000000000");
    cr.isBorrowBased = false;
    cr.collectionType = "ERC1155";
    cr.save();
    return cr;
}

test("handleTransferSingle - Mint new token", () => {
    clearStore();
    const cr = createMockCollectionReward();
    const event = createTransferSingleEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, TOKEN_ID1, VALUE1);
    handleTransferSingle(event);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", VALUE1.toString());
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "lastUpdate", TIMESTAMP.toString());

    assert.fieldEquals("CollectionReward", cr.id.toHexString(), "lastUpdate", TIMESTAMP.toString());
});

test("handleTransferSingle - Burn token", () => {
    clearStore();
    const cr = createMockCollectionReward();

    // Initial mint to User1
    const mintEvent = createTransferSingleEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, TOKEN_ID1, VALUE1);
    handleTransferSingle(mintEvent);

    // Burn from User1
    const burnEvent = createTransferSingleEvent(USER1_ADDRESS, USER1_ADDRESS, ADDRESS_ZERO, TOKEN_ID1, VALUE1);
    handleTransferSingle(burnEvent);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", "0");
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "lastUpdate", TIMESTAMP.toString());
});

test("handleTransferSingle - Regular transfer", () => {
    clearStore();
    const cr = createMockCollectionReward();

    // Initial mint to User1
    const mintEvent = createTransferSingleEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, TOKEN_ID1, VALUE1);
    handleTransferSingle(mintEvent);

    // Transfer from User1 to User2
    const transferEvent = createTransferSingleEvent(USER1_ADDRESS, USER1_ADDRESS, USER2_ADDRESS, TOKEN_ID1, VALUE1);
    handleTransferSingle(transferEvent);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", "0");

    const user2AcrId = generateAccountCollectionRewardId(USER2_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.fieldEquals("AccountCollectionReward", user2AcrId.toHexString(), "balanceNFT", VALUE1.toString());
});

test("handleTransferSingle - CollectionReward does not exist", () => {
    clearStore(); // No CollectionReward created
    const event = createTransferSingleEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, TOKEN_ID1, VALUE1);
    handleTransferSingle(event);

    // No AccountCollectionReward should be created
    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.notInStore("AccountCollectionReward", user1AcrId.toHexString());
});


test("handleTransferBatch - Mint new tokens", () => {
    clearStore();
    const cr = createMockCollectionReward();
    const ids = [TOKEN_ID1, TOKEN_ID2];
    const values = [VALUE1, VALUE2];
    const event = createTransferBatchEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, ids, values);
    handleTransferBatch(event);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    const expectedBalance = VALUE1.plus(VALUE2);
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", expectedBalance.toString());
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "lastUpdate", TIMESTAMP.toString());

    assert.fieldEquals("CollectionReward", cr.id.toHexString(), "lastUpdate", TIMESTAMP.toString());
});

test("handleTransferBatch - Burn tokens", () => {
    clearStore();
    const cr = createMockCollectionReward();

    // Initial mint to User1
    const mintIds = [TOKEN_ID1, TOKEN_ID2];
    const mintValues = [VALUE1, VALUE2];
    const mintEvent = createTransferBatchEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, mintIds, mintValues);
    handleTransferBatch(mintEvent);

    // Burn from User1
    const burnEvent = createTransferBatchEvent(USER1_ADDRESS, USER1_ADDRESS, ADDRESS_ZERO, mintIds, mintValues);
    handleTransferBatch(burnEvent);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", "0");
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "lastUpdate", TIMESTAMP.toString());
});

test("handleTransferBatch - Regular transfer", () => {
    clearStore();
    const cr = createMockCollectionReward();

    // Initial mint to User1
    const mintIds = [TOKEN_ID1, TOKEN_ID2];
    const mintValues = [VALUE1, VALUE2];
    const mintEvent = createTransferBatchEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, mintIds, mintValues);
    handleTransferBatch(mintEvent);

    // Transfer from User1 to User2
    const transferEvent = createTransferBatchEvent(USER1_ADDRESS, USER1_ADDRESS, USER2_ADDRESS, mintIds, mintValues);
    handleTransferBatch(transferEvent);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", "0");

    const user2AcrId = generateAccountCollectionRewardId(USER2_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    const expectedBalance = VALUE1.plus(VALUE2);
    assert.fieldEquals("AccountCollectionReward", user2AcrId.toHexString(), "balanceNFT", expectedBalance.toString());
});

test("handleTransferBatch - CollectionReward does not exist", () => {
    clearStore(); // No CollectionReward created
    const ids = [TOKEN_ID1];
    const values = [VALUE1];
    const event = createTransferBatchEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, ids, values);
    handleTransferBatch(event);

    // No AccountCollectionReward should be created
    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, generateCollectionRewardId(COLLECTION_ADDRESS, HARDCODED_REWARD_TOKEN_ADDRESS));
    assert.notInStore("AccountCollectionReward", user1AcrId.toHexString());
});

test("handleTransferSingle - Balance goes negative (should be zero)", () => {
    clearStore();
    const cr = createMockCollectionReward();

    // Mint 10 to User1
    const mintEvent = createTransferSingleEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, TOKEN_ID1, VALUE1); // VALUE1 is 10
    handleTransferSingle(mintEvent);

    // Attempt to burn 20 from User1 (more than balance)
    const burnValue = BigInt.fromI32(20);
    const burnEvent = createTransferSingleEvent(USER1_ADDRESS, USER1_ADDRESS, ADDRESS_ZERO, TOKEN_ID1, burnValue);
    handleTransferSingle(burnEvent);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, cr.id);
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", "0"); // Should be reset to 0
});

test("handleTransferBatch - Balance goes negative (should be zero)", () => {
    clearStore();
    const cr = createMockCollectionReward();

    // Mint [10, 5] to User1
    const mintIds = [TOKEN_ID1, TOKEN_ID2];
    const mintValues = [VALUE1, VALUE2]; // VALUE1=10, VALUE2=5. Total = 15
    const mintEvent = createTransferBatchEvent(USER1_ADDRESS, ADDRESS_ZERO, USER1_ADDRESS, mintIds, mintValues);
    handleTransferBatch(mintEvent);

    // Attempt to burn [20, 5] from User1 (more than balance for TOKEN_ID1)
    const burnValues = [BigInt.fromI32(20), VALUE2]; // Total attempt to burn 25
    const burnEvent = createTransferBatchEvent(USER1_ADDRESS, USER1_ADDRESS, ADDRESS_ZERO, mintIds, burnValues);
    handleTransferBatch(burnEvent);

    const user1AcrId = generateAccountCollectionRewardId(USER1_ADDRESS_STR, cr.id);
    // The logic sums up all values in the batch for balanceNFT.
    // Initial balance: 10 + 5 = 15
    // Values to subtract: 20 + 5 = 25
    // Resulting balance: 15 - 25 = -10. Should be corrected to 0.
    assert.fieldEquals("AccountCollectionReward", user1AcrId.toHexString(), "balanceNFT", "0");
});