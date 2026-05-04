# Publishing

When After merging changes to the server, the following steps need to be done:

1. Server version bump (major/minor/patch)

2. Publish to MCP registry.

## Server version bump

Publishing is done manually through a developer machine. This enabled bundling multiple
features/fixes under one release.

When you want to publish a new version:

- Pull `main` locally.

- Bump the server version numbers in the following files: `package.json`, `server.json`. Note that
  there may be more files where the version number

- Choose between major, minor or patch bump accordingly.

- Run `npm publish`. This command should instruct you how to authenticate with NPM. The full command
  should look like this:

```
NPM_CONFIG__AUTHTOKEN=<one_time_token>npm publish --access public
```
