import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './db/database.js';
import { createMcpServer } from './mcp/server.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import measurementsRouter from './routes/measurements.js';
import mealsRouter from './routes/meals.js';
import settingsRouter from './routes/settings.js';
import summaryRouter from './routes/summary.js';
import insightsRouter from './routes/insights.js';
import supplementsRouter from './routes/supplements.js';

const PORT = Number(process.env.PORT) || 3000;
const API_KEY = process.env.API_KEY || 'dev-key';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4200,http://localhost:4300';
const allowedOrigins = FRONTEND_URL.split(',').map((u) => u.trim());

const app = express();

app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

function mcpAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  const key = req.headers['x-api-key'];
  if (key !== API_KEY) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

app.use('/api/measurements', measurementsRouter);
app.use('/api/meals', mealsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/summary', summaryRouter);
app.use('/api/insights', insightsRouter);
app.use('/api/supplements', supplementsRouter);

app.post('/mcp', mcpAuth, async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const server = createMcpServer();
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

app.get('/mcp', (_req, res) => {
  res.status(405).json({ error: 'Method not allowed. Use POST for MCP requests.' });
});

app.delete('/mcp', (_req, res) => {
  res.status(405).json({ error: 'Session management not supported in stateless mode.' });
});

initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`REST API: http://localhost:${PORT}/api`);
    console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
  });
});
