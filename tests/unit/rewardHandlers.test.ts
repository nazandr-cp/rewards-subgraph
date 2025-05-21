import { clearStore, test, assert } from "matchstick-as/assembly/index";
import { Address, ethereum } from "@graphprotocol/graph-ts";
import { RewardClaimed } from "../../generated/RewardsController/RewardsController";
import { handleRewardClaimed } from "../../src/rewards-controller-mapping";
import { newMockEvent } from "matchstick-as";

function createRewardClaimedEvent(
    user: string,
    rewardToken: string,
    amount: i32,
    rewardType: i32,
    rewardId: string,
    timestamp: i32
): RewardClaimed {
    const mockEvent = newMockEvent();
    const rewardClaimedEvent = new RewardClaimed(
        mockEvent.address,
        mockEvent.logIndex,
        mockEvent.transactionLogIndex,
        mockEvent.logType,
        mockEvent.block,
        mockEvent.transaction,
        mockEvent.parameters,
        mockEvent.receipt
    );

    rewardClaimedEvent.parameters = [];
    const userParam = new ethereum.EventParam("user", ethereum.Value.fromAddress(Address.fromString(user)));
    const rewardTokenParam = new ethereum.EventParam("rewardToken", ethereum.Value.fromAddress(Address.fromString(rewardToken)));
    const amountParam = new ethereum.EventParam("amount", ethereum.Value.fromI32(amount));
    const rewardTypeParam = new ethereum.EventParam("rewardType", ethereum.Value.fromI32(rewardType));
    const rewardIdParam = new ethereum.EventParam("rewardId", ethereum.Value.fromString(rewardId));
    const timestampParam = new ethereum.EventParam("timestamp", ethereum.Value.fromI32(timestamp));

    rewardClaimedEvent.parameters.push(userParam);
    rewardClaimedEvent.parameters.push(rewardTokenParam);
    rewardClaimedEvent.parameters.push(amountParam);
    rewardClaimedEvent.parameters.push(rewardTypeParam);
    rewardClaimedEvent.parameters.push(rewardIdParam);
    rewardClaimedEvent.parameters.push(timestampParam);

    return rewardClaimedEvent;
}

test("handleRewardClaimed - saves a Reward entity", () => {
    const user = "0x0000000000000000000000000000000000000001";
    const rewardToken = "0x0000000000000000000000000000000000000002";
    const amount = 1000;
    const rewardType = 0; // Example type
    const rewardId = "reward1";
    const timestamp = 1672531200; // Example timestamp

    const rewardClaimedEvent = createRewardClaimedEvent(
        user,
        rewardToken,
        amount,
        rewardType,
        rewardId,
        timestamp
    );

    const expectedRewardId = rewardId;

    handleRewardClaimed(rewardClaimedEvent);

    assert.fieldEquals("Reward", expectedRewardId, "user", user);
    assert.fieldEquals("Reward", expectedRewardId, "rewardToken", rewardToken);
    assert.fieldEquals("Reward", expectedRewardId, "amount", "1000");
    assert.fieldEquals("Reward", expectedRewardId, "rewardType", rewardType.toString());
    assert.fieldEquals("Reward", expectedRewardId, "timestamp", timestamp.toString());

    clearStore();
});