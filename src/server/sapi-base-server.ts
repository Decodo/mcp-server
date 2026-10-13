import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { AUTH_TYPE } from '../auth';
import type { AuthCredential } from '../auth';
import { ScraperApiClient } from '../clients/scraper-api-client';
import type { AuthenticationErrorListener } from '../clients/scraper-api-client';
import { PACKAGE_VERSION } from '../version';
import {
  AmazonSearchTool,
  AmazonProductTool,
  AmazonPricingTool,
  AmazonSellersTool,
  AmazonBestsellersTool,
  BingSearchTool,
  ChatGPTTool,
  GoogleSearchTool,
  GoogleAdsTool,
  GoogleLensTool,
  GoogleAiModeTool,
  GoogleTravelHotelsTool,
  PerplexityTool,
  RedditPostTool,
  RedditSubredditTool,
  RedditUserTool,
  TargetSearchTool,
  TargetProductTool,
  TiktokPostTool,
  TiktokShopSearchTool,
  TiktokShopProductTool,
  TiktokShopUrlTool,
  WalmartSearchTool,
  WalmartProductTool,
  YoutubeMetadataTool,
  YoutubeChannelTool,
  YoutubeSubtitlesTool,
  YoutubeSearchTool,
  ScrapeAsMarkdownTool,
  ScreenshotTool,
  SearchTool,
  MapTool,
  CrawlStartTool,
  CrawlStatusTool,
  CrawlResultsTool,
} from '../tools';
import { Tool } from '../tools/tool';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TOOLSET } from '../constants';

export class ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  auth: AuthCredential;

  constructor({
    auth,
    toolsets = [],
    onAuthenticationError,
    integrationHeader,
  }: {
    auth: AuthCredential;
    toolsets: TOOLSET[];
    onAuthenticationError?: AuthenticationErrorListener;
    integrationHeader?: string;
  }) {
    this.server = new McpServer({
      name: 'decodo',
      version: PACKAGE_VERSION,
    });
    this.sapiClient = new ScraperApiClient({ onAuthenticationError, integrationHeader });

    this.auth = auth;

    this.registerTools({ toolsets });

    this.registerResources();
  }

  connect(transport: StdioServerTransport | StreamableHTTPServerTransport) {
    this.server.connect(transport);
  }

  static allTools: Tool[] = [
    new ScrapeAsMarkdownTool(),
    new ScreenshotTool(),
    new MapTool(),
    new CrawlStartTool(),
    new CrawlStatusTool(),
    new CrawlResultsTool(),
    new SearchTool(),
    new GoogleSearchTool(),
    new GoogleAdsTool(),
    new GoogleLensTool(),
    new GoogleAiModeTool(),
    new GoogleTravelHotelsTool(),
    new AmazonSearchTool(),
    new AmazonProductTool(),
    new AmazonPricingTool(),
    new AmazonSellersTool(),
    new AmazonBestsellersTool(),
    new WalmartSearchTool(),
    new WalmartProductTool(),
    new TargetSearchTool(),
    new TargetProductTool(),
    new TiktokPostTool(),
    new TiktokShopSearchTool(),
    new TiktokShopProductTool(),
    new TiktokShopUrlTool(),
    new YoutubeMetadataTool(),
    new YoutubeChannelTool(),
    new YoutubeSubtitlesTool(),
    new YoutubeSearchTool(),
    new RedditPostTool(),
    new RedditSubredditTool(),
    new RedditUserTool(),
    new BingSearchTool(),
    new ChatGPTTool(),
    new PerplexityTool(),
  ];

  registerTools({ toolsets }: { toolsets: TOOLSET[] }) {
    const isRequested = (tool: Tool) => toolsets.length === 0 || toolsets.includes(tool.toolset);
    const isUsableWithAuth = (tool: Tool) =>
      !tool.requiresApiKey || this.auth.type === AUTH_TYPE.API_KEY;

    const tools = ScraperAPIBaseServer.allTools.filter(
      tool => isRequested(tool) && isUsableWithAuth(tool)
    );

    for (const tool of tools) {
      tool.register({ server: this.server, sapiClient: this.sapiClient, auth: this.auth });
    }
  }

  registerResources() {
    // todo: expose info about all targets available
  }
}
