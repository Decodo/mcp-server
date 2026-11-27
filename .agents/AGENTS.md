The server's tools are generated from the Decodo IR, not written by hand. Each channel lists the
tools of its surface in the IR: `mcp` for the local server, `mcp-docker` for the Docker MCP Catalog
image and `mcp-hosted` for the hosted server. The surfaces are defined in decodo-dashboard, in
`repos/utils/src/ir/surfaces/mcp.ts`.

# Adding or changing a tool

- Add or change the tool in the IR surface, then publish a new IR. Running servers pick it up when
  they next load the IR; no server release is needed.
- The IR gives each tool its name, description, toolset (`group`), inputs, fixed and default values,
  result rules and reply limits. Inputs use the API's own parameter names.
- Change this server only for what the IR cannot describe, in `EXTENSIONS` in
  `src/surface/surface-tools.ts`: inputs that never reach the API (such as `tokenLimit`), or how a
  reply is shaped for a model (Markdown conversion, dropping long fields, picking fields).

# Testing

- Add tests in `src/surface/__tests__` for any extension you add or change.
- After changing a tool, call it against the real API to check it works. `DECODO_IR_URL` points the
  server at an unpublished IR, such as a `file:` URL to a local build.

# Releasing

- Never bump versions. Releases are automated from the PR title, which must follow Conventional
  Commits; see `CONTRIBUTING.md`.

# Documentation

- Update the README with new tools, toolsets and parameters.
