import { BigInt } from "@graphprotocol/graph-ts";
import { weight } from "../src/utils/weight";

// Mock CollectionParticipation as it's a generated entity
class MockCollectionParticipation {
  id: string;
  weightFunctionType: string;
  weightFunctionP1: BigInt;
  weightFunctionP2: BigInt;

  constructor(id: string) {
    this.id = id;
    this.weightFunctionType = "";
    this.weightFunctionP1 = BigInt.fromI32(0);
    this.weightFunctionP2 = BigInt.fromI32(0);
  }
}

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
});