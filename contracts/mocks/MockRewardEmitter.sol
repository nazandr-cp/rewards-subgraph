pragma solidity ^0.8.0;

contract MockRewardEmitter {
    // Structs
    struct WeightFunction {
        uint8 fnType;
        int256 p1;
        int256 p2;
    }

    // --- cToken Events ---
    event AccrueInterest(uint256 cashPrior, uint256 interestAccumulated, uint256 borrowIndex, uint256 totalBorrows);
    event Borrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows);
    event LiquidateBorrow(
        address liquidator, address borrower, uint256 repayAmount, address cTokenCollateral, uint256 seizeTokens
    );
    event Mint(address minter, uint256 mintAmount, uint256 mintTokens);
    event Redeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens);
    event RepayBorrow(
        address payer, address borrower, uint256 repayAmount, uint256 accountBorrows, uint256 totalBorrows
    );
    event TransferCToken(address indexed from, address indexed to, uint256 amount);

    // --- CollectionVault Events ---
    event CollectionDeposit(
        address indexed cToken, address indexed collection, address indexed user, uint256 amount, uint256 nfts
    );
    event CollectionWithdraw(
        address indexed cToken,
        address collection,
        address indexed user,
        address indexed recipient,
        uint256 amount,
        uint256 nfts
    );

    // --- RewardsController Events ---
    event NewCollectionWhitelisted(
        address indexed collection, uint8 collectionType, uint8 rewardBasis, uint16 sharePercentage
    );
    event WhitelistCollectionRemoved(address indexed collection);
    event CollectionRewardShareUpdated(
        address indexed collection, uint16 oldSharePercentage, uint16 newSharePercentage
    );
    event WeightFunctionSet(address indexed collection, WeightFunction fn);
    event RewardsClaimedForLazy(
        address indexed account,
        address indexed collection,
        uint256 dueAmount,
        uint256 nonce,
        uint256 secondsUser,
        uint256 secondsColl,
        uint256 incRPS,
        uint256 yieldSlice
    );
    event BatchRewardsClaimedForLazy(address indexed caller, uint256 totalDue, uint256 numClaims);
    event RewardPerBlockUpdated(address indexed vault, uint128 rewardPerBlock);
    event RewardClaimed(address vault, address indexed user, uint256 amount);

    // --- ERC1155 Events ---
    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 value);
    event TransferBatch(
        address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] values
    );

    // --- ERC721 Events ---
    event TransferERC721(address indexed from, address indexed to, uint256 indexed tokenId);

    // --- cToken Emitters ---
    function emitAccrueInterest(
        uint256 cashPrior,
        uint256 interestAccumulated,
        uint256 borrowIndex,
        uint256 totalBorrows_
    ) public {
        emit AccrueInterest(cashPrior, interestAccumulated, borrowIndex, totalBorrows_);
    }

    function emitBorrow(address borrower, uint256 borrowAmount, uint256 accountBorrows, uint256 totalBorrows_) public {
        emit Borrow(borrower, borrowAmount, accountBorrows, totalBorrows_);
    }

    function emitLiquidateBorrow(
        address liquidator,
        address borrower,
        uint256 repayAmount,
        address cTokenCollateral,
        uint256 seizeTokens
    ) public {
        emit LiquidateBorrow(liquidator, borrower, repayAmount, cTokenCollateral, seizeTokens);
    }

    function emitMint(address minter, uint256 mintAmount, uint256 mintTokens) public {
        emit Mint(minter, mintAmount, mintTokens);
    }

    function emitRedeem(address redeemer, uint256 redeemAmount, uint256 redeemTokens) public {
        emit Redeem(redeemer, redeemAmount, redeemTokens);
    }

    function emitRepayBorrow(
        address payer,
        address borrower,
        uint256 repayAmount,
        uint256 accountBorrows,
        uint256 totalBorrows_
    ) public {
        emit RepayBorrow(payer, borrower, repayAmount, accountBorrows, totalBorrows_);
    }

    function emitTransferCToken(address from, address to, uint256 amount) public {
        emit TransferCToken(from, to, amount);
    }

    // --- CollectionVault Emitters ---
    function emitCollectionDeposit(address cToken, address collection, address user, uint256 amount, uint256 nfts)
        public
    {
        emit CollectionDeposit(cToken, collection, user, amount, nfts);
    }

    function emitCollectionWithdraw(
        address cToken,
        address collection,
        address user,
        address recipient,
        uint256 amount,
        uint256 nfts
    ) public {
        emit CollectionWithdraw(cToken, collection, user, recipient, amount, nfts);
    }

    // --- RewardsController Emitters ---
    function emitNewCollectionWhitelisted(
        address collection,
        uint8 collectionType,
        uint8 rewardBasis,
        uint16 sharePercentage
    ) public {
        emit NewCollectionWhitelisted(collection, collectionType, rewardBasis, sharePercentage);
    }

    function emitWhitelistCollectionRemoved(address collection) public {
        emit WhitelistCollectionRemoved(collection);
    }

    function emitCollectionRewardShareUpdated(address collection, uint16 oldSharePercentage, uint16 newSharePercentage)
        public
    {
        emit CollectionRewardShareUpdated(collection, oldSharePercentage, newSharePercentage);
    }

    function emitWeightFunctionSet(address collection, WeightFunction memory fn) public {
        emit WeightFunctionSet(collection, fn);
    }

    function emitRewardsClaimedForLazy(
        address account,
        address collection,
        uint256 dueAmount,
        uint256 nonce,
        uint256 secondsUser,
        uint256 secondsColl,
        uint256 incRPS,
        uint256 yieldSlice
    ) public {
        emit RewardsClaimedForLazy(account, collection, dueAmount, nonce, secondsUser, secondsColl, incRPS, yieldSlice);
    }

    function emitBatchRewardsClaimedForLazy(address caller, uint256 totalDue, uint256 numClaims) public {
        emit BatchRewardsClaimedForLazy(caller, totalDue, numClaims);
    }

    function emitRewardPerBlockUpdated(address vault, uint128 rewardPerBlock) public {
        emit RewardPerBlockUpdated(vault, rewardPerBlock);
    }

    function emitRewardClaimed(address vault, address user, uint256 amount) public {
        emit RewardClaimed(vault, user, amount);
    }

    // --- ERC1155 Emitters ---
    function emitTransferSingle(address operator, address from, address to, uint256 id, uint256 value) public {
        emit TransferSingle(operator, from, to, id, value);
    }

    function emitTransferBatch(
        address operator,
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) public {
        emit TransferBatch(operator, from, to, ids, values);
    }

    // --- ERC721 Emitters ---
    function emitTransferERC721(address from, address to, uint256 tokenId) public {
        emit TransferERC721(from, to, tokenId);
    }
}
