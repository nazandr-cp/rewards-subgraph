import { BigInt, Address, log } from "@graphprotocol/graph-ts";
import { cToken as CTokenContract } from "../../generated/templates/cToken/cToken";

// Simple cache for cToken validation results
// Note: AssemblyScript Map limitations require string keys
class CTokenValidationCache {
  private static validTokens: Map<string, boolean> = new Map<string, boolean>();
  private static invalidTokens: Set<string> = new Set<string>();
  
  // Check if address is a validated cToken
  static isValidCToken(address: Address): boolean {
    const addressStr = address.toHexString();
    
    // Check cache first
    if (this.invalidTokens.has(addressStr)) {
      return false;
    }
    
    if (this.validTokens.has(addressStr)) {
      return this.validTokens.get(addressStr);
    }
    
    // Perform validation and cache result
    const isValid = this.validateCToken(address);
    
    if (isValid) {
      this.validTokens.set(addressStr, true);
    } else {
      this.invalidTokens.add(addressStr);
    }
    
    return isValid;
  }

  // Validation function for cToken contracts
  private static validateCToken(address: Address): boolean {
    const cTokenContract = CTokenContract.bind(address);

    // Check for multiple cToken-specific methods
    const exchangeRateTry = cTokenContract.try_exchangeRateStored();
    const borrowRateTry = cTokenContract.try_borrowRatePerBlock();
    const supplyRateTry = cTokenContract.try_supplyRatePerBlock();
    const totalBorrowsTry = cTokenContract.try_totalBorrows();

    if (exchangeRateTry.reverted || borrowRateTry.reverted ||
      supplyRateTry.reverted || totalBorrowsTry.reverted) {
      return false;
    }

    // Check symbol follows cToken convention
    const symbolTry = cTokenContract.try_symbol();
    if (symbolTry.reverted || !symbolTry.value.startsWith("c")) {
      return false;
    }

    // Check exchange rate is reasonable (not zero)
    if (exchangeRateTry.value.equals(BigInt.fromI32(0))) {
      return false;
    }

    return true;
  }

  // Cache contract properties for commonly accessed values
  static getCachedExchangeRate(address: Address): BigInt | null {
    if (!this.isValidCToken(address)) {
      return null;
    }

    const cTokenContract = CTokenContract.bind(address);
    const exchangeRateTry = cTokenContract.try_exchangeRateStored();
    
    if (!exchangeRateTry.reverted) {
      return exchangeRateTry.value;
    }
    
    return null;
  }

  // Get cache statistics for monitoring
  static getCacheStats(): string {
    return `Valid: ${this.validTokens.size}, Invalid: ${this.invalidTokens.size}`;
  }
}

export { CTokenValidationCache };