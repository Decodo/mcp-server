import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { credentialFromAuthHeader } from './auth';
import { corsOptions } from './server/cors';
import { ScraperAPIHttpServer } from './server/sapi-http-server';
import { resolveToolsets } from './utils';

const app = express();

app.use(cors(corsOptions));
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

  const credential = credentialFromAuthHeader(auth);

  if (!credential) {
    res.status(401).send("Valid 'Basic' or 'Bearer' authorization required");
    return;
  }

  const toolsets = resolveToolsets(req.query.toolsets as string);

  const server = new ScraperAPIHttpServer({ toolsets, auth: credential });

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
  })
  .on('error', (error: Error) => {
    console.error('Server error:', error);
    process.exit(1);
  });
