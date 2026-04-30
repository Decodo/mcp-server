import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import pkg from '../../package.json';
import { ScraperApiClient } from '../clients/scraper-api-client';
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
} from '../tools';
import { Tool } from '../tools/tool';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TOOLSET } from '../constants';

export class ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  auth: string = '';

  constructor({ auth, toolsets = [] }: { auth: string; toolsets: TOOLSET[] }) {
    this.server = new McpServer({
      name: 'decodo',
      version: pkg.version,
    });
    this.sapiClient = new ScraperApiClient();

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
    if (toolsets.length === 0) {
      this.registerAllTools();
      return;
    }

    for (const toolset of toolsets) {
      const tools = ScraperAPIBaseServer.allTools.filter(tool => tool.toolset === toolset);
      for (const tool of tools) {
        tool.register({ server: this.server, sapiClient: this.sapiClient, auth: this.auth });
      }
    }
  }

  registerAllTools() {
    for (const tool of ScraperAPIBaseServer.allTools) {
      tool.register({ server: this.server, sapiClient: this.sapiClient, auth: this.auth });
    }
  }

  registerResources() {
    // todo: expose info about all targets available
  }
}
