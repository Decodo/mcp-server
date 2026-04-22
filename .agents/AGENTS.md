When a new target is added to Decodo utils, transform that target into a tool usable within the MCP
server. The specific steps:

- Make a new folder in `src/tools`
- Name the tool the same as the target name.
- Add the target to an existing toolset. If none of the existing toolsets fit the target, either
  raise an issue or add the tool to the `web` toolset.
- Only add the top 5 parameters for each target. These will likely be `url`, `query`, `geo`, `local`
  and `jsRender`.
- Make sure to map `jsRender` to `headless: "html"`.
- Add tests that check successful and usuccessful tool calls.
- Update readme with new tool, toolset and parameter information.
