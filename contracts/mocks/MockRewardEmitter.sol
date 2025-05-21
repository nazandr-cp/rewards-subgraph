pragma solidity ^0.8.0;

contract MockRewardEmitter {
    event RewardPaid(
        address indexed user,
        address indexed rewardToken,
        uint256 amount,
        uint256 rewardType,
        string rewardId,
        uint256 timestamp
    );

    function emitRewardPaid(
        address user,
        address rewardToken,
        uint256 amount,
        uint256 rewardType,
        string memory rewardId
    ) public {
        emit RewardPaid(user, rewardToken, amount, rewardType, rewardId, block.timestamp);
    }
}
