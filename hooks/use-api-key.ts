import useSWR from "swr";
import useSWRMutation from "swr/mutation";

// Client half of the /api/key contract. Deliberately not importing the endpoint
// from lib/api-key.ts: that module reads `next/headers` and would drag server-only
// code into the client bundle.
const KEY_ENDPOINT = "/api/key";

const fetchKeyStatus = async (url: string): Promise<{ isSet: boolean }> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} responded ${response.status}`);
  return response.json();
};

// The mutations throw their user-facing message on failure. That is what lets
// useSWRMutation own both the pending flag and the error, instead of this hook
// tracking either by hand.
const saveKey = async (url: string, { arg: key }: { arg: string }) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ key }),
  }).catch(() => null);

  if (!response) throw new Error("Couldn't reach the server — try again.");
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.error ?? "Couldn't save that key.");
  }
};

const deleteKey = async (url: string) => {
  const response = await fetch(url, { method: "DELETE" }).catch(() => null);
  if (!response?.ok) throw new Error("Couldn't clear the key — try again.");
};

/**
 * Whether the visitor has supplied their own OpenAI key, plus the two mutations.
 *
 * Presence is server state — the cookie is HttpOnly, has a finite max-age, and
 * can be cleared from another tab — so it is fetched and revalidated rather than
 * mirrored into a store. A persisted copy would keep claiming "key set" after the
 * cookie expired, leaving the UI insisting while the API returned 401.
 */
export const useApiKey = () => {
  const { data, isLoading } = useSWR(KEY_ENDPOINT, fetchKeyStatus);
  const saving = useSWRMutation(KEY_ENDPOINT, saveKey);
  const clearing = useSWRMutation(KEY_ENDPOINT, deleteKey);

  const failure: unknown = saving.error ?? clearing.error;

  return {
    isSet: data?.isSet === true,
    isLoading,
    // Covers the request *and* the revalidation it triggers, so a control bound to
    // this stays disabled until the new state has actually landed. A flag released
    // at the end of the request would re-enable it mid-flight.
    isSubmitting: saving.isMutating || clearing.isMutating,
    error: failure instanceof Error ? failure.message : null,
    /** Resolves true when the key was accepted, so the caller can clear its input. */
    save: async (key: string): Promise<boolean> => {
      try {
        await saving.trigger(key);
        return true;
      } catch {
        // Already surfaced as `error`; the boolean is only for the input reset.
        return false;
      }
    },
    clear: () => clearing.trigger().catch(() => undefined),
  };
};
