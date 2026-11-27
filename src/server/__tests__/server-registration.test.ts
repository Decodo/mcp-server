import { BundledSchema } from '@decodo/sdk-ts';
import { AUTH_TYPE } from '../../auth';
import type { AuthCredential } from '../../auth';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ScraperAPIBaseServer } from '../sapi-base-server';
import { TOOLSET } from '../../constants';
import { PACKAGE_VERSION } from '../../version';

const testAuth: AuthCredential = { type: AUTH_TYPE.TOKEN, value: 'test' };
const apiKeyAuth: AuthCredential = { type: AUTH_TYPE.API_KEY, value: 'test' };

const mockRegisterTool = jest.fn().mockReturnThis();

jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => ({
  McpServer: jest.fn().mockImplementation(() => ({
    registerTool: mockRegisterTool,
  })),
}));

const registeredToolNames = () => mockRegisterTool.mock.calls.map(([name]) => name);

const surfaceTools = BundledSchema.shared.getSurface('mcp')?.tools ?? [];

const namesIn = (...groups: TOOLSET[]) =>
  surfaceTools.filter(tool => groups.includes(tool.group as TOOLSET)).map(tool => tool.name);

describe('Server registration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates McpServer with correct name and version', () => {
    new ScraperAPIBaseServer({ auth: testAuth, toolsets: [] });

    expect(McpServer).toHaveBeenCalledWith({ name: 'decodo', version: PACKAGE_VERSION });
  });

  it('registers every tool of the surface when no toolsets are given', () => {
    new ScraperAPIBaseServer({ auth: apiKeyAuth, toolsets: [] });

    expect(registeredToolNames()).toEqual(surfaceTools.map(tool => tool.name));
  });

  it('registers only the tools of the given toolsets', () => {
    new ScraperAPIBaseServer({ auth: apiKeyAuth, toolsets: [TOOLSET.WEB, TOOLSET.AI] });

    expect(registeredToolNames()).toEqual(namesIn(TOOLSET.WEB, TOOLSET.AI));
  });

  it('registers the data API tools for basic tokens too, so calls can explain the API key requirement', () => {
    new ScraperAPIBaseServer({ auth: testAuth, toolsets: [] });

    expect(registeredToolNames()).toEqual(
      expect.arrayContaining([
        'search',
        'map',
        'crawl_start',
        'crawl_status',
        'crawl_results',
        'crawl_cancel',
      ])
    );
  });

  it('registers each tool with a description and a handler', () => {
    new ScraperAPIBaseServer({ auth: testAuth, toolsets: [] });

    for (const [name, config, handler] of mockRegisterTool.mock.calls) {
      expect(name).toEqual(expect.any(String));
      expect(config.description).toEqual(expect.any(String));
      expect(handler).toEqual(expect.any(Function));
    }
  });

  it('builds the tools of the surface named by the integration header', () => {
    const server = new ScraperAPIBaseServer({
      auth: apiKeyAuth,
      toolsets: [],
      integrationHeader: 'mcp-hosted',
    });

    expect(server.surface).toBe('mcp-hosted');
    expect(registeredToolNames()).toEqual(
      BundledSchema.shared.getSurface('mcp-hosted')?.tools.map(tool => tool.name)
    );
  });

  it('uses the default surface for a channel the IR has no surface for', () => {
    const server = new ScraperAPIBaseServer({
      auth: apiKeyAuth,
      toolsets: [],
      integrationHeader: 'mcp-smithery',
    });

    expect(server.surface).toBe('mcp');
    expect(server.sapiClient.integrationHeader).toBe('mcp-smithery');
    expect(registeredToolNames()).toEqual(surfaceTools.map(tool => tool.name));
  });

  it('uses the bundled IR when the loaded one has no surfaces', () => {
    const withoutSurfaces = Object.assign(Object.create(BundledSchema.shared), {
      getSurface: () => undefined,
    });

    const server = new ScraperAPIBaseServer({
      auth: apiKeyAuth,
      toolsets: [],
      schema: withoutSurfaces,
    });

    expect(server.schema).toBe(BundledSchema.shared);
    expect(registeredToolNames()).toEqual(surfaceTools.map(tool => tool.name));
  });

  it("keeps a channel's own surface from the bundled IR when the loaded one lacks it", () => {
    const onlyDefault = Object.assign(Object.create(BundledSchema.shared), {
      version: '0.0.1',
      getSurface: (name: string) => BundledSchema.shared.getSurface(name === 'mcp' ? name : ''),
    });
    const write = jest.spyOn(process.stderr, 'write').mockReturnValue(true);

    for (let request = 0; request < 3; request++) {
      new ScraperAPIBaseServer({
        auth: apiKeyAuth,
        toolsets: [],
        schema: onlyDefault,
        integrationHeader: 'mcp-hosted',
      });
    }
    const warnings = write.mock.calls.filter(([line]) => String(line).includes('surface_fallback'));
    write.mockRestore();

    expect(registeredToolNames()).not.toContain('chatgpt');
    expect(warnings).toHaveLength(1);
  });
});
