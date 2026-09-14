/**
 * Structured JSON logger — always writes to stderr.
 * stderr is safe for both stdio and HTTP transports:
 *   - stdio: MCP protocol uses stdout; stderr is out-of-band and visible in logs
 *   - HTTP: stderr is captured by the container runtime (GCP Cloud Logging etc.)
 */

type LogLevel = 'info' | 'warn' | 'error';

export type LogFields = Record<string, unknown>;

export const log = (level: LogLevel, event: string, fields: LogFields = {}): void => {
  const entry = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
  });
  process.stderr.write(entry + '\n');
};
