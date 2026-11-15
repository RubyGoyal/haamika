/**
 * Server entry point. Validates configuration, creates the repository,
 * and starts listening on the configured PORT.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import express from 'express';
import { loadConfig } from './config.js';
import { createRepository } from './repositories/index.js';
import { createApp } from './app.js';
import { logger } from './services/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  // Validate configuration — fail fast with clear message
  const config = loadConfig();

  // Create repository
  const repo = createRepository(config.DATA_BACKEND, config.GOOGLE_CLOUD_PROJECT);

  // Create Express app
  const app = createApp(repo);

  // Serve built web app in production
  if (config.NODE_ENV === 'production') {
    const webDir = join(__dirname, '../web');
    app.use(express.static(webDir, { maxAge: '1y', immutable: true }));
    // SPA fallback: serve index.html for all non-API routes
    app.get('*', (_req, res) => {
      res.sendFile(join(webDir, 'index.html'));
    });
  }

  // Start server
  const server = app.listen(config.PORT, () => {
    logger.info('Haamika server started', {
      port: config.PORT,
      env: config.NODE_ENV,
      backend: config.DATA_BACKEND,
    });
  });

  // Graceful shutdown
  const shutdown = () => {
    logger.info('Shutting down...');
    server.close(() => {
      process.exit(0);
    });
  };
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

main().catch((err: Error) => {
  logger.error('Failed to start server', { message: err.message });
  process.exit(1);
});
