export interface NumberFormatOptions {
  maximumFractionDigits?: number;
  useGrouping?: boolean;
}

/**
 * Formats numbers consistently across UCC VOTE:
 * - Missing/non-finite values (null, undefined, "", NaN, Infinity) return "—"
 * - Zero (0, -0, 0.0, 0.00, values rounding to 0) always formats strictly as "0"
 * - Whole numbers omit unnecessary trailing decimal places (10.0 -> "10", 100.0 -> "100")
 * - Meaningful decimals are preserved up to maximumFractionDigits (42.5 -> "42.5")
 */
export function formatNumber(
  value: unknown,
  options: NumberFormatOptions = {}
): string {
  if (value === null || value === undefined) {
    return '—';
  }
  if (typeof value === 'string' && value.trim() === '') {
    return '—';
  }

  const num = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(num)) {
    return '—';
  }

  const maximumFractionDigits =
    typeof options.maximumFractionDigits === 'number' && options.maximumFractionDigits >= 0
      ? Math.min(20, Math.floor(options.maximumFractionDigits))
      : 2;

  const useGrouping = options.useGrouping ?? true;

  if (num === 0 || Object.is(num, -0)) {
    return '0';
  }

  const formatted = new Intl.NumberFormat('en-US', {
    useGrouping,
    minimumFractionDigits: 0,
    maximumFractionDigits,
  }).format(num);

  if (formatted === '-0' || formatted === '0') {
    return '0';
  }

  return formatted;
}

/**
 * Formats percentage values consistently:
 * - Missing/non-finite values return "—"
 * - Zero always formats as "0%" (never "0.0%" or "0.00%")
 * - Whole percentages omit decimals ("100%", "25%")
 * - Meaningful decimals are preserved ("42.5%")
 */
export function formatPercentage(
  value: unknown,
  options: NumberFormatOptions = {}
): string {
  const formatted = formatNumber(value, {
    maximumFractionDigits: options.maximumFractionDigits ?? 1,
    useGrouping: options.useGrouping ?? true,
  });

  if (formatted === '—') {
    return '—';
  }

  return `${formatted}%`;
}

/**
 * Formats currency amounts consistently:
 * - Missing/non-finite values return "—"
 * - Zero displays as "<symbol>0" without trailing ".00"
 * - Whole numbers omit unnecessary decimals
 */
export function formatCurrency(
  value: unknown,
  currencySymbol = 'GH₵',
  options: NumberFormatOptions = {}
): string {
  const formatted = formatNumber(value, {
    maximumFractionDigits: options.maximumFractionDigits ?? 2,
    useGrouping: options.useGrouping ?? true,
  });

  if (formatted === '—') {
    return '—';
  }

  return `${currencySymbol}${formatted}`;
}
