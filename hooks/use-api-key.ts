import { useState } from "react";
import useSWR from "swr";

// Client half of the /api/key contract. Deliberately not importing the endpoint
// from lib/api-key.ts: that module reads `next/headers` and would drag server-only
// code into the client bundle.
const KEY_ENDPOINT = "/api/key";

const fetchKeyStatus = async (url: string): Promise<{ isSet: boolean }> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`GET ${url} responded ${response.status}`);
  return response.json();
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
  const { data, isLoading, mutate } = useSWR(KEY_ENDPOINT, fetchKeyStatus);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  /** Returns true when the key was accepted, so the caller can clear its input. */
  const save = async (key: string): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(KEY_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    }).catch(() => null);
    setIsSubmitting(false);

    if (!response) {
      setError("Couldn't reach the server — try again.");
      return false;
    }
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error ?? "Couldn't save that key.");
      return false;
    }
    await mutate();
    return true;
  };

  const clear = async () => {
    setIsSubmitting(true);
    setError(null);
    const response = await fetch(KEY_ENDPOINT, { method: "DELETE" }).catch(() => null);
    setIsSubmitting(false);
    // Revalidating either way keeps the reported state honest — a failed delete
    // still shows the key as set — but silence would leave that unexplained.
    if (!response?.ok) setError("Couldn't clear the key — try again.");
    await mutate();
  };

  return { isSet: data?.isSet === true, isLoading, isSubmitting, error, save, clear };
};
