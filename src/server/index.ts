/**
 * Server entry point. Validates configuration, creates the repository,
 * and starts listening on the configured PORT.
 */
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadConfig } from './config.js';
import { createRepository } from './repositories/index.js';
import { createApp } from './app.js';
import { logger } from './services/logger.js';
import { seedDemoCircle } from './seed/demo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  // Validate configuration — fail fast with clear message
  const config = loadConfig();

  // Create repository
  const repo = createRepository(config.DATA_BACKEND, config.GOOGLE_CLOUD_PROJECT);

  // Seed demo data if DEMO_MODE is true (server still starts if seeding fails)
  if (config.DEMO_MODE) {
    try {
      const demoInfo = await seedDemoCircle(repo);
      logger.info('Demo circle seeded', { code: demoInfo.circleCode, circleId: demoInfo.circleId });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('Failed to seed demo data', { error: message });
    }
  }

  // Create Express app (with SPA fallback for production)
  const webDir = config.NODE_ENV === 'production' ? join(__dirname, '../web') : undefined;
  const app = createApp(repo, { webDir });

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
