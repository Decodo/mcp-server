import z from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyApiClient } from '../clients/proxy-api-client';

export class AddWhitelistedIpsTool {
  static register = ({ server, proxyClient }: { server: McpServer; proxyClient: ProxyApiClient }) => {
    server.tool(
      'add_whitelisted_ips',
      'Add one or more IP addresses to the proxy authentication whitelist on your Decodo account. IPv4 only.',
      {
        ips: z
          .array(z.string().ip({ version: 'v4' }))
          .min(1)
          .describe('List of IPv4 addresses to whitelist'),
      },
      async ({ ips }: { ips: string[] }) => {
        await proxyClient.addWhitelistedIps(ips);
        const allIps = await proxyClient.listWhitelistedIps();

        const formatted = allIps
          .map(ip => `- **${ip.ip}** (id: ${ip.id}, enabled: ${ip.enabled})`)
          .join('\n');

        return {
          content: [
            {
              type: 'text',
              text: `Successfully added ${ips.length} IP(s). Current whitelist (${allIps.length} total):\n\n${formatted}`,
            },
          ],
        };
      }
    );
  };
}
