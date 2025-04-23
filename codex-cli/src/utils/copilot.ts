import { CLI_VERSION, ORIGIN } from "./session.js";

// GitHub Copilot internal token endpoint
const TOKEN_URL = "https://api.github.com/copilot_internal/v2/token";
// Time before expiration to refresh the token (ms)
const REFRESH_MARGIN_MS = 30_000;

// Cached token headers and expiration time
let cached: { headers: Record<string, string>; expiresAt: number } | null = null;

/**
 * Fetches and returns the headers required for GitHub Copilot API calls.
 * Caches the token and refreshes it when nearing expiration.
 * @throws Error if the initial GitHub token is not set or the request fails.
 */
export async function getCopilotHeaders(): Promise<Record<string, string>> {
  const now = Date.now();
  if (cached && cached.expiresAt - now > REFRESH_MARGIN_MS) {
    return cached.headers;
  }
  const pat = process.env["GITHUB_COPILOT_TOKEN"];
  if (!pat) {
    throw new Error(
      "GitHub Copilot provider requires GITHUB_COPILOT_TOKEN environment variable",
    );
  }
  // Initial headers to fetch a Bearer token
  const initHeaders: Record<string, string> = {
    Authorization: `Token ${pat}`,
    "User-Agent": `codex-cli/${CLI_VERSION}`,
    "Editor-Version": CLI_VERSION,
    "Editor-Plugin-Version": CLI_VERSION,
    "Copilot-Integration-Id": ORIGIN,
  };
  const resp = await fetch(TOKEN_URL, { headers: initHeaders });
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(
      `Failed to fetch Copilot token (${resp.status}): ${text}`,
    );
  }
  const data = (await resp.json()) as { token: string; expires_at: string };
  const bearer = `Bearer ${data.token}`;
  const headers: Record<string, string> = {
    Authorization: bearer,
    "Editor-Version": CLI_VERSION,
    "Editor-Plugin-Version": CLI_VERSION,
    "Copilot-Integration-Id": ORIGIN,
  };
  const expiresAt = new Date(data.expires_at).getTime();
  cached = { headers, expiresAt };
  return headers;
}