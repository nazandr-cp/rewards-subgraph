// rewards-subgraph/tests/__mocks__/@graphprotocol/graph-ts.ts

// This mock provides a basic implementation of BigInt for Jest tests.
// It wraps JavaScript's native bigint for arithmetic operations.

export class BigInt {
  private _value: bigint;

  constructor(value: string | number | boolean | bigint) {
    if (typeof value === 'string') {
      this._value = global.BigInt(value);
    } else if (typeof value === 'number') {
      this._value = global.BigInt(value);
    } else if (typeof value === 'boolean') {
      this._value = global.BigInt(value);
    } else {
      this._value = value;
    }
  }

  static fromI32(value: number): BigInt {
    return new BigInt(value);
  }

  static fromU64(value: number): BigInt {
    return new BigInt(value);
  }

  static fromString(value: string): BigInt {
    return new BigInt(value);
  }

  valueOf(): bigint {
    return this._value;
  }

  plus(other: BigInt): BigInt {
    return new BigInt(this._value + other.valueOf());
  }

  minus(other: BigInt): BigInt {
    return new BigInt(this._value - other.valueOf());
  }

  times(other: BigInt): BigInt {
    return new BigInt(this._value * other.valueOf());
  }

  div(other: BigInt): BigInt {
    if (other.valueOf() === 0n) {
      throw new Error("Division by zero");
    }
    return new BigInt(this._value / other.valueOf());
  }

  mod(other: BigInt): BigInt {
    if (other.valueOf() === 0n) {
      throw new Error("Modulo by zero");
    }
    return new BigInt(this._value % other.valueOf());
  }

  equals(other: BigInt): boolean {
    return this._value === other.valueOf();
  }

  toString(): string {
    return this._value.toString();
  }

  lt(other: BigInt): boolean {
    return this._value < other.valueOf();
  }

  le(other: BigInt): boolean {
    return this._value <= other.valueOf();
  }

  gt(other: BigInt): boolean {
    return this._value > other.valueOf();
  }

  ge(other: BigInt): boolean {
    return this._value >= other.valueOf();
  }
}