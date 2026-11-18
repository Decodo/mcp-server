# Smithery MCPB bundle

Publishing to [Smithery](https://smithery.ai) requires either OAuth support or a
`.mcpb` bundle under 25MB (see SCR-3048). This folder provides a minimal stdio
bundle that launches the npm-published `@decodo/mcp-server`, keeping the bundle a
few hundred bytes instead of embedding `node_modules`.

## Workaround note

Smithery currently rejects stdio bundles whose manifest omits `tools` with
`400 {"error":"No values to set"}` ([smithery-ai/cli#770](https://github.com/smithery-ai/cli/issues/770)).
The manifest here includes an explicit `"tools": []` so the release payload is
accepted. Runtime tool discovery is unaffected.

## Publish

```bash
# from the repo root
npx @anthropic-ai/mcpb pack smithery decodo-mcp.mcpb
npx smithery auth login            # if not already authenticated
npx smithery mcp publish ./decodo-mcp.mcpb -n Decodo/mcp-server
```

Keep `version` in `manifest.json` in sync with `package.json` before publishing.
