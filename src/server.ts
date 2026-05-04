import 'dotenv/config';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ScraperAPIHttpServer } from './server/sapi-http-server';
import { resolveToolsets } from './utils';

const app = express();

app.use(express.json());

app.get('/mcp', (_req, res) => {
  res.status(200).send('server up, use POST /mcp to see available tools');
});

app.post('/mcp', async (req, res) => {
  const auth = req.headers.authorization;

  if (!auth) {
    res.status(401).send('Unauthorized');
    return;
  }

  const parts = auth.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Basic') {
    res.status(401).send("Valid 'Basic' authorization required");
    return;
  }

  const token = parts[1];

  const toolsets = resolveToolsets(req.query.toolsets as string);

  const server = new ScraperAPIHttpServer({ toolsets, auth: token });

  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: false,
  });

  res.on('close', () => {
    transport.close();
  });

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
    console.log(`API host: ${process.env.DECODO_SAPI_HOST}`);
  })
  .on('error', (error: Error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
