import { PrismaClient } from '@prisma/client';
import logger from './logger';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

const normalizeDatabaseUrl = (input?: string): string | undefined => {
  if (!input) {
    return undefined;
  }

  const trimmed = input.trim().replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');

  if (!trimmed.startsWith('postgres')) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    const isSupabase = url.hostname.endsWith('supabase.co');

    if (isSupabase && !url.searchParams.has('sslmode')) {
      url.searchParams.set('sslmode', 'require');
    }

    return url.toString();
  } catch {
    return trimmed;
  }
};

const normalizedDatabaseUrl = normalizeDatabaseUrl(process.env.DATABASE_URL);

if (normalizedDatabaseUrl) {
  process.env.DATABASE_URL = normalizedDatabaseUrl;
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(
    normalizedDatabaseUrl
      ? {
          datasources: {
            db: { url: normalizedDatabaseUrl },
          },
        }
      : undefined
  );

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const defaultRetries = Number.parseInt(process.env.DB_CONNECT_RETRIES || '5', 10);
const defaultRetryDelayMs = Number.parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '2000', 10);

export const connectWithRetry = async (
  maxRetries: number = defaultRetries,
  retryDelayMs: number = defaultRetryDelayMs
): Promise<void> => {
  let attempt = 0;

  while (true) {
    try {
      await prisma.$connect();
      return;
    } catch (error) {
      attempt += 1;

      if (attempt > maxRetries) {
        throw error;
      }

      const delay = retryDelayMs * Math.pow(2, attempt - 1);
      logger.warn(
        `Database connection failed (attempt ${attempt}/${maxRetries}). Retrying in ${Math.round(
          delay / 1000
        )}s...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
};

export default prisma;
