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
    const isSupabasePooler = url.hostname.includes('pooler.supabase.com');

    if (isSupabase && !isSupabasePooler) {
      // Direct Supabase connection (port 5432)
      if (!url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'require');
      }
      if (!url.searchParams.has('pgbouncer')) {
        url.searchParams.set('pgbouncer', 'true');
      }
      url.searchParams.set('connect_timeout', '60');
    }

    if (isSupabasePooler) {
      // Supabase Pooler connection (port 6543) - uses transaction mode
      // Transaction pooler requires specific settings
      if (!url.searchParams.has('sslmode')) {
        url.searchParams.set('sslmode', 'require');
      }
      // For transaction pooler, we need to ensure proper connection handling
      url.searchParams.set('connect_timeout', '60');
      url.searchParams.set('pool_timeout', '60');
      // Disable prepared statements for transaction pooler compatibility
      url.searchParams.set('pgbouncer', 'true');
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

const prismaOptions: any = {
  log: process.env.NODE_ENV === 'production'
    ? ['error', 'warn']
    : ['query', 'error', 'warn'],
};

if (normalizedDatabaseUrl) {
  prismaOptions.datasources = {
    db: { url: normalizedDatabaseUrl },
  };
}

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient(Object.keys(prismaOptions).length > 0 ? prismaOptions : undefined);

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

const defaultRetries = Number.parseInt(process.env.DB_CONNECT_RETRIES || '10', 10);
const defaultRetryDelayMs = Number.parseInt(process.env.DB_CONNECT_RETRY_DELAY_MS || '2000', 10);

export const connectWithRetry = async (
  maxRetries: number = defaultRetries,
  retryDelayMs: number = defaultRetryDelayMs
): Promise<void> => {
  let attempt = 0;

  while (true) {
    try {
      await prisma.$connect();
      logger.info('Database connection established successfully');
      return;
    } catch (error: any) {
      attempt += 1;

      if (attempt > maxRetries) {
        logger.error('All database connection attempts failed');
        logger.error('Connection URL pattern:', normalizedDatabaseUrl?.replace(/:[^:@]+@/, ':****@'));
        if (error?.code === 'P1001') {
          logger.error('Database server is unreachable. Common causes:');
          logger.error('  1. Database is paused (Supabase free tier pauses inactive databases)');
          logger.error('  2. IPv4 not available - try using pooler connection: pooler.supabase.com:6543');
          logger.error('  3. Firewall blocking the connection');
          logger.error('  4. Wrong hostname or port');
          logger.error('');
          logger.error('SOLUTION: Use the Supabase pooler connection string instead:');
          logger.error('  Format: postgres://[user]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres');
          logger.error('  Find it in: Supabase Dashboard > Project Settings > Database > Connection Pooling');
        }
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
