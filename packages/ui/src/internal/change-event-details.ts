// Adapted from @base-ui/react v1.6.0 (MIT) — packages/react/src/internals/createBaseUIEventDetails.ts
// https://github.com/mui/base-ui — trimmed to the change details our primitives emit.

/** Why a change happened, and the chance to `cancel()` it before it lands. */
export type ChangeEventDetails<Reason extends string> = {
  reason: Reason;
  /** The native event behind the change. */
  event: Event;
  /** The element that started it, where there is one. */
  trigger: Element | undefined;
  /** Keeps the change from landing. */
  cancel: () => void;
  readonly isCanceled: boolean;
};

export const createChangeEventDetails = <Reason extends string>(
  reason: Reason,
  event: Event = new Event("change"),
  trigger?: Element,
): ChangeEventDetails<Reason> => {
  let canceled = false;
  return {
    reason,
    event,
    trigger,
    cancel: () => {
      canceled = true;
    },
    get isCanceled() {
      return canceled;
    },
  };
};
