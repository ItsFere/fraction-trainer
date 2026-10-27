/*
 * Exact rational arithmetic + answer formatting/parsing.
 *
 * This module is a faithful JavaScript port of Python's
 * `fractions.Fraction` behaviour used by the original tkinter program:
 *
 *   - Fraction is always kept reduced, the sign lives in the numerator.
 *   - "//" and "%" follow Python semantics (floor division / sign of divisor).
 *   - float -> Fraction uses the exact binary value of the double.
 *   - Fraction.limit_denominator(max) is implemented exactly as in CPython.
 *   - f"{value:.2f}" is emulated with exact half-even rounding of the double.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FracMath = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ZERO = 0n;
  var ONE = 1n;

  function bigAbs(x) {
    return x < ZERO ? -x : x;
  }

  function gcd(a, b) {
    a = bigAbs(a);
    b = bigAbs(b);
    while (b) {
      var t = a % b;
      a = b;
      b = t;
    }
    return a;
  }

  /* ------------------------------------------------------------------ *
   * Fraction
   * ------------------------------------------------------------------ */

  function Fraction(n, d) {
    if (!(this instanceof Fraction)) {
      return new Fraction(n, d);
    }
    n = BigInt(n === undefined ? 0 : n);
    d = BigInt(d === undefined || d === null ? 1 : d);
    if (d === ZERO) {
      throw new RangeError('Fraction: denominator must not be zero');
    }
    if (d < ZERO) {
      n = -n;
      d = -d;
    }
    var g = gcd(n, d);
    if (g !== ONE && g !== ZERO) {
      n = n / g;
      d = d / g;
    }
    this.n = n; // numerator
    this.d = d; // denominator (always > 0, reduced)
  }

  Object.defineProperty(Fraction.prototype, 'numerator', {
    get: function () { return this.n; }
  });
  Object.defineProperty(Fraction.prototype, 'denominator', {
    get: function () { return this.d; }
  });

  Fraction.prototype.add = function (o) {
    o = toFraction(o);
    return new Fraction(this.n * o.d + o.n * this.d, this.d * o.d);
  };

  Fraction.prototype.sub = function (o) {
    o = toFraction(o);
    return new Fraction(this.n * o.d - o.n * this.d, this.d * o.d);
  };

  Fraction.prototype.mul = function (o) {
    o = toFraction(o);
    return new Fraction(this.n * o.n, this.d * o.d);
  };

  Fraction.prototype.div = function (o) {
    o = toFraction(o);
    return new Fraction(this.n * o.d, this.d * o.n);
  };

  Fraction.prototype.neg = function () {
    return new Fraction(-this.n, this.d);
  };

  Fraction.prototype.abs = function () {
    return this.n < ZERO ? this.neg() : this;
  };

  /* -1, 0 or 1 */
  Fraction.prototype.cmp = function (o) {
    o = toFraction(o);
    var left = this.n * o.d;
    var right = o.n * this.d;
    if (left < right) return -1;
    if (left > right) return 1;
    return 0;
  };

  Fraction.prototype.eq = function (o) {
    return this.cmp(o) === 0;
  };

  Fraction.prototype.lt = function (o) { return this.cmp(o) < 0; };
  Fraction.prototype.le = function (o) { return this.cmp(o) <= 0; };
  Fraction.prototype.gt = function (o) { return this.cmp(o) > 0; };
  Fraction.prototype.ge = function (o) { return this.cmp(o) >= 0; };

  Fraction.prototype.toFloat = function () {
    return Number(this.n) / Number(this.d);
  };

  /* str(Fraction(x, y)) -> "x/y" (or "x" when the denominator is 1) */
  Fraction.prototype.toString = function () {
    if (this.d === ONE) return this.n.toString();
    return this.n.toString() + '/' + this.d.toString();
  };

  function toFraction(v) {
    if (v instanceof Fraction) return v;
    if (typeof v === 'bigint') return new Fraction(v, ONE);
    if (typeof v === 'number' && Number.isInteger(v)) return new Fraction(v, ONE);
    throw new TypeError('Cannot convert value to Fraction');
  }

  /* ------------------------------------------------------------------ *
   * Python-style floor division / modulo:  n // d , n % d
   * ------------------------------------------------------------------ */

  function pyDivMod(n, d) {
    var q = n / d;
    var r = n % d;
    if (r !== ZERO && ((r < ZERO) !== (d < ZERO))) {
      q -= ONE;
      r += d;
    }
    return [q, r];
  }

  /* ------------------------------------------------------------------ *
   * Exact conversion of an IEEE-754 double into a Fraction
   * ------------------------------------------------------------------ */

  var _buf = new ArrayBuffer(8);
  var _dv = new DataView(_buf);

  function fromDouble(x) {
    if (typeof x !== 'number') {
      throw new TypeError('fromDouble expects a number');
    }
    if (!isFinite(x)) {
      // CPython raises OverflowError("cannot convert Infinity to integer ratio")
      throw new RangeError('cannot convert Infinity or NaN to integer ratio');
    }
    if (x === 0) return new Fraction(ZERO, ONE);

    _dv.setFloat64(0, x, false);
    var hi = _dv.getUint32(0, false);
    var lo = _dv.getUint32(4, false);

    var negative = (hi >>> 31) === 1;
    var exp = (hi >>> 20) & 0x7ff;
    var mant = (BigInt(hi & 0xfffff) << 32n) | BigInt(lo);

    if (exp === 0) {
      // subnormal
      exp = 1 - 1023 - 52;
    } else {
      mant = mant | (1n << 52n);
      exp = exp - 1023 - 52;
    }

    var n = mant;
    var d = ONE;
    if (exp >= 0) {
      n = n << BigInt(exp);
    } else {
      d = ONE << BigInt(-exp);
    }
    if (negative) n = -n;
    return new Fraction(n, d);
  }

  /* ------------------------------------------------------------------ *
   * Fraction.limit_denominator (identical algorithm to CPython)
   * ------------------------------------------------------------------ */

  function limitDenominator(f, maxDenominator) {
    f = toFraction(f);
    var maxDen = BigInt(maxDenominator);
    if (maxDen < ONE) {
      throw new RangeError('max_denominator should be at least 1');
    }
    if (f.d <= maxDen) return f;

    var p0 = ZERO, q0 = ONE, p1 = ONE, q1 = ZERO;
    var n = f.n, d = f.d;

    for (;;) {
      var dm = pyDivMod(n, d);
      var a = dm[0];
      var rem = dm[1];
      var q2 = q0 + a * q1;
      if (q2 > maxDen) break;
      // Python: p0, q0, p1, q1 = p1, q1, p0 + a * p1, q2
      var np0 = p1;
      var nq0 = q1;
      var np1 = p0 + a * p1;
      var nq1 = q2;
      p0 = np0; q0 = nq0; p1 = np1; q1 = nq1;
      // Python: n, d = d, n - a * d
      n = d;
      d = rem;
    }

    var k = (maxDen - q0) / q1; // floor: both operands are non-negative
    var bound1 = new Fraction(p0 + k * p1, q0 + k * q1);
    var bound2 = new Fraction(p1, q1);

    if (bound2.sub(f).abs().cmp(bound1.sub(f).abs()) <= 0) {
      return bound2;
    }
    return bound1;
  }

  /* ------------------------------------------------------------------ *
   * format(value, ".2f") with exact half-even rounding of the double
   * ------------------------------------------------------------------ */

  function pow10(digits) {
    var r = ONE;
    var ten = 10n;
    for (var i = 0; i < digits; i++) r *= ten;
    return r;
  }

  function formatFixed(x, digits) {
    if (!isFinite(x)) {
      if (x !== x) return 'nan';
      return x > 0 ? 'inf' : '-inf';
    }
    var negative = x < 0;
    var f = fromDouble(Math.abs(x));
    var scale = pow10(digits);

    var num = f.n * scale;
    var den = f.d;
    var q = num / den;
    var r = num % den;
    var twice = r * 2n;
    if (twice > den || (twice === den && q % 2n !== ZERO)) {
      q += ONE;
    }

    var s = q.toString();
    var out;
    if (digits > 0) {
      while (s.length < digits + 1) s = '0' + s;
      out = s.slice(0, s.length - digits) + '.' + s.slice(s.length - digits);
    } else {
      out = s;
    }
    if (negative && q !== ZERO) out = '-' + out;
    return out;
  }

  /* ------------------------------------------------------------------ *
   * Input parsing helpers
   * ------------------------------------------------------------------ */

  /*
   * Python's int()/float()/str.isdigit() accept any Unicode decimal digit
   * (category Nd: "١٢٣", "１２３", ...).  Map them onto ASCII digits.
   */
  var DIGITS_RE = /^[0-9]+$/;

  function digitValue(cp) {
    var start = cp;
    while (start > 0 && /\p{Nd}/u.test(String.fromCodePoint(start - 1))) {
      start -= 1;
    }
    return cp - start;
  }

  function toAsciiDigits(s) {
    // ASCII fast path
    var ascii = true;
    for (var i = 0; i < s.length; i++) {
      if (s.charCodeAt(i) > 127) { ascii = false; break; }
    }
    if (ascii) return s;
    return s.replace(/\p{Nd}/gu, function (ch) {
      return String(digitValue(ch.codePointAt(0)));
    });
  }

  // int literal: optional sign, digits with optional single underscores
  var INT_RE = /^[+-]?[0-9](?:_?[0-9])*$/;
  // float literal grammar of CPython's float()
  var DIGITPART = '[0-9](?:_?[0-9])*';
  var FLOAT_RE = new RegExp(
    '^[+-]?(?:' +
      '(?:' + DIGITPART + '(?:\\.(?:' + DIGITPART + ')?)?|\\.' + DIGITPART + ')' +
      '(?:[eE][+-]?' + DIGITPART + ')?' +
      '|inf(?:inity)?' +
      '|nan' +
    ')$',
    'i'
  );

  /* str.isdigit() approximation (identical outcomes for our purposes) */
  function isDigits(s) {
    return DIGITS_RE.test(toAsciiDigits(s));
  }

  /* int(s) -> BigInt or null */
  function parseIntStrict(s) {
    var t = toAsciiDigits(s);
    if (!INT_RE.test(t)) return null;
    try {
      return BigInt(t.replace(/_/g, ''));
    } catch (e) {
      return null;
    }
  }

  /* float(s) -> number or null */
  function parseFloatStrict(s) {
    var t = toAsciiDigits(s);
    if (!FLOAT_RE.test(t)) return null;
    return Number(t.replace(/_/g, ''));
  }

  /* str.split() with no arguments */
  function splitWhitespace(s) {
    var parts = s.split(/[ \t\n\r\f\v]+/);
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (parts[i] !== '') out.push(parts[i]);
    }
    return out;
  }

  /* ------------------------------------------------------------------ *
   * format_answer(frac_val)  --  MixedFractionApp.format_answer
   * ------------------------------------------------------------------ */

  function formatAnswer(answerFormat, fracVal) {
    var f = toFraction(fracVal);

    if (answerFormat === 'mixed') {
      if (f.d === ONE) return f.n.toString();
      var dm = pyDivMod(f.n, f.d);
      var whole = dm[0];
      var remainder = dm[1];
      if (remainder === ZERO) return whole.toString();
      if (whole === ZERO) return remainder.toString() + '/' + f.d.toString();
      return whole.toString() + ' ' + remainder.toString() + '/' + f.d.toString();
    }

    if (answerFormat === 'improper') {
      return f.n.toString() + '/' + f.d.toString();
    }

    if (answerFormat === 'decimal') {
      return formatFixed(f.toFloat(), 2);
    }

    if (answerFormat === 'common') {
      if (f.d === ONE) return f.n.toString();
      return f.n.toString() + '/' + f.d.toString();
    }

    if (answerFormat === 'natural') {
      if (f.d === ONE) return f.n.toString();
      return f.toString();
    }

    return f.toString();
  }

  /* ------------------------------------------------------------------ *
   * parse_user_input(text)  --  MixedFractionApp.parse_user_input
   * ------------------------------------------------------------------ */

  function parseUserInput(answerFormat, text) {
    if (text === null || text === undefined) return null;
    var s = String(text).trim();
    if (!s) return null;

    try {
      if (answerFormat === 'decimal') {
        var val = parseFloatStrict(s);
        if (val === null) return null;
        if (!isFinite(val)) return null; // CPython raises OverflowError here
        return limitDenominator(fromDouble(val), 100);
      }

      if (answerFormat === 'natural') {
        var whole = parseIntStrict(s);
        if (whole === null) return null;
        return new Fraction(whole, ONE);
      }

      if (answerFormat === 'mixed') {
        if (s.indexOf('/') !== -1) {
          var spaceParts = splitWhitespace(s);
          if (spaceParts.length === 2) {
            var w = parseIntStrict(spaceParts[0]);
            if (w === null) return null;
            var fParts = spaceParts[1].split('/');
            if (fParts.length === 2) {
              var num = parseIntStrict(fParts[0]);
              var den = parseIntStrict(fParts[1]);
              if (num === null || den === null) return null;
              if (den === ZERO) return null;
              return new Fraction(w, ONE).add(new Fraction(num, den));
            }
          } else if (spaceParts.length === 1) {
            var fParts2 = spaceParts[0].split('/');
            if (fParts2.length === 2) {
              var num2 = parseIntStrict(fParts2[0]);
              var den2 = parseIntStrict(fParts2[1]);
              if (num2 === null || den2 === null) return null;
              if (den2 === ZERO) return null;
              return new Fraction(num2, den2);
            }
          }
          return null;
        } else if (isDigits(s)) {
          return new Fraction(parseIntStrict(s), ONE);
        } else {
          return null;
        }
      }

      if (answerFormat === 'common' || answerFormat === 'improper') {
        if (s.indexOf('/') !== -1) {
          var parts = s.split('/');
          if (parts.length === 2 && isDigits(parts[0]) && isDigits(parts[1])) {
            var den3 = parseIntStrict(parts[1]);
            if (den3 === null || den3 === ZERO) return null;
            return new Fraction(parseIntStrict(parts[0]), den3);
          }
          return null;
        } else if (isDigits(s)) {
          return new Fraction(parseIntStrict(s), ONE);
        } else {
          return null;
        }
      }
    } catch (e) {
      return null;
    }

    return null;
  }

  return {
    Fraction: Fraction,
    fromDouble: fromDouble,
    limitDenominator: limitDenominator,
    formatFixed: formatFixed,
    formatAnswer: formatAnswer,
    parseUserInput: parseUserInput,
    pyDivMod: pyDivMod,
    gcd: gcd
  };
});
