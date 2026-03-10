import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { ProxyApiClient } from '../clients/proxy-api-client';

export class ListWhitelistedIpsTool {
  static register = ({ server, proxyClient }: { server: McpServer; proxyClient: ProxyApiClient }) => {
    server.tool(
      'list_whitelisted_ips',
      'List all IP addresses whitelisted for proxy authentication on your Decodo account',
      {},
      async () => {
        const ips = await proxyClient.listWhitelistedIps();

        if (ips.length === 0) {
          return {
            content: [{ type: 'text', text: 'No whitelisted IPs found.' }],
          };
        }

        const formatted = ips
          .map(ip => `- **${ip.ip}** (id: ${ip.id}, enabled: ${ip.enabled}, added: ${ip.created_at})`)
          .join('\n');

        return {
          content: [
            { type: 'text', text: `Found ${ips.length} whitelisted IP(s):\n\n${formatted}` },
          ],
        };
      }
    );
  };
}
