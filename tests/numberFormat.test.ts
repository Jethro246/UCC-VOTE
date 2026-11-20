import assert from 'node:assert/strict';
import { formatNumber, formatPercentage, formatCurrency } from '../src/utils/numberFormat';

function runTests() {
  // Zero values must always display strictly as "0" (or "0%" / "GH₵0")
  assert.equal(formatNumber(0), '0');
  assert.equal(formatNumber(-0), '0');
  assert.equal(formatNumber('0'), '0');
  assert.equal(formatNumber('0.0'), '0');
  assert.equal(formatNumber('0.00'), '0');
  assert.equal(formatNumber(0.0), '0');
  assert.equal(formatNumber(-0.0001), '0');

  assert.equal(formatPercentage(0), '0%');
  assert.equal(formatPercentage(-0), '0%');
  assert.equal(formatPercentage('0.00'), '0%');

  assert.equal(formatCurrency(0), 'GH₵0');

  // Whole numbers omit unnecessary trailing decimal places
  assert.equal(formatNumber(10.0), '10');
  assert.equal(formatNumber(25.0), '25');
  assert.equal(formatNumber('25.00'), '25');
  assert.equal(formatNumber(100.0), '100');
  assert.equal(formatNumber(1250), '1,250');
  assert.equal(formatNumber(1250, { useGrouping: false }), '1250');

  assert.equal(formatPercentage(100.0), '100%');
  assert.equal(formatPercentage(25.0), '25%');

  // Meaningful decimals are preserved accurately
  assert.equal(formatNumber(42.5), '42.5');
  assert.equal(formatNumber(33.333), '33.33');
  assert.equal(formatPercentage(42.5), '42.5%');
  assert.equal(formatPercentage(66.67, { maximumFractionDigits: 1 }), '66.7%');

  // Missing / invalid values must not be coerced to fake zeros
  assert.equal(formatNumber(null), '—');
  assert.equal(formatNumber(undefined), '—');
  assert.equal(formatNumber(''), '—');
  assert.equal(formatNumber('   '), '—');
  assert.equal(formatNumber(Number.NaN), '—');
  assert.equal(formatNumber(Number.POSITIVE_INFINITY), '—');

  assert.equal(formatPercentage(null), '—');
  assert.equal(formatPercentage(undefined), '—');
  assert.equal(formatCurrency(null), '—');

  console.log('All numberFormat tests passed!');
}

runTests();
