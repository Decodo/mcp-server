# Publishing

Releases are cut by bumping the version on `main`. The `Release` workflow
(`.github/workflows/publish.yml`) publishes to npm and to the MCP registry whenever a push to
`main` changes the version in `package.json`.

To release:

- Bump the version in both `package.json` and `server.json` (major, minor or patch). The workflow
  refuses to publish when the two disagree.

- Merge to `main`. The workflow lints, builds, tests, publishes `@decodo/mcp-server` to npm with
  trusted publishing (no token), then publishes `server.json` to the MCP registry with GitHub OIDC.

- A push that does not change the version, or a version already on npm, is skipped.

Several merged changes can share one release: bump the version only when you want to publish.
