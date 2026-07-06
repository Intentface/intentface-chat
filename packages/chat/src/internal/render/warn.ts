// Vendored from @base-ui/utils v1.6.0 (MIT) — packages/utils/src/warn.ts
// https://github.com/mui/base-ui — exact copy.

let set: Set<string>;
if (process.env.NODE_ENV !== 'production') {
  set = new Set<string>();
}

export function warn(...messages: string[]) {
  if (process.env.NODE_ENV !== 'production') {
    const messageKey = messages.join(' ');
    if (!set.has(messageKey)) {
      set.add(messageKey);
      console.warn(`Base UI: ${messageKey}`);
    }
  }
}
