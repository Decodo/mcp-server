# Decodo MCP Server

[![](https://dcbadge.limes.pink/api/server/https://discord.gg/Ja8dqKgvbZ)](https://discord.gg/Ja8dqKgvbZ)
[![Install MCP Server](https://cursor.com/deeplink/mcp-install-dark.svg)](https://cursor.com/en-US/install-mcp?name=Decodo&config=eyJ1cmwiOiJodHRwczovL21jcC5kZWNvZG8uY29tL21jcCIsImhlYWRlcnMiOnsiQXV0aG9yaXphdGlvbiI6IkJhc2ljIDx3ZWJfYWR2YW5jZWRfdG9rZW4%2BIn19)
[![smithery badge](https://smithery.ai/badge/@Decodo/decodo-mcp-server)](https://smithery.ai/server/@Decodo/decodo-mcp-server)

<p align="center">
<a href="https://dashboard.decodo.com/integrations?utm_source=github&utm_medium=social&utm_campaign=mcp_server"> <img src="https://github.com/user-attachments/assets/a1e52a9e-3da1-4081-b3c6-053aafb8f196"/></a>

This repository provides a Model Context Protocol (MCP) server that connects LLMs and applications
to Decodo's platform. The server facilitates integration between MCP-compatible clients and Decodo's
services, streamlining access to our tools and capabilities.

## Features

- Easy web data access. Simplified retrieval of information from websites and online sources.
- Geographic flexibility. Access content regardless of regional restrictions.
- Enhanced privacy. Browse and collect data while maintaining anonymity.
- Reliable scraping. Advanced techniques to avoid detection and blocks.
- Simple integration. Seamless setup with popular MCP clients like Claude Desktop, Cursor, and
  Windsurf.

## Connecting to [Decodo's MCP server](https://mcp.decodo.com/mcp)

1. Go to [decodo.com](https://decodo.com/scraping/web) and start a Web Scraping API plan (free
   trials available).

2. Once your plan has started, obtain a Web Scraping API basic authentication token from the
   [dashboard](https://dashboard.decodo.com/).

3. Open your preferred MCP client and add the following configuration:

```
{
  "Decodo": {
    "url": "https://mcp.decodo.com/mcp",
    "headers": {
      "Authorization": "Basic <basic_auth_token>"
    }
  }
}
```

## Running the MCP server locally

<details>

### Prerequisites

- Node.js 18.0+
- An MCP client - popular choices are [Claude Desktop](https://claude.ai/download) and
  [Cursor](https://www.cursor.com/)

### Step-by-step guide

1. Clone this repository:

```
git clone https://github.com/Decodo/decodo-mcp-server
```

2. Run the following commands in the terminal:

```
cd decodo-mcp-server
npm install
npm run build
```

3. Take note of your build location:

```
cd build/
pwd
```

Adding `index.js` to the end of this directory, your build file location should look something like
this:

```
/Users/your.user/projects/decodo-mcp/build/index.js
```

4. Update your MCP client with the server information:

</details>

## Toolsets

Tools are organized into toolsets. You can selectively enable specific toolsets by passing a
comma-separated list via the `toolsets` query parameter:

```
    "Decodo MCP Server": {
      "url": "https://mcp.decodo.com/mcp?toolsets=web,ai",
      "headers": {
        "Authorization": "Basic <your_auth_token>"
      }
    }
```

When no toolsets are specified, all tools are registered.

| Toolset        | Tools                               |
| -------------- | ----------------------------------- |
| `web`          | `scrape_as_markdown`, `screenshot`, |
| `search`       | `google_search_parsed`              |
| `ecommerce`    | `amazon_search_parsed`              |
| `social_media` | `reddit_post`, `reddit_subreddit`   |
| `ai`           | `chatgpt`, `perplexity`             |

## Tools

The server exposes the following tools:

| Tool                   | Description                                                                                | Example prompt                                                                          |
| ---------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `scrape_as_markdown`   | Scrapes any target URL, expects a URL to be given via prompt. Returns results in Markdown. | Scrape peacock.com from a US IP address and tell me the pricing.                        |
| `screenshot`           | Captures a screenshot of any webpage and returns it as a PNG image.                        | Take a screenshot of github.com from a US IP address.                                   |
| `google_search_parsed` | Scrapes Google Search for a given query, and returns parsed results.                       | Scrape Google Search for shoes and tell me the top position.                            |
| `amazon_search_parsed` | Scrapes Amazon Search for a given query, and returns parsed results.                       | Scrape Amazon Search for toothbrushes.                                                  |
| `reddit_post`          | Scrapes a specific Reddit post for a given query, and returns parsed results.              | Scrape the following Reddit post: https://www.reddit.com/r/horseracing/comments/1nsrn3/ |
| `reddit_subreddit`     | Scrapes a specific Reddit subreddit for a given query, and returns parsed results.         | Scrape the top 5 posts on r/Python this week.                                           |
| `chatgpt`              | Search and interact with ChatGPT for AI-powered responses and conversations.               | Ask ChatGPT to explain quantum computing in simple terms.                               |
| `perplexity`           | Search and interact with Perplexity for AI-powered responses and conversations.            | Ask Perplexity what the latest trends in web development are.                           |

## Parameters

The following parameters are inferred from user prompts:

| Parameter    | Description                                                                             |
| ------------ | --------------------------------------------------------------------------------------- |
| `jsRender`   | Renders target URL in a headless browser.                                               |
| `geo`        | Sets the country from which the request will originate.                                 |
| `locale`     | Sets the locale of the request.                                                         |
| `tokenLimit` | Truncates the response content up to this limit. Useful if the context window is small. |
| `prompt`     | Prompt to send to AI tools (`chatgpt`, `perplexity`).                                   |
| `search`     | Activates ChatGPT's web search functionality (`chatgpt` only).                          |

## Examples

### Scraping geo-restricted content

Query your AI agent with the following prompt:

```
Scrape peacock.com from a German IP address and tell me the pricing.
```

This prompt will say that peacock.com is geo-restricted. To bypass the geo-restriction:

```
Scrape peacock.com from a US IP address and tell me the pricing.
```

### Limiting number of response tokens

If your agent has a small context window, the content returned from scraping will be automatically
truncated, in order to avoid context-overflow. You can increase the number of tokens returned within
your prompt:

```
Scrape hacker news, return 50k tokens.
```

If your agent has a big context window, tell it to return `full content`:

```
Scrape hacker news, return full content.
```

## Related repositories

[Web Scraping API](https://github.com/Decodo/Web-Scraping-API)

[Google Maps scraper](https://github.com/Decodo/google-maps-scraper)

[Amazon scraper](https://github.com/Decodo/Amazon-scraper)

## License

All code is released under the [MIT License](https://github.com/Decodo/Decodo/blob/master/LICENSE).
