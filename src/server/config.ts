import { z } from 'zod';

const ConfigSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  DATA_BACKEND: z.enum(['memory', 'firestore']).default('memory'),
  GOOGLE_CLOUD_PROJECT: z.string().optional(),
  GOOGLE_CLOUD_LOCATION: z.string().default('us-central1'),
  GOOGLE_GENAI_USE_VERTEXAI: z.coerce.boolean().default(false),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  GEMINI_API_KEY: z.string().optional(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be ≥ 32 characters'),
  CRON_SECRET: z.string().min(16, 'CRON_SECRET must be ≥ 16 characters'),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().optional(),
  APP_BASE_URL: z.string().url().default('http://localhost:3000'),
  DEMO_MODE: z.coerce.boolean().default(false),
});

export type Config = z.infer<typeof ConfigSchema>;

let _config: Config | undefined;

/** Parse and validate environment variables. Fails fast with a clear, secret-free message. */
export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const result = ConfigSchema.safeParse(env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid configuration:\n${issues}`);
  }
  _config = result.data;
  return _config;
}

/** Return the loaded config or throw if loadConfig() was never called. */
export function getConfig(): Config {
  if (!_config) {
    throw new Error('Configuration not loaded. Call loadConfig() first.');
  }
  return _config;
}
