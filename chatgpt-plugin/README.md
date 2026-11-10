# Decodo ChatGPT plugin

Source for the ZIP uploaded to the OpenAI plugin directory at
<https://platform.openai.com/plugins>.

```
chatgpt-plugin/
├── plugin.json                       listing metadata + review test cases
├── mcp.json                          points ChatGPT at https://mcp.decodo.com/mcp
├── assets/
│   ├── icon.png                      composerIcon, 512x512
│   └── logo.png                      logo, 1024x1024
├── validate.py                       checks the package against OpenAI's rules
└── build.sh                          validates, then produces the ZIP
```

## Building the ZIP

```bash
./build.sh
```

`build.sh` runs `validate.py` first and refuses to build if anything fails, so a bad
package never reaches the upload form. The plugin files land at the archive root, which
is what OpenAI's validator expects.
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

`review.test_cases` needs exactly 5 positive and 3 negative cases. Every
`tools_triggered` value must match a tool name registered in `src/tools/`.

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
- Domain verification: host the token OpenAI gives you as plain text at
  `https://mcp.decodo.com/.well-known/openai-apps-challenge`
- A justification for each tool's `readOnlyHint`, `openWorldHint` and `destructiveHint`

## References

- Packaging: <https://developers.openai.com/plugins/build/plugins>
- Submission: <https://developers.openai.com/plugins/deploy/submission>
- Validation errors: <https://developers.openai.com/plugins/deploy/submission-errors>
