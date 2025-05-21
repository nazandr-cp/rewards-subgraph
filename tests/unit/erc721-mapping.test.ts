import { Address, BigInt, Bytes, ethereum, log } from "@graphprotocol/graph-ts";
import { Transfer } from "../../generated/IERC721/IERC721";
import { handleTransfer } from "../../src/erc721-mapping";
import { Account, AccountCollectionReward, CollectionReward } from "../../generated/schema";
import { getOrCreateAccount, getOrCreateAccountCollectionReward, accrueSeconds, HARDCODED_REWARD_TOKEN_ADDRESS } from "../../src/utils/rewards";
import { clearStore, test, assert, newMockEvent } from "matchstick-as/assembly/index";

// Mocking external functions and entities
jest.mock("../../src/utils/rewards", () => ({
    ...jest.requireActual("../../src/utils/rewards"), // Import and retain default behavior
    getOrCreateAccount: jest.fn(),
    getOrCreateAccountCollectionReward: jest.fn(),
    accrueSeconds: jest.fn(),
}));

jest.mock("@graphprotocol/graph-ts", () => ({
    ...jest.requireActual("@graphprotocol/graph-ts"),
    log: {
        info: jest.fn(),
        warning: jest.fn(),
        error: jest.fn(), // Add other log levels if used
    },
}));

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
    let transferEvent = changetype<Transfer>(newMockEvent());
    transferEvent.address = collection;
    transferEvent.parameters = new Array<ethereum.EventParam>();
    transferEvent.parameters.push(new ethereum.EventParam("from", ethereum.Value.fromAddress(from)));
    transferEvent.parameters.push(new ethereum.EventParam("to", ethereum.Value.fromAddress(to)));
    transferEvent.parameters.push(new ethereum.EventParam("tokenId", ethereum.Value.fromUnsignedBigInt(tokenId)));
    transferEvent.block.timestamp = timestamp;
    transferEvent.block.number = blockNumber;
    return transferEvent;
}

describe("ERC721 - handleTransfer", () => {
    beforeEach(() => {
        clearStore(); // Clears the store before each test
        jest.clearAllMocks(); // Clears all mock function calls
    });

    test("Should process a standard transfer correctly", () => {
        const collectionRewardId = COLLECTION_ADDRESS.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        let collectionReward = new CollectionReward(Bytes.fromHexString(collectionRewardId));
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.save();

        let fromAccount = new Account(FROM_ADDRESS);
        fromAccount.save();
        let toAccount = new Account(TO_ADDRESS);
        toAccount.save();

        let fromAcr = new AccountCollectionReward(FROM_ADDRESS.toHex() + "-" + collectionRewardId);
        fromAcr.account = FROM_ADDRESS.toHex();
        fromAcr.collectionReward = collectionRewardId;
        fromAcr.balanceNFT = BigInt.fromI32(1);
        fromAcr.secondsAccrued = BigInt.fromI32(0);
        fromAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        fromAcr.save();

        let toAcr = new AccountCollectionReward(TO_ADDRESS.toHex() + "-" + collectionRewardId);
        toAcr.account = TO_ADDRESS.toHex();
        toAcr.collectionReward = collectionRewardId;
        toAcr.balanceNFT = BigInt.fromI32(0);
        toAcr.secondsAccrued = BigInt.fromI32(0);
        toAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        toAcr.save();

        (getOrCreateAccount as jest.Mock).mockImplementation((address: Address) => {
            if (address.equals(FROM_ADDRESS)) return fromAccount;
            if (address.equals(TO_ADDRESS)) return toAccount;
            return null;
        });
        (getOrCreateAccountCollectionReward as jest.Mock).mockImplementation((account: Account, cr: CollectionReward, ts: BigInt) => {
            if (account.id.equals(FROM_ADDRESS.toHex())) return fromAcr;
            if (account.id.equals(TO_ADDRESS.toHex())) return toAcr;
            return null;
        });

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 1);
        assert.entityCount("AccountCollectionReward", 2);

        // Check 'from' account
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHex(), "balanceNFT", "0");
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHex(), "lastUpdate", TIMESTAMP.toString());
        expect(accrueSeconds).toHaveBeenCalledWith(fromAcr, collectionReward, TIMESTAMP);

        // Check 'to' account
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHex(), "balanceNFT", "1");
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHex(), "lastUpdate", TIMESTAMP.toString());
        expect(accrueSeconds).toHaveBeenCalledWith(toAcr, collectionReward, TIMESTAMP);

        // Check CollectionReward
        assert.fieldEquals("CollectionReward", collectionRewardId, "lastUpdate", TIMESTAMP.toString());

        expect(log.info).toHaveBeenCalledTimes(1); // Initial log
    });

    test("Should handle mint (from zero address)", () => {
        const collectionRewardId = COLLECTION_ADDRESS.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        let collectionReward = new CollectionReward(Bytes.fromHexString(collectionRewardId));
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.save();

        let toAccount = new Account(TO_ADDRESS);
        toAccount.save();

        let toAcr = new AccountCollectionReward(TO_ADDRESS.toHex() + "-" + collectionRewardId);
        toAcr.account = TO_ADDRESS.toHex();
        toAcr.collectionReward = collectionRewardId;
        toAcr.balanceNFT = BigInt.fromI32(0);
        toAcr.secondsAccrued = BigInt.fromI32(0);
        toAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        toAcr.save();

        (getOrCreateAccount as jest.Mock).mockImplementation((address: Address) => {
            if (address.equals(TO_ADDRESS)) return toAccount;
            return null;
        });
        (getOrCreateAccountCollectionReward as jest.Mock).mockImplementation((account: Account, cr: CollectionReward, ts: BigInt) => {
            if (account.id.equals(TO_ADDRESS.toHex())) return toAcr;
            return null;
        });

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, ZERO_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 1);
        assert.entityCount("AccountCollectionReward", 1); // Only 'to' account's ACR

        // Check 'to' account
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHex(), "balanceNFT", "1");
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHex(), "lastUpdate", TIMESTAMP.toString());
        expect(accrueSeconds).toHaveBeenCalledWith(toAcr, collectionReward, TIMESTAMP);

        // Check CollectionReward
        assert.fieldEquals("CollectionReward", collectionRewardId, "lastUpdate", TIMESTAMP.toString());
        expect(log.info).toHaveBeenCalledTimes(1);
    });

    test("Should handle burn (to zero address)", () => {
        const collectionRewardId = COLLECTION_ADDRESS.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        let collectionReward = new CollectionReward(Bytes.fromHexString(collectionRewardId));
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.save();

        let fromAccount = new Account(FROM_ADDRESS);
        fromAccount.save();

        let fromAcr = new AccountCollectionReward(FROM_ADDRESS.toHex() + "-" + collectionRewardId);
        fromAcr.account = FROM_ADDRESS.toHex();
        fromAcr.collectionReward = collectionRewardId;
        fromAcr.balanceNFT = BigInt.fromI32(1);
        fromAcr.secondsAccrued = BigInt.fromI32(0);
        fromAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        fromAcr.save();

        (getOrCreateAccount as jest.Mock).mockImplementation((address: Address) => {
            if (address.equals(FROM_ADDRESS)) return fromAccount;
            return null;
        });
        (getOrCreateAccountCollectionReward as jest.Mock).mockImplementation((account: Account, cr: CollectionReward, ts: BigInt) => {
            if (account.id.equals(FROM_ADDRESS.toHex())) return fromAcr;
            return null;
        });

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, ZERO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 1);
        assert.entityCount("AccountCollectionReward", 1); // Only 'from' account's ACR

        // Check 'from' account
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHex(), "balanceNFT", "0");
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHex(), "lastUpdate", TIMESTAMP.toString());
        expect(accrueSeconds).toHaveBeenCalledWith(fromAcr, collectionReward, TIMESTAMP);

        // Check CollectionReward
        assert.fieldEquals("CollectionReward", collectionRewardId, "lastUpdate", TIMESTAMP.toString());
        expect(log.info).toHaveBeenCalledTimes(1);
    });

    test("Should skip if CollectionReward entity does not exist", () => {
        // No CollectionReward saved to the store

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        assert.entityCount("CollectionReward", 0);
        assert.entityCount("AccountCollectionReward", 0);
        expect(log.info).toHaveBeenCalledTimes(2); // Initial log + "CollectionReward not found"
        expect(log.info).toHaveBeenLastCalledWith(
            "handleTransfer (IERC721): CollectionReward not found for collection {} and reward token {}. Skipping reward accrual for this transfer.",
            [COLLECTION_ADDRESS.toHexString(), HARDCODED_REWARD_TOKEN_ADDRESS.toHexString()]
        );
        expect(accrueSeconds).not.toHaveBeenCalled();
    });

    test("Should handle negative balance gracefully for 'from' account (and log warning)", () => {
        const collectionRewardId = COLLECTION_ADDRESS.toHex() + "-" + HARDCODED_REWARD_TOKEN_ADDRESS.toHex();
        let collectionReward = new CollectionReward(Bytes.fromHexString(collectionRewardId));
        collectionReward.rewardToken = HARDCODED_REWARD_TOKEN_ADDRESS;
        collectionReward.collection = COLLECTION_ADDRESS;
        collectionReward.rewardPerSecond = BigInt.fromI32(10);
        collectionReward.totalSecondsAccrued = BigInt.fromI32(0);
        collectionReward.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        collectionReward.save();

        let fromAccount = new Account(FROM_ADDRESS);
        fromAccount.save();
        let toAccount = new Account(TO_ADDRESS); // 'to' account setup is minimal as focus is on 'from'
        toAccount.save();


        let fromAcr = new AccountCollectionReward(FROM_ADDRESS.toHex() + "-" + collectionRewardId);
        fromAcr.account = FROM_ADDRESS.toHex();
        fromAcr.collectionReward = collectionRewardId;
        fromAcr.balanceNFT = BigInt.fromI32(0); // Start with 0 to force negative if logic was flawed
        fromAcr.secondsAccrued = BigInt.fromI32(0);
        fromAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        fromAcr.save();

        let toAcr = new AccountCollectionReward(TO_ADDRESS.toHex() + "-" + collectionRewardId); // Basic 'to' ACR
        toAcr.account = TO_ADDRESS.toHex();
        toAcr.collectionReward = collectionRewardId;
        toAcr.balanceNFT = BigInt.fromI32(0);
        toAcr.secondsAccrued = BigInt.fromI32(0);
        toAcr.lastUpdate = TIMESTAMP.minus(BigInt.fromI32(100));
        toAcr.save();


        (getOrCreateAccount as jest.Mock).mockImplementation((address: Address) => {
            if (address.equals(FROM_ADDRESS)) return fromAccount;
            if (address.equals(TO_ADDRESS)) return toAccount;
            return null;
        });
        (getOrCreateAccountCollectionReward as jest.Mock).mockImplementation((account: Account, cr: CollectionReward, ts: BigInt) => {
            if (account.id.equals(FROM_ADDRESS.toHex())) return fromAcr;
            if (account.id.equals(TO_ADDRESS.toHex())) return toAcr;
            return null;
        });

        const transferEvent = createTransferEvent(COLLECTION_ADDRESS, FROM_ADDRESS, TO_ADDRESS, TOKEN_ID, TIMESTAMP);
        handleTransfer(transferEvent);

        // 'from' account's balanceNFT should be 0, not negative
        assert.fieldEquals("AccountCollectionReward", fromAcr.id.toHex(), "balanceNFT", "0");
        expect(log.warning).toHaveBeenCalledWith(
            "NFT balance for account {} in collection {} went negative.",
            [FROM_ADDRESS.toHexString(), COLLECTION_ADDRESS.toHexString()]
        );

        // 'to' account should still be processed
        assert.fieldEquals("AccountCollectionReward", toAcr.id.toHex(), "balanceNFT", "1");
    });
});