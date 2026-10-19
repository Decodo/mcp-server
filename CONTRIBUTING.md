# Releases

Releases are automated. Merging to `main` publishes a new version based on the PR title, which must
follow [Conventional Commits](https://www.conventionalcommits.org): `fix:` → patch, `feat:` → minor,
`feat!:` or a `BREAKING CHANGE:` footer → major. `chore:`, `docs:`, `ci:`, `refactor:`, `test:`
don't release. Don't edit the version in `package.json` or `server.json`.

The `Release` workflow (`.github/workflows/publish.yml`) lints, builds and tests, then
semantic-release tags the commit, creates a GitHub Release with notes and publishes
`@decodo/mcp-server` to npm with trusted publishing (no token). After that, `server.json` is stamped
with the same version and published to the MCP registry with GitHub OIDC.

Running the workflow manually republishes the latest release to the MCP registry only, for when that
step failed after npm succeeded.
