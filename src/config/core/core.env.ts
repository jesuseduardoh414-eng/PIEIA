import { loadEnvFile, env } from 'node:process';
import fs from 'node:fs';

// 1. Load environment variables from .env file
if (fs.existsSync('.env')) {
  loadEnvFile();
}

// 2. Export configuration object
export const {
  PORT = 3000,
  NODE_ENV = 'development',
  FRONTEND_URL = 'http://localhost:5173',
  DATABASE_URL,
  STRIPE_SECRET_KEY,
  SUPABASE_STORAGE_BUCKET,
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY,
  JWT_SECRET,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM_NAME,
  SMTP_FROM_EMAIL,
  APT_PASSWORD,
  STRIPE_WEBHOOK_SECRET,
} = env;
