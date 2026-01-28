import {
  assertIs,
  assertOrUndefined,
  assertEachIs,
  assertRange,
  assertRangeOrUndefined,
  assertMultiple,
  assertInteger,
  assertPositive,
  assertIsOneOf,
  assertIsOneOfOrUndefined,
  assertIsSubset,
  backtick,
  singleQuote,
  createValueErrorMsg,
  createTypeErrorMsg,
  getType,
  isType,
} from '../../src/utils';

// ---------------------------------------------------------------------------
// Helper utilities: backtick, singleQuote
// ---------------------------------------------------------------------------

describe('backtick', () => {
  it('wraps a value in backticks', () => {
    expect(backtick('foo')).toBe('`foo`');
    expect(backtick(42)).toBe('`42`');
  });
});

describe('singleQuote', () => {
  it('wraps a value in single quotes', () => {
    expect(singleQuote('bar')).toBe("'bar'");
    expect(singleQuote(7)).toBe("'7'");
  });
});

// ---------------------------------------------------------------------------
// getType
// ---------------------------------------------------------------------------

describe('getType', () => {
  it('returns "null" for null', () => {
    expect(getType(null)).toBe('null');
  });

  it('returns "undefined" for undefined', () => {
    expect(getType(undefined)).toBe('undefined');
  });

  it('returns "string" for strings', () => {
    expect(getType('')).toBe('string');
    expect(getType('hello')).toBe('string');
  });

  it('returns "number" for finite numbers', () => {
    expect(getType(0)).toBe('number');
    expect(getType(42)).toBe('number');
    expect(getType(-1.5)).toBe('number');
  });

  it('returns "NaN" for NaN', () => {
    expect(getType(NaN)).toBe('NaN');
  });

  it('returns "boolean" for booleans', () => {
    expect(getType(true)).toBe('boolean');
    expect(getType(false)).toBe('boolean');
  });

  it('returns "symbol" for symbols', () => {
    expect(getType(Symbol('x'))).toBe('symbol');
  });

  it('returns "bigint" for bigints', () => {
    expect(getType(BigInt(9))).toBe('bigint');
  });

  it('returns the constructor name for objects', () => {
    expect(getType(new Date())).toBe('Date');
    expect(getType([])).toBe('Array');
    expect(getType(new Uint8Array())).toBe('Uint8Array');
    expect(getType(new ArrayBuffer(1))).toBe('ArrayBuffer');
  });

  it('returns constructor name for plain objects', () => {
    expect(getType({})).toBe('Object');
  });
});

// ---------------------------------------------------------------------------
// isType
// ---------------------------------------------------------------------------

describe('isType', () => {
  it('matches null', () => {
    expect(isType(null, 'null')).toBe(true);
    expect(isType(undefined, 'null')).toBe(false);
  });

  it('matches undefined', () => {
    expect(isType(undefined, 'undefined')).toBe(true);
    expect(isType(null, 'undefined')).toBe(false);
  });

  it('matches string', () => {
    expect(isType('hello', 'string')).toBe(true);
    expect(isType('', 'string')).toBe(true);
    expect(isType(5, 'string')).toBe(false);
  });

  it('matches number (excludes NaN)', () => {
    expect(isType(42, 'number')).toBe(true);
    expect(isType(0, 'number')).toBe(true);
    expect(isType(NaN, 'number')).toBe(false);
  });

  it('matches boolean', () => {
    expect(isType(true, 'boolean')).toBe(true);
    expect(isType(false, 'boolean')).toBe(true);
    expect(isType(1, 'boolean')).toBe(false);
  });

  it('matches symbol', () => {
    expect(isType(Symbol('s'), 'symbol')).toBe(true);
    expect(isType('s', 'symbol')).toBe(false);
  });

  it('matches bigint', () => {
    expect(isType(BigInt(1), 'bigint')).toBe(true);
    expect(isType(1, 'bigint')).toBe(false);
  });

  it('matches function', () => {
    expect(isType(() => {}, 'function')).toBe(true);
    expect(isType(42, 'function')).toBe(false);
  });

  it('matches Date constructor', () => {
    expect(isType(new Date(), Date)).toBe(true);
    expect(isType('2021-01-01', Date)).toBe(false);
  });

  it('matches Array constructor', () => {
    expect(isType([], Array)).toBe(true);
    expect(isType({}, Array)).toBe(false);
  });

  it('matches Uint8Array constructor', () => {
    expect(isType(new Uint8Array(), Uint8Array)).toBe(true);
    expect(isType([], Uint8Array)).toBe(false);
  });

  it('matches ArrayBuffer constructor', () => {
    expect(isType(new ArrayBuffer(1), ArrayBuffer)).toBe(true);
    expect(isType([], ArrayBuffer)).toBe(false);
  });

  it('matches a tuple [Constructor, label] descriptor', () => {
    class Foo {}
    expect(isType(new Foo(), [Foo, 'Foo'])).toBe(true);
    expect(isType({}, [Foo, 'Foo'])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// createTypeErrorMsg
// ---------------------------------------------------------------------------

describe('createTypeErrorMsg', () => {
  it('produces a readable error message for a single type', () => {
    const msg = createTypeErrorMsg('hello', 'myVar', ['number']);
    expect(msg).toBe(
      '`myVar` must be of type `number`, but was actually of type `string`',
    );
  });

  it('joins multiple allowed types with "or"', () => {
    const msg = createTypeErrorMsg(null, 'x', ['string', 'number']);
    expect(msg).toContain('`string` or `number`');
    expect(msg).toContain('`null`');
  });

  it('handles built-in constructors', () => {
    const msg = createTypeErrorMsg('hi', 'val', [Array, Uint8Array]);
    expect(msg).toContain('`Array` or `Uint8Array`');
  });

  it('handles tuple type descriptors', () => {
    class Bar {}
    const msg = createTypeErrorMsg('oops', 'val', [[Bar, 'Bar']]);
    expect(msg).toContain('`Bar`');
  });
});

// ---------------------------------------------------------------------------
// createValueErrorMsg
// ---------------------------------------------------------------------------

describe('createValueErrorMsg', () => {
  it('formats string values with single quotes', () => {
    const msg = createValueErrorMsg('bad', 'color', ['red', 'blue']);
    expect(msg).toContain("'red'");
    expect(msg).toContain("'blue'");
    expect(msg).toContain("'bad'");
  });

  it('formats undefined values with backticks', () => {
    const msg = createValueErrorMsg(undefined, 'opt', ['a', undefined]);
    expect(msg).toContain('`undefined`');
  });

  it('formats number values plainly', () => {
    const msg = createValueErrorMsg(3, 'level', [1, 2]);
    expect(msg).toContain('1 or 2');
    expect(msg).toContain('3');
  });
});

// ---------------------------------------------------------------------------
// assertIs
// ---------------------------------------------------------------------------

describe('assertIs', () => {
  it('does not throw when the value matches a single type', () => {
    expect(() => assertIs('hello', 'val', ['string'])).not.toThrow();
    expect(() => assertIs(42, 'val', ['number'])).not.toThrow();
    expect(() => assertIs(true, 'val', ['boolean'])).not.toThrow();
    expect(() => assertIs(null, 'val', ['null'])).not.toThrow();
    expect(() => assertIs(undefined, 'val', ['undefined'])).not.toThrow();
  });

  it('does not throw when the value matches any of several types', () => {
    expect(() => assertIs('hi', 'val', ['string', 'number'])).not.toThrow();
    expect(() => assertIs(7, 'val', ['string', 'number'])).not.toThrow();
  });

  it('does not throw for constructor types', () => {
    expect(() => assertIs(new Date(), 'val', [Date])).not.toThrow();
    expect(() => assertIs([1, 2], 'val', [Array])).not.toThrow();
    expect(() =>
      assertIs(new Uint8Array(2), 'val', [Uint8Array]),
    ).not.toThrow();
    expect(() =>
      assertIs(new ArrayBuffer(2), 'val', [ArrayBuffer]),
    ).not.toThrow();
  });

  it('throws TypeError when the value does not match', () => {
    expect(() => assertIs('hello', 'myVal', ['number'])).toThrow(TypeError);
    expect(() => assertIs(null, 'myVal', ['string'])).toThrow(TypeError);
  });

  it('includes the value name in the error message', () => {
    expect(() => assertIs('x', 'myField', ['number'])).toThrow(/myField/);
  });

  it('rejects NaN as a number', () => {
    expect(() => assertIs(NaN, 'val', ['number'])).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// assertOrUndefined
// ---------------------------------------------------------------------------

describe('assertOrUndefined', () => {
  it('does not throw when the value matches the type', () => {
    expect(() => assertOrUndefined('hi', 'val', ['string'])).not.toThrow();
  });

  it('does not throw when the value is undefined', () => {
    expect(() => assertOrUndefined(undefined, 'val', ['string'])).not.toThrow();
  });

  it('throws TypeError when value is neither the type nor undefined', () => {
    expect(() => assertOrUndefined(42, 'val', ['string'])).toThrow(TypeError);
  });

  it('throws TypeError for null (null is not undefined)', () => {
    expect(() => assertOrUndefined(null, 'val', ['string'])).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// assertEachIs
// ---------------------------------------------------------------------------

describe('assertEachIs', () => {
  it('does not throw when all elements match', () => {
    expect(() => assertEachIs(['a', 'b'], 'arr', ['string'])).not.toThrow();
    expect(() => assertEachIs([1, 2, 3], 'arr', ['number'])).not.toThrow();
  });

  it('does not throw for an empty array', () => {
    expect(() => assertEachIs([], 'arr', ['string'])).not.toThrow();
  });

  it('throws TypeError when any element does not match', () => {
    expect(() => assertEachIs(['a', 5], 'arr', ['string'])).toThrow(TypeError);
  });

  it('supports multiple types per element', () => {
    expect(() =>
      assertEachIs(['a', 5, true], 'arr', ['string', 'number', 'boolean']),
    ).not.toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertRange
// ---------------------------------------------------------------------------

describe('assertRange', () => {
  it('does not throw when value is within range', () => {
    expect(() => assertRange(5, 'val', 0, 10)).not.toThrow();
  });

  it('does not throw when value equals min', () => {
    expect(() => assertRange(0, 'val', 0, 10)).not.toThrow();
  });

  it('does not throw when value equals max', () => {
    expect(() => assertRange(10, 'val', 0, 10)).not.toThrow();
  });

  it('throws when value is below min', () => {
    expect(() => assertRange(-1, 'val', 0, 10)).toThrow();
    expect(() => assertRange(-1, 'val', 0, 10)).toThrow(
      /must be at least 0 and at most 10/,
    );
  });

  it('throws when value is above max', () => {
    expect(() => assertRange(11, 'val', 0, 10)).toThrow();
    expect(() => assertRange(11, 'val', 0, 10)).toThrow(
      /must be at least 0 and at most 10/,
    );
  });

  it('throws TypeError when value is not a number', () => {
    expect(() => assertRange('5' as any, 'val', 0, 10)).toThrow(TypeError);
  });

  it('throws TypeError when min is not a number', () => {
    expect(() => assertRange(5, 'val', '0' as any, 10)).toThrow(TypeError);
  });

  it('throws TypeError when max is not a number', () => {
    expect(() => assertRange(5, 'val', 0, '10' as any)).toThrow(TypeError);
  });

  it('swaps min and max if min > max (uses Math.max)', () => {
    // When min=10 and max=5, the implementation does max = Math.max(10,5) = 10
    // So the effective range becomes [10, 10] -- only 10 is valid.
    expect(() => assertRange(10, 'val', 10, 5)).not.toThrow();
    expect(() => assertRange(7, 'val', 10, 5)).toThrow();
  });
});

// ---------------------------------------------------------------------------
// assertRangeOrUndefined
// ---------------------------------------------------------------------------

describe('assertRangeOrUndefined', () => {
  it('does not throw when value is within range', () => {
    expect(() => assertRangeOrUndefined(5, 'val', 0, 10)).not.toThrow();
  });

  it('does not throw when value is undefined', () => {
    expect(() =>
      assertRangeOrUndefined(undefined, 'val', 0, 10),
    ).not.toThrow();
  });

  it('throws when value is out of range', () => {
    expect(() => assertRangeOrUndefined(20, 'val', 0, 10)).toThrow(
      /must be at least 0 and at most 10/,
    );
  });

  it('throws TypeError when value is not a number and not undefined', () => {
    expect(() =>
      assertRangeOrUndefined('5' as any, 'val', 0, 10),
    ).toThrow(TypeError);
  });

  it('throws TypeError for null', () => {
    expect(() =>
      assertRangeOrUndefined(null as any, 'val', 0, 10),
    ).toThrow(TypeError);
  });
});

// ---------------------------------------------------------------------------
// assertMultiple
// ---------------------------------------------------------------------------

describe('assertMultiple', () => {
  it('does not throw when value is a multiple of the multiplier', () => {
    expect(() => assertMultiple(6, 'val', 3)).not.toThrow();
    expect(() => assertMultiple(0, 'val', 5)).not.toThrow();
    expect(() => assertMultiple(100, 'val', 10)).not.toThrow();
  });

  it('throws when value is not a multiple', () => {
    expect(() => assertMultiple(7, 'val', 3)).toThrow(
      /must be a multiple of 3/,
    );
  });

  it('throws TypeError when value is not a number', () => {
    expect(() => assertMultiple('6' as any, 'val', 3)).toThrow(TypeError);
  });

  it('handles negative multiples', () => {
    expect(() => assertMultiple(-6, 'val', 3)).not.toThrow();
    expect(() => assertMultiple(-7, 'val', 3)).toThrow();
  });

  it('includes the value name in the error message', () => {
    expect(() => assertMultiple(5, 'someField', 3)).toThrow(/someField/);
  });
});

// ---------------------------------------------------------------------------
// assertInteger
// ---------------------------------------------------------------------------

describe('assertInteger', () => {
  it('does not throw for integers', () => {
    expect(() => assertInteger(0, 'val')).not.toThrow();
    expect(() => assertInteger(1, 'val')).not.toThrow();
    expect(() => assertInteger(-42, 'val')).not.toThrow();
  });

  it('throws for non-integer numbers', () => {
    expect(() => assertInteger(1.5, 'val')).toThrow(/must be an integer/);
    expect(() => assertInteger(0.1, 'val')).toThrow(/must be an integer/);
  });

  it('throws for NaN', () => {
    expect(() => assertInteger(NaN, 'val')).toThrow(/must be an integer/);
  });

  it('throws for Infinity', () => {
    expect(() => assertInteger(Infinity, 'val')).toThrow(/must be an integer/);
    expect(() => assertInteger(-Infinity, 'val')).toThrow(
      /must be an integer/,
    );
  });

  it('throws for non-number types', () => {
    expect(() => assertInteger('5' as any, 'val')).toThrow(
      /must be an integer/,
    );
    expect(() => assertInteger(undefined as any, 'val')).toThrow(
      /must be an integer/,
    );
  });

  it('includes the value name in the error', () => {
    expect(() => assertInteger(1.1, 'myInt')).toThrow(/myInt/);
  });
});

// ---------------------------------------------------------------------------
// assertPositive
// ---------------------------------------------------------------------------

describe('assertPositive', () => {
  it('does not throw for positive numbers', () => {
    expect(() => assertPositive(1, 'val')).not.toThrow();
    expect(() => assertPositive(100, 'val')).not.toThrow();
    expect(() => assertPositive(0.5, 'val')).not.toThrow();
  });

  it('does not throw for zero', () => {
    expect(() => assertPositive(0, 'val')).not.toThrow();
  });

  it('throws for negative numbers', () => {
    expect(() => assertPositive(-1, 'val')).toThrow(
      /must be a positive number or 0/,
    );
    expect(() => assertPositive(-0.5, 'val')).toThrow(
      /must be a positive number or 0/,
    );
  });

  it('throws for NaN', () => {
    expect(() => assertPositive(NaN, 'val')).toThrow(
      /must be a positive number or 0/,
    );
  });

  it('includes the value name in the error', () => {
    expect(() => assertPositive(-5, 'lineWidth')).toThrow(/lineWidth/);
  });
});

// ---------------------------------------------------------------------------
// assertIsOneOf
// ---------------------------------------------------------------------------

describe('assertIsOneOf', () => {
  it('does not throw when value is in the allowed array', () => {
    expect(() => assertIsOneOf('a', 'val', ['a', 'b', 'c'])).not.toThrow();
    expect(() => assertIsOneOf(2, 'val', [1, 2, 3])).not.toThrow();
  });

  it('throws TypeError when value is not in the allowed array', () => {
    expect(() => assertIsOneOf('d', 'val', ['a', 'b', 'c'])).toThrow(
      TypeError,
    );
  });

  it('accepts an object whose values are the allowed set', () => {
    const allowedObj = { x: 'alpha', y: 'beta' };
    expect(() => assertIsOneOf('alpha', 'val', allowedObj)).not.toThrow();
    expect(() => assertIsOneOf('gamma', 'val', allowedObj)).toThrow(TypeError);
  });

  it('uses strict equality (no type coercion)', () => {
    expect(() => assertIsOneOf(0, 'val', [false as any])).toThrow(TypeError);
    expect(() => assertIsOneOf('', 'val', [0 as any])).toThrow(TypeError);
  });

  it('supports undefined as an allowed value', () => {
    expect(() =>
      assertIsOneOf(undefined, 'val', [undefined, null]),
    ).not.toThrow();
  });

  it('error message lists allowed values', () => {
    expect(() => assertIsOneOf('x', 'mode', ['a', 'b'])).toThrow(
      /must be one of/,
    );
  });
});

// ---------------------------------------------------------------------------
// assertIsOneOfOrUndefined
// ---------------------------------------------------------------------------

describe('assertIsOneOfOrUndefined', () => {
  it('does not throw when value is in the allowed array', () => {
    expect(() =>
      assertIsOneOfOrUndefined('a', 'val', ['a', 'b']),
    ).not.toThrow();
  });

  it('does not throw when value is undefined', () => {
    expect(() =>
      assertIsOneOfOrUndefined(undefined, 'val', ['a', 'b']),
    ).not.toThrow();
  });

  it('throws TypeError when value is neither allowed nor undefined', () => {
    expect(() => assertIsOneOfOrUndefined('c', 'val', ['a', 'b'])).toThrow(
      TypeError,
    );
  });

  it('throws TypeError for null when null is not in allowed values', () => {
    expect(() => assertIsOneOfOrUndefined(null, 'val', ['a', 'b'])).toThrow(
      TypeError,
    );
  });

  it('accepts an object whose values are the allowed set', () => {
    const allowed = { first: 1, second: 2 };
    expect(() =>
      assertIsOneOfOrUndefined(1, 'val', allowed),
    ).not.toThrow();
    expect(() =>
      assertIsOneOfOrUndefined(undefined, 'val', allowed),
    ).not.toThrow();
    expect(() => assertIsOneOfOrUndefined(3, 'val', allowed)).toThrow(
      TypeError,
    );
  });
});

// ---------------------------------------------------------------------------
// assertIsSubset
// ---------------------------------------------------------------------------

describe('assertIsSubset', () => {
  it('does not throw when all values are in the allowed set', () => {
    expect(() =>
      assertIsSubset(['a', 'b'], 'val', ['a', 'b', 'c']),
    ).not.toThrow();
  });

  it('does not throw for an empty array of values', () => {
    expect(() => assertIsSubset([], 'val', ['a', 'b'])).not.toThrow();
  });

  it('throws TypeError when any value is not in the allowed set', () => {
    expect(() => assertIsSubset(['a', 'd'], 'val', ['a', 'b', 'c'])).toThrow(
      TypeError,
    );
  });

  it('accepts an object whose values are the allowed set', () => {
    const allowed = { x: 10, y: 20 };
    expect(() => assertIsSubset([10, 20], 'val', allowed)).not.toThrow();
    expect(() => assertIsSubset([10, 30], 'val', allowed)).toThrow(TypeError);
  });

  it('handles duplicate values in the input array', () => {
    expect(() =>
      assertIsSubset(['a', 'a', 'a'], 'val', ['a', 'b']),
    ).not.toThrow();
  });
});
