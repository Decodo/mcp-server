---
name: getting-started
description: How to pick the right Decodo tool for a web data request - scraping a single page, searching the web, crawling or mapping a site, or pulling structured results from Google, Bing, Amazon, Walmart, Target, TikTok, YouTube, ChatGPT and Perplexity. Use this when a request needs live web data and it is not obvious which Decodo tool fits.
---

# Getting started with Decodo

Decodo fetches live web data through the Decodo Web Data API. It handles JavaScript
rendering, proxy rotation and anti-bot systems, so a request that would normally be
blocked still returns content.

Connecting the plugin signs you in to your Decodo account. Every call uses your Web
Data API plan, so prefer the narrowest tool that answers the question.

## Pick a tool

**You have a URL and want its content.** Use `scrape_as_markdown`. It returns the page
as Markdown. Use `screenshot` instead when the question is about how the page looks.

**You do not have a URL yet.** Use `search` to get ranked results with titles and
links, then pass the link you want to `scrape_as_markdown`.

**You need many pages from one site.** Use `map` to list the site's URLs without
fetching them, then scrape only the pages you need. Use `crawl_start` when you really
do want the content of many pages at once - it returns a crawl id immediately, and you
poll `crawl_status`, read with `crawl_results` and stop early with `crawl_cancel`.

**The site has a dedicated tool.** Prefer it over generic scraping, because it returns
parsed fields rather than raw page text:

- Search engines: `google_search`, `bing_search`, `google_ads`, `google_lens`
- AI answers: `google_ai_mode`, `chatgpt`, `perplexity`
- eCommerce: `amazon_search`, `amazon_product`, `amazon_pricing`, `amazon_sellers`,
  `amazon_bestsellers`, `walmart_search`, `walmart_product`, `target_search`,
  `target_product`, `tiktok_shop_search`, `tiktok_shop_product`, `tiktok_shop_url`
- Social and video: `youtube_search`, `youtube_metadata`, `youtube_channel`,
  `youtube_subtitles`, `tiktok_post`
- Travel: `google_travel_hotels`

## Geo-targeting

Most tools take a `geo` argument. Pass it whenever the answer depends on location -
local pricing, regional search results, or content that is only served in some
countries. Decodo covers 195+ locations.

## Keeping responses manageable

Pages and result sets can be large. `scrape_as_markdown` truncates very long pages and
accepts `tokenLimit` to cap it lower. `search`, `map` and `crawl_start` default to 10
results; raise the limit only when you need more.

## What Decodo does not do

Decodo reads public web pages. It does not sign in to accounts on your behalf, buy
anything, post content, or submit forms. If a request needs one of those, say so
instead of attempting it.
