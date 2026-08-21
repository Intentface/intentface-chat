import { cookies } from "next/headers";

// The visitor's own OpenAI key, held in an HttpOnly cookie.
//
// HttpOnly rather than localStorage deliberately: the browser attaches it to
// /api requests automatically and JavaScript can never read it back, so an
// injected script cannot exfiltrate it. The trade — the settings form can only
// report whether a key is set, never show it — is the right one for a secret.
//
// Path is scoped to /api so it is never sent with page or asset requests, and
// the server keeps it only for the lifetime of a request: nothing writes it to
// disk, a log, or an error body.
export const API_KEY_COOKIE = "openai-key";

/** Shape check only. POST /api/key verifies against OpenAI once, at save time. */
export const isValidApiKeyFormat = (value: string) => /^sk-[A-Za-z0-9_-]{16,}$/.test(value.trim());

export const readApiKey = async () => (await cookies()).get(API_KEY_COOKIE)?.value ?? null;
