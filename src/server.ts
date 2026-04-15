import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ScraperAPIHttpServer } from './server/sapi-http-server';

const app = express();

const server = new ScraperAPIHttpServer();

app.use(express.json());

app.get('/mcp', (_req, res) => {
  res.status(200).send('server up, use POST /mcp to see available tools');
});

app.post('/mcp', async (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).send('Unauthorized');
  }

  const [type, token] = auth.split(' ');

  if (type !== 'Basic') {
    return res.status(401).send("'Basic' authorization required");
  }

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on('close', () => {
    transport.close();
  });

  server.setAuthToken(token);

  await server.connect(transport);

  await transport.handleRequest(req, res, req.body);
});

app.get('/healthz', (_req, res) => {
  res.status(200).send('ok');
});

const port = parseInt(process.env.PORT || '3000');

app
  .listen(port, () => {
    console.log(`Demo MCP Server running on http://localhost:${port}/mcp`);
  })
  .on('error', error => {
    console.error('Server error:', error);
    process.exit(1);
  });
