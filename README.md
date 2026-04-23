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

| Toolset        | Tools                                                                                                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `web`          | `scrape_as_markdown`, `screenshot`                                                                                                                                                  |
| `search`       | `google_search`, `google_ads`, `google_lens`, `google_travel_hotels`, `bing_search`                                                                                                |
| `ecommerce`    | `amazon_search`, `amazon_product`, `amazon_pricing`, `amazon_sellers`, `amazon_bestsellers`, `walmart_search`, `walmart_product`, `target_search`, `target_product`, `tiktok_shop_search`, `tiktok_shop_product`, `tiktok_shop_url` |
| `social_media` | `reddit_post`, `reddit_subreddit`, `reddit_user`, `tiktok_post`, `youtube_metadata`, `youtube_channel`, `youtube_subtitles`, `youtube_search`                    |
| `ai`           | `chatgpt`, `perplexity`, `google_ai_mode`                                                                                                                                           |

## Tools

The server exposes the following tools:

| Tool                    | Description                                                                                | Example prompt                                                                          |
| ----------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| `scrape_as_markdown`    | Scrapes any target URL, expects a URL to be given via prompt. Returns results in Markdown. | Scrape peacock.com from a US IP address and tell me the pricing.                        |
| `screenshot`            | Captures a screenshot of any webpage and returns it as a PNG image.                        | Take a screenshot of github.com from a US IP address.                                   |
| `google_search`         | Scrapes Google Search for a given query, and returns parsed results.                       | Scrape Google Search for shoes and tell me the top position.                            |
| `google_ads`            | Scrapes Google Ads search results with automatic parsing.                                  | Scrape Google Ads for laptop and show me the top ads.                                   |
| `google_lens`           | Scrapes Google Lens image search results with automatic parsing.                           | Search Google Lens for this image: https://example.com/image.jpg                        |
| `google_ai_mode`        | Scrapes Google AI Mode (Search with AI) results with automatic parsing.                    | Ask Google AI Mode: What are the top three dog breeds?                                  |
| `google_travel_hotels`  | Scrapes Google Travel Hotels search results.                                               | Search Google Travel Hotels for hotels in Paris.                                        |
| `amazon_search`         | Scrapes Amazon Search for a given query, and returns parsed results.                       | Scrape Amazon Search for wireless keyboard.                                             |
| `amazon_product`        | Scrapes Amazon Product page with automatic parsing.                                        | Scrape Amazon product B09H74FXNW and show me the details.                               |
| `amazon_pricing`        | Scrapes Amazon Product pricing information with automatic parsing.                         | Get pricing for Amazon product B09H74FXNW.                                              |
| `amazon_sellers`        | Scrapes Amazon Seller information with automatic parsing.                                  | Get information about Amazon seller A1R0Z7FJGTKESH.                                     |
| `amazon_bestsellers`    | Scrapes Amazon Bestsellers list with automatic parsing.                                    | Show me Amazon bestsellers in electronics.                                              |
| `walmart_search`        | Scrapes Walmart Search for a given query, and returns parsed results.                      | Scrape Walmart Search for camping tent.                                                 |
| `walmart_product`       | Scrapes Walmart Product page with automatic parsing.                                       | Scrape Walmart product 15296401808.                                                     |
| `target_search`         | Scrapes Target Search for a given query, and returns parsed results.                       | Scrape Target Search for kitchen appliances.                                            |
| `target_product`        | Scrapes Target Product page with automatic parsing.                                        | Scrape Target product 92186007.                                                         |
| `tiktok_post`           | Scrapes a TikTok post URL for structured data (e.g. engagement, caption, hashtags).        | Scrape this TikTok post: https://www.tiktok.com/@nba/video/7393013274725403950          |
| `tiktok_shop_search`    | Scrapes TikTok Shop Search for a given query, and returns parsed results.                  | Scrape TikTok Shop Search for phone cases.                                              |
| `tiktok_shop_product`   | Scrapes TikTok Shop Product page.                                                          | Scrape TikTok Shop product 1731541214379741272.                                         |
| `tiktok_shop_url`       | Scrapes TikTok Shop page by URL.                                                           | Scrape this TikTok Shop URL: https://www.tiktok.com/shop/s?q=HEADPHONES                 |
| `youtube_metadata`      | Scrapes YouTube video metadata.                                                            | Get metadata for YouTube video dFu9aKJoqGg.                                             |
| `youtube_channel`       | Scrapes YouTube channel videos with automatic parsing.                                     | Scrape YouTube channel @decodo_official.                                                |
| `youtube_subtitles`     | Scrapes YouTube video subtitles.                                                           | Get subtitles for YouTube video L8zSWbQN-v8.                                            |
| `youtube_search`        | Search YouTube videos.                                                                     | Search YouTube for "How to care for chinchillas".                                       |
| `reddit_post`           | Scrapes a specific Reddit post for a given query, and returns parsed results.              | Scrape the following Reddit post: https://www.reddit.com/r/horseracing/comments/1nsrn3/ |
| `reddit_subreddit`      | Scrapes a specific Reddit subreddit for a given query, and returns parsed results.         | Scrape the top 5 posts on r/Python this week.                                           |
| `reddit_user`           | Scrapes a Reddit user profile and their posts or comments.                                 | Scrape Reddit user u/spez's profile.                                                    |
| `bing_search`           | Scrapes Bing Search results with automatic parsing.                                        | Search Bing for laptop reviews.                                                         |
| `chatgpt`               | Search and interact with ChatGPT for AI-powered responses and conversations.               | Ask ChatGPT to explain quantum computing in simple terms.                               |
| `perplexity`            | Search and interact with Perplexity for AI-powered responses and conversations.            | Ask Perplexity what the latest trends in web development are.                           |

## Parameters

The following parameters are inferred from user prompts:

| Parameter    | Description                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------- |
| `jsRender`   | Renders target URL in a headless browser.                                                             |
| `geo`        | Sets the country from which the request will originate.                                               |
| `locale`     | Sets the locale of the request.                                                                       |
| `tokenLimit` | Truncates the response content up to this limit. Useful if the context window is small.               |
| `prompt`     | Prompt to send to AI tools (`chatgpt`, `perplexity`).                                                 |
| `search`     | Activates ChatGPT's web search functionality (`chatgpt` only).                                        |
| `xhr`        | When true, includes XHR or fetch responses in the scrape result where supported (e.g. `tiktok_post`). |

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
