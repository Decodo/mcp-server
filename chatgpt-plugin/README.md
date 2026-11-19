# Decodo ChatGPT plugin

Source for the ZIP uploaded to the OpenAI plugin directory at
<https://platform.openai.com/plugins>.

```
chatgpt-plugin/
├── plugin.json                       listing metadata + review test cases
├── mcp.json                          points ChatGPT at https://mcp.decodo.com/ai
├── assets/
│   ├── icon.png                      composerIcon, 512x512
│   └── logo.png                      logo, 1024x1024
└── build.sh                          produces decodo-chatgpt-plugin.zip
```

## Building the ZIP

```bash
./build.sh
```

The plugin files land at the archive root, which is what OpenAI's validator expects.
OpenAI validates the package on upload and reports the exact error code, so the limits
below are a pre-flight check rather than something enforced here.
Bump `version` in `plugin.json` before every re-upload - reusing a version triggers
`plugin_version_unchanged`.

## Editing rules worth knowing

Limits are tighter at final directory submission than at package upload, so these are
the ones that matter:

| Field | Limit |
| --- | --- |
| `interface.displayName` | 30 characters |
| `interface.shortDescription` | 30 characters, one line |
| `interface.longDescription` | 4,000 characters |
| `interface.developerName` | 80 characters |
| `interface.capabilities` | 20 entries, 120 characters each |
| `interface.defaultPrompt` | 3 entries, 128 characters each, no `@mentions` |
| listing URLs | HTTPS, 1,024 characters |
| `description` (root) | 1,024 characters |

Icons must be square, at least 48x48, at most 4096x4096 and 5 MiB, and their paths must
start with `./`. `category` must be one of OpenAI's 13 values; `Developer Tools` is ours.

The submission points at `/ai`, not `/mcp`. That route serves the trimmed toolset in
`CLAUDE_TOOLS` (`src/server/claude-tools.ts`) - `scrape_as_markdown`, `search`, `map`,
`screenshot` and the four `crawl_*` tools. The Google, Amazon, Walmart, Target, TikTok
and YouTube tools are **not** on it, whatever `DIRECTORY_HIDDEN_TOOLS`
(`src/server/hidden-tools.ts`) does on `/mcp`.

`review.test_cases` needs exactly 5 positive and 3 negative cases. Every
`tools_triggered` value must match a tool name registered in `src/tools/` **and** be in
`CLAUDE_TOOLS`, or it is not there when a reviewer connects to `/ai`. The same goes for
the listing copy: `longDescription` and `capabilities` must only describe tools that
path actually serves.

This package ships no `skills/`, because the whole surface is the remote MCP server.
OpenAI's `archive_plugin_files_missing` error says a public ZIP needs at least one
skill, while the submission page describes a remote-MCP-only flow. If upload is
rejected for that reason, add a skill under `skills/<name>/SKILL.md` and point
`extensions."com.openai".onboardingSkill` at it.

Never put credentials, `test_credentials` or `reviewer_instructions` in the ZIP - the
validator rejects them. They go in the dashboard.

## What is not in this folder

These are entered in the OpenAI dashboard, not the ZIP:

- Reviewer demo credentials (a test account that works without MFA or magic links)
- The demo recording URL
- The OAuth client secret, if one is ever needed (not needed for `dcr`)
- Domain verification: host the token OpenAI generates in the portal at
  `https://mcp.decodo.com/.well-known/openai-apps-challenge` as plain text - the bare
  token, not JSON and not a list - then press **Verify Domain**. It has to be the MCP
  host or an eligible parent, not `decodo.com`. Leaving **Challenge Base URL** blank is
  correct - it defaults to the MCP hostname and paths are ignored either way. Nothing
  serves this path today, which is the whole reason verification fails: a GET returns
  Express's own 404 (`Cannot GET /.well-known/openai-apps-challenge`), so Cloudflare is
  passing the request through to the origin and OpenAI reads an HTML error page instead
  of the token. Serving it is tracked as its own task. Only directory submission needs
  it - connecting the server to ChatGPT does not
- A justification for each tool's `readOnlyHint`, `openWorldHint` and `destructiveHint`

## References

- Packaging: <https://developers.openai.com/plugins/build/plugins>
- Submission: <https://developers.openai.com/plugins/deploy/submission>
- Validation errors: <https://developers.openai.com/plugins/deploy/submission-errors>
