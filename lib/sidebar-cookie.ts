/**
 * Where this app keeps the sidebar's layout.
 *
 * The package has no opinion about any of it: `Shell` reports changes out
 * through `onOpenChange` / `onWidthChange` and takes them back as
 * `defaultOpen` / `defaultWidth`, so the format, the key and the cookie flags
 * below are ours to choose — and ours to change without waiting on a release.
 *
 * A cookie rather than localStorage because it is readable from the request,
 * which is what lets the layout paint the right thing on the first frame
 * instead of snapping a frame later.
 */

const KEY = "sidebar";
const MAX_AGE = 60 * 60 * 24 * 365;

export type SidebarLayout = { open: boolean; width?: number };

/**
 * Validate on the way in, always. Stored state outlives the code that wrote
 * it: a value from an older release, a half-written entry, or something
 * another script left under the same key. Anything unexpected is discarded in
 * favour of the defaults, because a sidebar that opens at its default width is
 * a non-event and one that crashes on a stale cookie is not.
 */
export const parseSidebarLayout = (raw: string | null | undefined): SidebarLayout | null => {
  if (!raw) return null;

  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (typeof value !== "object" || value === null) return null;

  const { open, width } = value as Record<string, unknown>;
  if (typeof open !== "boolean") return null;
  if (width === undefined) return { open };
  if (typeof width !== "number" || !Number.isFinite(width) || width <= 0) return null;

  return { open, width };
};

/** Pull our entry out of a `Cookie` header or `document.cookie`. */
const scan = (cookies: string) => {
  const prefix = `${KEY}=`;
  for (const part of cookies.split(";")) {
    const entry = part.trim();
    if (entry.startsWith(prefix)) return decodeURIComponent(entry.slice(prefix.length));
  }
  return null;
};

/** Server-side: read it off a request's `Cookie` header. */
export const readSidebarLayout = (cookieHeader: string | null | undefined) =>
  cookieHeader ? parseSidebarLayout(scan(cookieHeader)) : null;

/** Client-side: merge one field into whatever is stored and write it back. */
export const writeSidebarLayout = (patch: Partial<SidebarLayout>) => {
  if (typeof document === "undefined") return;

  const current = parseSidebarLayout(scan(document.cookie)) ?? { open: true };
  const next = JSON.stringify({ ...current, ...patch });
  // biome-ignore lint/suspicious/noDocumentCookie: the Cookie Store API is still absent from Safari and Firefox.
  document.cookie = `${KEY}=${encodeURIComponent(next)}; path=/; max-age=${MAX_AGE}; samesite=lax`;
};
