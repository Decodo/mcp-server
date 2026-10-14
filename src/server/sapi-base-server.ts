import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RegisteredTool } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
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
    hiddenTools = new Set(),
    onAuthenticationError,
    integrationHeader,
  }: {
    auth: AuthCredential;
    toolsets: TOOLSET[];
    hiddenTools?: ReadonlySet<string>;
    onAuthenticationError?: AuthenticationErrorListener;
    integrationHeader?: string;
  }) {
    this.server = new McpServer({
      name: 'decodo',
      version: PACKAGE_VERSION,
    });
    this.sapiClient = new ScraperApiClient({ onAuthenticationError, integrationHeader });

    this.auth = auth;

    this.disableOnRegister(hiddenTools);

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

  private disableOnRegister(hiddenTools: ReadonlySet<string>) {
    if (hiddenTools.size === 0) {
      return;
    }

    const registerTool = this.server.registerTool.bind(this.server) as (
      name: string,
      ...config: unknown[]
    ) => RegisteredTool;

    this.server.registerTool = ((name: string, ...config: unknown[]) => {
      const tool = registerTool(name, ...config);

      if (hiddenTools.has(name)) {
        tool.disable();
      }

      return tool;
    }) as McpServer['registerTool'];
  }

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
