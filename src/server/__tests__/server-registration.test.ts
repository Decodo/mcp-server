import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperAPIBaseServer } from '../sapi-base-server';
import { TOOLSET } from '../../constants';

const mockRegisterTool = jest.fn().mockReturnThis();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: mockRegisterTool,
  })),
}));

describe('Server registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('server metadata', () => {
    it('creates McpServer with correct name and version', () => {
      new ScraperAPIBaseServer({ auth: 'test', toolsets: [] });

      expect(McpServer).toHaveBeenCalledWith({
        name: 'decodo',
        version: '1.2.2',
      });
    });

    it('server instance is accessible', () => {
      const server = new ScraperAPIBaseServer({ auth: 'test', toolsets: [] });

      expect(server.server).toBeDefined();
    });
  });

  describe('tool registration', () => {
    it('registers all tools when no toolsets specified', () => {
      new ScraperAPIBaseServer({ auth: 'test', toolsets: [] });

      const expectedToolCount = ScraperAPIBaseServer.allTools.length;
      expect(mockRegisterTool).toHaveBeenCalledTimes(expectedToolCount);
    });

    it('registers only web toolset tools when web specified', () => {
      mockRegisterTool.mockClear();

      new ScraperAPIBaseServer({ auth: 'test', toolsets: [TOOLSET.WEB] });

      const webTools = ScraperAPIBaseServer.allTools.filter(t => t.toolset === TOOLSET.WEB);
      expect(mockRegisterTool).toHaveBeenCalledTimes(webTools.length);
    });

    it('registers only AI toolset tools when ai specified', () => {
      mockRegisterTool.mockClear();

      new ScraperAPIBaseServer({ auth: 'test', toolsets: [TOOLSET.AI] });

      const aiTools = ScraperAPIBaseServer.allTools.filter(t => t.toolset === TOOLSET.AI);
      expect(mockRegisterTool).toHaveBeenCalledTimes(aiTools.length);
    });

    it('registers multiple toolsets when specified', () => {
      mockRegisterTool.mockClear();

      new ScraperAPIBaseServer({ auth: 'test', toolsets: [TOOLSET.WEB, TOOLSET.AI] });

      const webTools = ScraperAPIBaseServer.allTools.filter(t => t.toolset === TOOLSET.WEB);
      const aiTools = ScraperAPIBaseServer.allTools.filter(t => t.toolset === TOOLSET.AI);
      expect(mockRegisterTool).toHaveBeenCalledTimes(webTools.length + aiTools.length);
    });

    it('each tool is registered with name and config', () => {
      mockRegisterTool.mockClear();

      new ScraperAPIBaseServer({ auth: 'test', toolsets: [] });

      const calls = mockRegisterTool.mock.calls;
      for (const call of calls) {
        const [toolName, config, handler] = call;
        expect(typeof toolName).toBe('string');
        expect(toolName.length).toBeGreaterThan(0);
        expect(config).toHaveProperty('description');
        expect(typeof handler).toBe('function');
      }
    });
  });

  describe('allTools static property', () => {
    it('contains expected number of tools', () => {
      expect(ScraperAPIBaseServer.allTools.length).toBeGreaterThan(20);
    });

    it('all tools have a toolset assigned', () => {
      for (const tool of ScraperAPIBaseServer.allTools) {
        expect(Object.values(TOOLSET)).toContain(tool.toolset);
      }
    });

    it('contains tools from each toolset', () => {
      const toolsets = new Set(ScraperAPIBaseServer.allTools.map(t => t.toolset));

      expect(toolsets.has(TOOLSET.WEB)).toBe(true);
      expect(toolsets.has(TOOLSET.SEARCH)).toBe(true);
      expect(toolsets.has(TOOLSET.ECOMMERCE)).toBe(true);
      expect(toolsets.has(TOOLSET.SOCIAL_MEDIA)).toBe(true);
      expect(toolsets.has(TOOLSET.AI)).toBe(true);
    });

    it('web toolset contains scrape_as_markdown and screenshot', () => {
      const webToolNames = ScraperAPIBaseServer.allTools
        .filter(t => t.toolset === TOOLSET.WEB)
        .map(t => t.constructor.name);

      expect(webToolNames).toContain('ScrapeAsMarkdownTool');
      expect(webToolNames).toContain('ScreenshotTool');
    });

    it('ai toolset contains chatgpt and perplexity', () => {
      const aiToolNames = ScraperAPIBaseServer.allTools
        .filter(t => t.toolset === TOOLSET.AI)
        .map(t => t.constructor.name);

      expect(aiToolNames).toContain('ChatGPTTool');
      expect(aiToolNames).toContain('PerplexityTool');
    });
  });

  describe('tool registration arguments', () => {
    it('passes auth to tool registration', () => {
      const auth = 'my-secret-token';
      const server = new ScraperAPIBaseServer({ auth, toolsets: [] });

      expect(server.auth).toBe(auth);
    });

    it('creates ScraperApiClient instance', () => {
      const server = new ScraperAPIBaseServer({ auth: 'test', toolsets: [] });

      expect(server.sapiClient).toBeDefined();
    });
  });
});
