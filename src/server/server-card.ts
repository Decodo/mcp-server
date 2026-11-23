import { SUPPORTED_PROTOCOL_VERSIONS } from '@modelcontextprotocol/sdk/types.js';
import { MCP_PATH } from '../oauth/config';
import { PACKAGE_VERSION } from '../version';

export const SERVER_CARD_PATH = `${MCP_PATH}/server-card`;

export const SERVER_CARD_MEDIA_TYPE = 'application/mcp-server-card+json';

export const SERVER_CARD_CACHE_CONTROL = 'public, max-age=3600';

// SEP-2127: cards are static connection metadata and never list tools, resources or prompts.
export const buildServerCard = (publicUrl: URL) => ({
  $schema: 'https://static.modelcontextprotocol.io/schemas/v1/server-card.schema.json',
  name: 'com.decodo/mcp-server',
  version: PACKAGE_VERSION,
  title: 'Decodo MCP Server',
  description:
    'Web scraping for AI agents: scrape websites, search engines, eCommerce and social media.',
  websiteUrl: 'https://decodo.com',
  repository: { url: 'https://github.com/Decodo/mcp-server', source: 'github' },
  icons: [
    {
      src: 'https://raw.githubusercontent.com/Decodo/mcp-server/main/chatgpt-plugin/assets/icon.png',
      mimeType: 'image/png',
      sizes: ['512x512'],
    },
  ],
  remotes: [
    {
      type: 'streamable-http',
      url: new URL(MCP_PATH, publicUrl).href,
      supportedProtocolVersions: [...SUPPORTED_PROTOCOL_VERSIONS],
      headers: [
        {
          name: 'Authorization',
          description:
            'Bearer auth with your Decodo Web Data API key. Older plans can send "Basic <basic_auth_token>" instead.',
          isRequired: true,
          isSecret: true,
          value: 'Bearer {api_key}',
          variables: {
            api_key: {
              description: 'Decodo Web Data API key',
              isRequired: true,
              isSecret: true,
            },
          },
        },
      ],
    },
  ],
});
