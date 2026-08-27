const DEFAULT_CURRENCY = "NGN";
const ISO_CURRENCY = /^[A-Za-z]{3}$/;

const LOCALE_BY_CURRENCY: Readonly<Record<string, string>> = {
  NGN: "en-NG",
  USD: "en-US",
  EUR: "en-GB",
  GBP: "en-GB",
};

const currencyFormatters = new Map<string, Intl.NumberFormat>();

/** Formats API money values with a safe ISO 4217 fallback. */
export function formatCurrency(value: number, currency = DEFAULT_CURRENCY) {
  const code = ISO_CURRENCY.test(currency) ? currency.toUpperCase() : DEFAULT_CURRENCY;
  const cached = currencyFormatters.get(code);

  if (cached) {
    return cached.format(value);
  }

  const formatter = new Intl.NumberFormat(LOCALE_BY_CURRENCY[code] ?? "en", {
    style: "currency",
    currency: code,
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  });

  currencyFormatters.set(code, formatter);
  return formatter.format(value);
}
