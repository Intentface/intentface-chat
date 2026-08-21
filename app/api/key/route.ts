import { cookies } from "next/headers";
import { API_KEY_COOKIE, isValidApiKeyFormat } from "@/lib/api-key";

// Set, clear, and report the visitor's own OpenAI key. The value is written to an
// HttpOnly cookie and never read back out — GET reports presence only.

const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export const GET = async () => {
  const store = await cookies();
  return Response.json({ isSet: store.has(API_KEY_COOKIE) });
};

export const POST = async (request: Request) => {
  const body = await request.json().catch(() => null);
  const key = typeof body?.key === "string" ? body.key.trim() : "";

  if (!isValidApiKeyFormat(key)) {
    return Response.json({ error: "That doesn't look like an OpenAI API key." }, { status: 400 });
  }

  // Verify before storing, so a typo or a revoked key fails here rather than
  // halfway through the first conversation. Cheapest authenticated endpoint.
  const verification = await fetch("https://api.openai.com/v1/models", {
    headers: { Authorization: `Bearer ${key}` },
  }).catch(() => null);

  if (!verification) {
    return Response.json({ error: "Couldn't reach OpenAI to check the key." }, { status: 502 });
  }
  if (!verification.ok) {
    const error =
      verification.status === 401
        ? "OpenAI rejected that key."
        : `OpenAI returned ${verification.status} when checking the key.`;
    return Response.json({ error }, { status: 400 });
  }

  const store = await cookies();
  store.set({
    name: API_KEY_COOKIE,
    value: key,
    httpOnly: true,
    // Localhost is plain http, so requiring Secure there would silently drop it.
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api",
    maxAge: MAX_AGE_SECONDS,
  });

  return new Response(null, { status: 204 });
};

export const DELETE = async () => {
  const store = await cookies();
  store.delete({ name: API_KEY_COOKIE, path: "/api" });
  return new Response(null, { status: 204 });
};
