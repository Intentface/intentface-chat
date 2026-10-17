import type { Cell, Format } from "./fields";

/**
 * A value as the reader sees it.
 *
 * The only place a value is transformed. Anything computed — a total, an
 * average, a change — comes from the data, never from here and never from the
 * model doing sums in its head.
 *
 * Tolerant by design: the model chose the format and the data came from
 * somewhere else, so a "currency" that turns out to be a word is shown as the
 * word rather than as NaN.
 *
 * ── Locale and time zone ────────────────────────────────────────────────────
 * Both default to the runtime's, which in a browser is the reader's and is
 * what a chat wants. A server writing Markdown that is stored or indexed must
 * pass both: the same spec has to read the same on every machine that renders
 * it, or a snapshot changes when the host does.
 */
export type FormatOptions = {
  /** BCP 47 tag, e.g. "en-GB". The runtime's when omitted. */
  locale?: string;
  /**
   * IANA zone for timestamps, e.g. "Europe/Helsinki". UTC when omitted. A
   * calendar date with no time ("2026-11-30") is always read in UTC — see
   * `formatValue`.
   */
  timeZone?: string;
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const formatValue = (
  value: Cell | undefined,
  format?: Format,
  currency?: string,
  options: FormatOptions = {},
): string => {
  const { locale } = options;
  if (value === null || value === undefined || value === "") return "—";
  if (format === "text") return String(value);

  if (format === "date") {
    const date = new Date(value);
    // A calendar date is a day, not an instant: parsed, it is midnight UTC,
    // and in any zone west of Greenwich that midnight is the evening before.
    // So it is read in UTC whatever zone was asked for. A timestamp is an
    // instant, and is shown in the zone given — UTC when none was, the way an
    // API writes one.
    const timeZone =
      typeof value === "string" && DATE_ONLY.test(value) ? "UTC" : (options.timeZone ?? "UTC");
    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString(locale, { dateStyle: "medium", timeZone });
  }

  const number = typeof value === "number" ? value : Number(value);
  if (typeof value === "string" && (value.trim() === "" || Number.isNaN(number))) return value;

  switch (format) {
    case "currency":
      try {
        return number.toLocaleString(locale, {
          style: "currency",
          currency: currency ?? "EUR",
          maximumFractionDigits: Math.abs(number) >= 1000 ? 0 : 2,
        });
      } catch {
        return number.toLocaleString(locale);
      }
    case "percent":
      return `${number.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
    default:
      return number.toLocaleString(locale, { maximumFractionDigits: 2 });
  }
};

/** Axis ticks: the same formats, shortened, since a tick has a few characters of room. */
export const formatTick = (
  value: number,
  format?: Format,
  currency?: string,
  options: FormatOptions = {},
): string => {
  const compact = (extra: Intl.NumberFormatOptions = {}) =>
    value.toLocaleString(options.locale, {
      notation: "compact",
      maximumFractionDigits: 1,
      ...extra,
    });

  if (format === "currency") {
    try {
      return compact({ style: "currency", currency: currency ?? "EUR" });
    } catch {
      return compact();
    }
  }
  if (format === "percent") return `${compact()}%`;
  return compact();
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * A chart category as the axis shows it. A full ISO date or timestamp — what
 * a CRM's `closeDate` holds, bound straight from the data — reads as a date in
 * the reader's locale; anything else ("2026-08", "W37", "Bath") as written.
 */
export const categoryLabel = (category: string, options: FormatOptions = {}) =>
  ISO_DAY.test(category) ? formatValue(category, "date", undefined, options) : category;

/** Numbers line up on the right; everything else reads from the left. */
export const isNumeric = (format?: Format) =>
  format === "number" || format === "currency" || format === "percent";

/** A change as a signed percentage: +8%, −2% (a true minus, not a hyphen). */
export const signedPercent = (delta: number, options: FormatOptions = {}) =>
  `${delta > 0 ? "+" : delta < 0 ? "−" : ""}${Math.abs(delta).toLocaleString(options.locale, { maximumFractionDigits: 1 })}%`;
