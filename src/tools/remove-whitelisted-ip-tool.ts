import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyApiClient } from '../clients/proxy-api-client';

export class RemoveWhitelistedIpTool {
  static register = ({ server, proxyClient }: { server: McpServer; proxyClient: ProxyApiClient }) => {
    server.tool(
      'remove_whitelisted_ip',
      'Remove a whitelisted IP address from your Decodo account by its ID. Use list_whitelisted_ips to find the ID.',
      {
        id: z.number().describe('The ID of the whitelisted IP entry to remove (from list_whitelisted_ips)'),
      },
      async ({ id }: { id: number }) => {
        await proxyClient.removeWhitelistedIp(id);

        return {
          content: [
            { type: 'text', text: `Successfully removed whitelisted IP entry with id: ${id}` },
          ],
        };
      }
    );
  };
}
