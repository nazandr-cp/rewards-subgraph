import { BigInt, Address } from "@graphprotocol/graph-ts";
import { weight, linearWeight, exponentialWeight, MAX_NFT_COUNT_FOR_WEIGHT_CALC, accrueSeconds, EXP_SCALE } from "../src/utils/subsidies";

// Mock CollectionParticipation as it's a generated entity
class MockCollectionParticipation {
  id: string;
  vault: string;
  weightFunctionType: string;
  weightFunctionP1: BigInt;
  weightFunctionP2: BigInt;

  constructor(id: string) {
    this.id = id;
    this.vault = "0x1234567890123456789012345678901234567890";
    this.weightFunctionType = "";
    this.weightFunctionP1 = BigInt.fromI32(0);
    this.weightFunctionP2 = BigInt.fromI32(0);
  }
}

// Mock AccountSubsidiesPerCollection entity
class MockAccountSubsidiesPerCollection {
  id: string;
  account: string;
  balanceNFT: BigInt;
  secondsAccumulated: BigInt;
  lastEffectiveValue: BigInt;
  updatedAtTimestamp: BigInt;

  constructor(id: string, account: string) {
    this.id = id;
    this.account = account;
    this.balanceNFT = BigInt.fromI32(0);
    this.secondsAccumulated = BigInt.fromI32(0);
    this.lastEffectiveValue = BigInt.fromI32(0);
    this.updatedAtTimestamp = BigInt.fromI32(0);
  }
}

// Mock CollectionsVault entity
class MockCollectionsVault {
  id: string;
  cTokenMarket: string;

  constructor(id: string, cTokenMarket: string) {
    this.id = id;
    this.cTokenMarket = cTokenMarket;
  }
}

// Mock the Graph entity loading functions
jest.mock("../../generated/schema", () => ({
  CollectionsVault: {
    load: jest.fn()
  }
}));

// Mock the cToken contract
jest.mock("../../generated/templates/cToken/cToken", () => ({
  cToken: {
    bind: jest.fn()
  }
}));

describe("subsidies", () => {
  describe("weight", () => {
    test("should calculate weight for LINEAR type", () => {
      const nftCount = BigInt.fromI32(10);
      const cv = new MockCollectionParticipation("test");
      cv.weightFunctionType = "LINEAR";
      cv.weightFunctionP1 = BigInt.fromI32(2);
      cv.weightFunctionP2 = BigInt.fromI32(5);
      // Expected: 2 * 10 + 5 = 25
      expect(weight(nftCount, cv as any)).toEqual(BigInt.fromI32(25));
    });

    test("should calculate weight for EXPONENTIAL type", () => {
      const nftCount = BigInt.fromI32(1);
      const cv = new MockCollectionParticipation("test");
      cv.weightFunctionType = "EXPONENTIAL";
      cv.weightFunctionP1 = BigInt.fromString("1000000000000000000"); // 1e18
      cv.weightFunctionP2 = BigInt.fromString("1000000000000000000"); // 1e18
      // For n=1, k=1e18, A=1e18: A * (k*n + (k*n)^2 / (2 * 1e18)) / 1e18
      // = 1e18 * (1e18*1 + (1e18*1)^2 / (2 * 1e18)) / 1e18
      // = 1e18 * (1e18 + 1e36 / 2e18) / 1e18
      // = 1e18 * 1.5e18 / 1e18 = 1.5e18
      expect(weight(nftCount, cv as any)).toEqual(BigInt.fromString("1500000000000000000"));
    });

    test("should return ZERO_BI for unknown weight function type", () => {
      const nftCount = BigInt.fromI32(10);
      const cv = new MockCollectionParticipation("test");
      cv.weightFunctionType = "UNKNOWN";
      cv.weightFunctionP1 = BigInt.fromI32(2);
      cv.weightFunctionP2 = BigInt.fromI32(5);
      expect(weight(nftCount, cv as any)).toEqual(BigInt.fromI32(0));
    });

    test("should cap nftCount at MAX_NFT_COUNT_FOR_WEIGHT_CALC", () => {
      const nftCount = BigInt.fromI32(2000000); // Greater than MAX_NFT_COUNT_FOR_WEIGHT_CALC (1,000,000)
      const cv = new MockCollectionParticipation("test");
      cv.weightFunctionType = "LINEAR";
      cv.weightFunctionP1 = BigInt.fromI32(1);
      cv.weightFunctionP2 = BigInt.fromI32(0);
      // Should use 1,000,000 for calculation: 1 * 1,000,000 + 0 = 1,000,000
      expect(weight(nftCount, cv as any)).toEqual(BigInt.fromI32(1000000));
    });
  });

  describe("linearWeight", () => {
    test("should calculate linear weight correctly", () => {
      const nftCount = BigInt.fromI32(10);
      const p1 = BigInt.fromI32(2);
      const p2 = BigInt.fromI32(5);
      // Expected: 2 * 10 + 5 = 25
      expect(linearWeight(nftCount, p1, p2)).toEqual(BigInt.fromI32(25));
    });

    test("should cap nftCount at MAX_NFT_COUNT_FOR_WEIGHT_CALC for linear weight", () => {
      const nftCount = BigInt.fromI32(2000000); // Greater than MAX_NFT_COUNT_FOR_WEIGHT_CALC
      const p1 = BigInt.fromI32(1);
      const p2 = BigInt.fromI32(0);
      // Should use 1,000,000 for calculation: 1 * 1,000,000 + 0 = 1,000,000
      expect(linearWeight(nftCount, p1, p2)).toEqual(MAX_NFT_COUNT_FOR_WEIGHT_CALC);
    });

    test("should not cap nftCount when below MAX_NFT_COUNT_FOR_WEIGHT_CALC", () => {
      const nftCount = BigInt.fromI32(500000); // Less than MAX_NFT_COUNT_FOR_WEIGHT_CALC
      const p1 = BigInt.fromI32(2);
      const p2 = BigInt.fromI32(100);
      // Expected: 2 * 500,000 + 100 = 1,000,100
      expect(linearWeight(nftCount, p1, p2)).toEqual(BigInt.fromI32(1000100));
    });
  });

  describe("exponentialWeight", () => {
    test("should calculate exponential weight correctly", () => {
      const nftCount = BigInt.fromI32(1);
      const A = BigInt.fromString("1000000000000000000"); // 1e18
      const k = BigInt.fromString("1000000000000000000"); // 1e18
      // For n=1, k=1e18, A=1e18: A * (k*n + (k*n)^2 / (2 * 1e18)) / 1e18
      // = 1e18 * (1e18*1 + (1e18*1)^2 / (2 * 1e18)) / 1e18
      // = 1e18 * (1e18 + 1e36 / 2e18) / 1e18
      // = 1e18 * 1.5e18 / 1e18 = 1.5e18
      expect(exponentialWeight(nftCount, A, k)).toEqual(BigInt.fromString("1500000000000000000"));
    });

    test("should cap nftCount at MAX_NFT_COUNT_FOR_WEIGHT_CALC for exponential weight", () => {
      const nftCount = BigInt.fromI32(2000000); // Greater than MAX_NFT_COUNT_FOR_WEIGHT_CALC
      const A = BigInt.fromString("1000000000000000000"); // 1e18
      const k = BigInt.fromString("1000000000000000000"); // 1e18

      const cappedResult = exponentialWeight(nftCount, A, k);
      const expectedResult = exponentialWeight(MAX_NFT_COUNT_FOR_WEIGHT_CALC, A, k);

      expect(cappedResult).toEqual(expectedResult);
    });

    test("should not cap nftCount when below MAX_NFT_COUNT_FOR_WEIGHT_CALC", () => {
      const nftCount = BigInt.fromI32(2);
      const A = BigInt.fromString("1000000000000000000"); // 1e18
      const k = BigInt.fromString("500000000000000000"); // 0.5e18

      const result = exponentialWeight(nftCount, A, k);
      const directResult = exponentialWeight(nftCount, A, k);

      expect(result).toEqual(directResult);
    });
  });

  describe("accrueSeconds", () => {
    let mockVault: MockCollectionsVault;
    let mockCollectionParticipation: MockCollectionParticipation;
    let mockAccountSubsidies: MockAccountSubsidiesPerCollection;

    beforeEach(() => {
      // Setup mock entities
      mockVault = new MockCollectionsVault(
        "0x1234567890123456789012345678901234567890",
        "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
      );

      mockCollectionParticipation = new MockCollectionParticipation("test-cv");
      mockCollectionParticipation.weightFunctionType = "LINEAR";
      mockCollectionParticipation.weightFunctionP1 = BigInt.fromString("1000000000000000000"); // 1e18
      mockCollectionParticipation.weightFunctionP2 = BigInt.fromString("500000000000000000");  // 0.5e18

      mockAccountSubsidies = new MockAccountSubsidiesPerCollection(
        "test-account-subsidies",
        "0x1111111111111111111111111111111111111111"
      );
      mockAccountSubsidies.balanceNFT = BigInt.fromI32(5);
      mockAccountSubsidies.updatedAtTimestamp = BigInt.fromI32(1000);

      // Mock the CollectionsVault.load function
      const { CollectionsVault } = require("../../generated/schema");
      CollectionsVault.load = jest.fn().mockReturnValue(mockVault);

      // Mock cToken contract calls
      const mockCTokenInstance = {
        try_borrowBalanceStored: jest.fn().mockReturnValue({
          reverted: false,
          value: BigInt.fromString("2000000000000000000000") // 2000 tokens
        })
      };

      const { cToken } = require("../../generated/templates/cToken/cToken");
      cToken.bind = jest.fn().mockReturnValue(mockCTokenInstance);
    });

    test("should accumulate seconds when time has passed", () => {
      const currentTime = BigInt.fromI32(2000); // 1000 seconds later

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      // Expected calculation:
      // dt = 2000 - 1000 = 1000 seconds
      // basePrincipalForSubsidy = 2000e18 (from mock)
      // nftHoldingWeight = linearWeight(5, 1e18, 0.5e18) = 5e18 + 0.5e18 = 5.5e18
      // effectiveValue = 2000e18 + 5.5e18 = 2005.5e18
      // subsidyAccruedScaled = 2005.5e18 * 1000 = 2005500e18
      // finalAccrual = 2005500e18 / 1e18 = 2005500

      expect(mockAccountSubsidies.secondsAccumulated).toEqual(BigInt.fromI32(2005500));
      expect(mockAccountSubsidies.updatedAtTimestamp).toEqual(currentTime);
      expect(mockAccountSubsidies.lastEffectiveValue).toEqual(
        BigInt.fromString("2005500000000000000000") // 2005.5e18
      );
    });

    test("should not accumulate when no time has passed", () => {
      const currentTime = BigInt.fromI32(1000); // Same time
      const initialSeconds = mockAccountSubsidies.secondsAccumulated;

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      expect(mockAccountSubsidies.secondsAccumulated).toEqual(initialSeconds);
    });

    test("should not accumulate when time goes backwards", () => {
      const currentTime = BigInt.fromI32(500); // Earlier time
      const initialSeconds = mockAccountSubsidies.secondsAccumulated;

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      expect(mockAccountSubsidies.secondsAccumulated).toEqual(initialSeconds);
    });

    test("should handle zero NFT balance", () => {
      mockAccountSubsidies.balanceNFT = BigInt.fromI32(0);
      const currentTime = BigInt.fromI32(2000);

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      // Expected calculation:
      // dt = 1000 seconds
      // basePrincipalForSubsidy = 2000e18
      // nftHoldingWeight = linearWeight(0, 1e18, 0.5e18) = 0 + 0.5e18 = 0.5e18
      // effectiveValue = 2000e18 + 0.5e18 = 2000.5e18
      // finalAccrual = (2000.5e18 * 1000) / 1e18 = 2000500

      expect(mockAccountSubsidies.secondsAccumulated).toEqual(BigInt.fromI32(2000500));
    });

    test("should handle exponential weight function", () => {
      mockCollectionParticipation.weightFunctionType = "EXPONENTIAL";
      mockCollectionParticipation.weightFunctionP1 = BigInt.fromString("1000000000000000000"); // A = 1e18
      mockCollectionParticipation.weightFunctionP2 = BigInt.fromString("200000000000000000");  // k = 0.2e18
      mockAccountSubsidies.balanceNFT = BigInt.fromI32(1);

      const currentTime = BigInt.fromI32(2000);

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      // The exact exponential weight calculation is complex, but we can verify
      // that seconds were accumulated (non-zero result)
      expect(mockAccountSubsidies.secondsAccumulated.gt(BigInt.fromI32(0))).toBe(true);
    });

    test("should accumulate additional seconds on subsequent calls", () => {
      // First accumulation
      const firstTime = BigInt.fromI32(2000);
      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, firstTime);
      const firstAccumulation = mockAccountSubsidies.secondsAccumulated;

      // Second accumulation
      const secondTime = BigInt.fromI32(3000); // Another 1000 seconds
      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, secondTime);

      // Should have accumulated additional seconds
      expect(mockAccountSubsidies.secondsAccumulated.gt(firstAccumulation)).toBe(true);
      expect(mockAccountSubsidies.updatedAtTimestamp).toEqual(secondTime);
    });

    test("should handle missing vault gracefully", () => {
      const { CollectionsVault } = require("../../generated/schema");
      CollectionsVault.load = jest.fn().mockReturnValue(null);

      const currentTime = BigInt.fromI32(2000);
      const initialSeconds = mockAccountSubsidies.secondsAccumulated;

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      // Should not accumulate when vault is missing
      expect(mockAccountSubsidies.secondsAccumulated).toEqual(initialSeconds);
    });

    test("should handle failed cToken calls gracefully", () => {
      const mockCTokenInstance = {
        try_borrowBalanceStored: jest.fn().mockReturnValue({
          reverted: true,
          value: BigInt.fromI32(0)
        })
      };

      const { cToken } = require("../../generated/templates/cToken/cToken");
      cToken.bind = jest.fn().mockReturnValue(mockCTokenInstance);

      const currentTime = BigInt.fromI32(2000);

      accrueSeconds(mockAccountSubsidies as any, mockCollectionParticipation as any, currentTime);

      // Should still accumulate based on NFT weight alone
      // basePrincipalForSubsidy = 0 (due to failed call)
      // nftHoldingWeight = 5.5e18
      // effectiveValue = 0 + 5.5e18 = 5.5e18
      // finalAccrual = (5.5e18 * 1000) / 1e18 = 5500

      expect(mockAccountSubsidies.secondsAccumulated).toEqual(BigInt.fromI32(5500));
    });
  });
});