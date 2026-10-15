export const DIRECTORY_HIDDEN_TOOLS: readonly string[] = [
  'google_lens',
  'bing_search',
  'tiktok_post',
  'tiktok_shop_url',
  'youtube_search',
  'google_ads',
  'reddit_post',
  'reddit_subreddit',
  'reddit_user',
  'target_product',
  'chatgpt',
  'perplexity',
];

export const hiddenToolsFromEnv = (value: string | undefined): ReadonlySet<string> => {
  if (value === undefined) {
    return new Set(DIRECTORY_HIDDEN_TOOLS);
  }

  return new Set(
    value
      .split(',')
      .map(name => name.trim())
      .filter(Boolean)
  );
};
