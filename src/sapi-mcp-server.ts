import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScraperApiClient } from './clients/scraper-api-client';
import { ProxyApiClient } from './clients/proxy-api-client';
import {
  AmazonSearchParsedTool,
  GoogleSearchParsedTool,
  RedditPostTool,
  RedditSubredditTool,
  ScrapeAsMarkdownTool,
  ListWhitelistedIpsTool,
  AddWhitelistedIpsTool,
  RemoveWhitelistedIpTool,
} from './tools';

export class ScraperAPIMCPServer {
  server: McpServer;

  sapiClient: ScraperApiClient;

  proxyClient: ProxyApiClient | null;

  constructor({
    sapiUsername,
    sapiPassword,
    decodoApiKey,
  }: {
    sapiUsername: string;
    sapiPassword: string;
    decodoApiKey?: string;
  }) {
    this.server = new McpServer({
      name: 'decodo',
      version: '0.1.0',
      capabilities: {
        logging: {},
        resources: {},
        tools: {},
      },
    });

    const auth = Buffer.from(`${sapiUsername}:${sapiPassword}`).toString('base64');

    this.sapiClient = new ScraperApiClient({ auth });
    this.proxyClient = decodoApiKey ? new ProxyApiClient({ apiKey: decodoApiKey }) : null;

    this.registerTools();
    this.registerResources();
  }

  connect(transport: StdioServerTransport) {
    this.server.connect(transport);
  }

  registerTools() {
    // scrape
    ScrapeAsMarkdownTool.register({ server: this.server, sapiClient: this.sapiClient });

    // targets
    GoogleSearchParsedTool.register({ server: this.server, sapiClient: this.sapiClient });
    AmazonSearchParsedTool.register({ server: this.server, sapiClient: this.sapiClient });
    RedditPostTool.register({ server: this.server, sapiClient: this.sapiClient });
    RedditSubredditTool.register({ server: this.server, sapiClient: this.sapiClient });

    // proxy management (requires DECODO_API_KEY)
    if (this.proxyClient) {
      ListWhitelistedIpsTool.register({ server: this.server, proxyClient: this.proxyClient });
      AddWhitelistedIpsTool.register({ server: this.server, proxyClient: this.proxyClient });
      RemoveWhitelistedIpTool.register({ server: this.server, proxyClient: this.proxyClient });
    }
  }

  registerResources() {
    // todo: expose info about all targets available
  }
}
