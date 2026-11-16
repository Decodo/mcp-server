/**
 * OpenAI verifies that we own the MCP host before a plugin submission is accepted.
 * It generates a token in the plugin portal and fetches it back from this path,
 * which must answer with the token as plain text and nothing else - not JSON,
 * not a list. Missing or unreachable, the submission fails with
 * `domain_verification_required`.
 *
 * https://developers.openai.com/plugins/deploy/submission-errors
 */
export const OPENAI_APPS_CHALLENGE_PATH = '/.well-known/openai-apps-challenge';

/**
 * No token configured means the route is never registered, so the path 404s
 * instead of verifying against an empty body.
 */
export const openaiAppsChallengeFromEnv = (value: string | undefined): string | undefined =>
  value?.trim() || undefined;
