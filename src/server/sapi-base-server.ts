import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import {
  AmazonSearchParsedTool,
  GoogleSearchParsedTool,
  RedditPostTool,
  RedditSubredditTool,
  ScrapeAsMarkdownTool,
  ScreenshotTool,
} from '../tools';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export class ScraperAPIBaseServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  auth: string = '';

  constructor() {
    this.server = new McpServer({
      name: 'decodo',
      version: '1.0.3',
    });
    this.sapiClient = new ScraperApiClient();

    this.registerTools();

    this.registerResources();
  }

  setAuthToken(token: string) {
    this.auth = token;
  }

  connect(transport: StdioServerTransport | StreamableHTTPServerTransport) {
    this.server.connect(transport);
  }

  registerTools() {
    const getAuthToken = () => this.auth;

    // scrape
    ScrapeAsMarkdownTool.register({
      server: this.server,
      sapiClient: this.sapiClient,
      getAuthToken,
    });

    // targets
    GoogleSearchParsedTool.register({
      server: this.server,
      sapiClient: this.sapiClient,
      getAuthToken,
    });
    AmazonSearchParsedTool.register({
      server: this.server,
      sapiClient: this.sapiClient,
      getAuthToken,
    });
    RedditPostTool.register({ server: this.server, sapiClient: this.sapiClient, getAuthToken });
    RedditSubredditTool.register({
      server: this.server,
      sapiClient: this.sapiClient,
      getAuthToken,
    });
    ScreenshotTool.register({
      server: this.server,
      sapiClient: this.sapiClient,
      getAuthToken,
    });
  }

  registerResources() {
    // todo: expose info about all targets available
  }
}
