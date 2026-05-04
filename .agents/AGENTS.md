When a new target is added to Decodo utils, transform that target into a tool usable within the MCP
server.

# Generation

- Make sure you actually see the target configuration from which we'll build the tool. Do not guess
  the tool setup.
- You can find the target configuration in smartproxy-dashboard/repos/utils/scraping.
- Make a new folder in `src/tools`.
- Name the tool the same as the target name.
- Add the target to an existing toolset. If none of the existing toolsets fit the target, either
  raise an issue or add the tool to the `web` toolset.

# Parameters

- Only add the top 7 parameters for each target. These will likely be `url`, `query`, `geo`, `local`
  and `jsRender`.
- For `url` and `query`, make sure to add an example of a correct input inside the description.
- Make sure to map `jsRender` to `headless: "html"`.
- Only set `parse: true` if the target actually supports parsing.
- Never add the `output` parameter.
- If a target has a `markdown` parameter, always set it to `true`.
- If both `parse` and `markdown` are available as parameters, prefer to use `markdown: true`.

# Testing

- Add tests that check successful and unsuccessful tool calls.
- After generating the tool, call the tool to actually test it.
- When testing by calling the tool, prefer to not set the `jsRender` parameter.

# Releasing

- When bumping server versions, make sure all instances of the old server version are updated. These
  are in `package.json`, `server.json` and possibly in other files.

# Documentation

- Update readme with new tool, toolset and parameter information.
