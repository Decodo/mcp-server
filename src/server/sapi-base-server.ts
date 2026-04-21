import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ScraperApiClient } from '../clients/scraper-api-client';
import {
  AmazonSearchTool,
  ChatGPTTool,
  GoogleSearchTool,
  PerplexityTool,
  RedditPostTool,
  RedditSubredditTool,
  RedditUserTool,
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

  constructor({ toolsets = [] }: { toolsets: TOOLSET[] }) {
    this.server = new McpServer({
      name: 'decodo',
      version: '1.0.3',
    });
    this.sapiClient = new ScraperApiClient();

    this.registerTools({ toolsets });

    this.registerResources();
  }

  setAuthToken(token: string) {
    this.auth = token;
  }

  connect(transport: StdioServerTransport | StreamableHTTPServerTransport) {
    this.server.connect(transport);
  }

  static allTools: Tool[] = [
    new ScrapeAsMarkdownTool(),
    new ScreenshotTool(),
    new GoogleSearchTool(),
    new AmazonSearchTool(),
    new RedditPostTool(),
    new RedditSubredditTool(),
    new RedditUserTool(),
    new ChatGPTTool(),
    new PerplexityTool(),
  ];

  registerTools({ toolsets }: { toolsets: TOOLSET[] }) {
    if (toolsets.length === 0) {
      this.registerAllTools();
      return;
    }

    const getAuthToken = () => this.auth;

    for (const toolset of toolsets) {
      const tools = ScraperAPIBaseServer.allTools.filter(tool => tool.toolset === toolset);
      for (const tool of tools) {
        tool.register({ server: this.server, sapiClient: this.sapiClient, getAuthToken });
      }
    }
  }

  registerAllTools() {
    const getAuthToken = () => this.auth;

    for (const tool of ScraperAPIBaseServer.allTools) {
      tool.register({ server: this.server, sapiClient: this.sapiClient, getAuthToken });
    }
  }

  registerResources() {
    // todo: expose info about all targets available
  }
}
