import { AUTH_TYPE } from '../../auth';
import { ScraperAPIStdioServer } from '../sapi-stdio-server';
import { parseStdioEnv, STDIO_INTEGRATION_HEADER } from '../stdio-env';

const API_KEY = 'sk-live-abc123';
const BASIC_TOKEN = 'dGVzdHVzZXI6dGVzdHBhc3M=';

describe('parseStdioEnv', () => {
  describe('credential', () => {
    it('reads an API key from DECODO_API_KEY', () => {
      expect(parseStdioEnv({ DECODO_API_KEY: API_KEY }).auth).toEqual({
        type: AUTH_TYPE.API_KEY,
        value: API_KEY,
      });
    });

    it('prefers DECODO_API_KEY over SCRAPER_API_TOKEN', () => {
      expect(
        parseStdioEnv({ DECODO_API_KEY: API_KEY, SCRAPER_API_TOKEN: BASIC_TOKEN }).auth
      ).toEqual({ type: AUTH_TYPE.API_KEY, value: API_KEY });
    });

    it('falls back to SCRAPER_API_TOKEN when DECODO_API_KEY is blank', () => {
      expect(parseStdioEnv({ DECODO_API_KEY: ' ', SCRAPER_API_TOKEN: BASIC_TOKEN }).auth).toEqual({
        type: AUTH_TYPE.TOKEN,
        value: BASIC_TOKEN,
      });
    });

    it('reads an API key from SCRAPER_API_TOKEN', () => {
      expect(parseStdioEnv({ SCRAPER_API_TOKEN: API_KEY }).auth).toEqual({
        type: AUTH_TYPE.API_KEY,
        value: API_KEY,
      });
    });

    it('reads a basic auth token from SCRAPER_API_TOKEN', () => {
      expect(parseStdioEnv({ SCRAPER_API_TOKEN: BASIC_TOKEN }).auth).toEqual({
        type: AUTH_TYPE.TOKEN,
        value: BASIC_TOKEN,
      });
    });

    it.each([{}, { SCRAPER_API_TOKEN: '' }, { DECODO_API_KEY: ' ', SCRAPER_API_TOKEN: ' ' }])(
      'throws naming DECODO_API_KEY when no credential is set: %p',
      env => {
        expect(() => parseStdioEnv(env)).toThrow('env DECODO_API_KEY missing');
      }
    );
  });

  describe('integration header', () => {
    it('defaults to the stdio value', () => {
      expect(parseStdioEnv({ SCRAPER_API_TOKEN: API_KEY }).integrationHeader).toBe(
        STDIO_INTEGRATION_HEADER
      );
    });

    it('uses DECODO_INTEGRATION_HEADER when set', () => {
      const env = { SCRAPER_API_TOKEN: API_KEY, DECODO_INTEGRATION_HEADER: ' mcp-docker ' };

      expect(parseStdioEnv(env).integrationHeader).toBe('mcp-docker');
    });

    it('ignores a blank DECODO_INTEGRATION_HEADER', () => {
      const env = { SCRAPER_API_TOKEN: API_KEY, DECODO_INTEGRATION_HEADER: ' ' };

      expect(parseStdioEnv(env).integrationHeader).toBe(STDIO_INTEGRATION_HEADER);
    });
  });

  describe('hidden tools', () => {
    it('hides nothing by default', () => {
      expect(parseStdioEnv({ SCRAPER_API_TOKEN: API_KEY }).hiddenTools.size).toBe(0);
    });

    it('hides the tools listed in HIDDEN_TOOLS', () => {
      const env = { SCRAPER_API_TOKEN: API_KEY, HIDDEN_TOOLS: 'perplexity' };

      expect([...parseStdioEnv(env).hiddenTools]).toEqual(['perplexity']);
    });
  });
});

describe('ScraperAPIStdioServer', () => {
  const auth = { type: AUTH_TYPE.API_KEY, value: API_KEY };

  it('sends the stdio integration header by default', () => {
    const server = new ScraperAPIStdioServer({ auth, toolsets: [] });

    expect(server.sapiClient.integrationHeader).toBe(STDIO_INTEGRATION_HEADER);
  });

  it('passes an overridden integration header to the client', () => {
    const server = new ScraperAPIStdioServer({
      auth,
      toolsets: [],
      integrationHeader: 'mcp-docker',
    });

    expect(server.sapiClient.integrationHeader).toBe('mcp-docker');
  });
});
