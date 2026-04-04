import { corsConfig } from 'app/config/corsConfig.js';
import { isProduction } from 'app/config/env.js';
import pool, { query } from 'app/db/pool/pool.js';
import { csrfGuard } from 'app/middleware/csrfGuard/csrfGuard.js';
import { errorHandler } from 'app/middleware/errorHandler/errorHandler.js';
import { notFoundHandler } from 'app/middleware/notFoundHandler/notFoundHandler.js';
import { rateLimiter } from 'app/middleware/rateLimiter/rateLimiter.js';
import { requestLogger } from 'app/middleware/requestLogger/requestLogger.js';
import { loadSession } from 'app/middleware/requireAuth/requireAuth.js';
import { authRouter } from 'app/routes/auth.js';
import { placesRouter } from 'app/routes/places.js';
import { tripRouter } from 'app/routes/trips.js';
import { userPreferencesRouter } from 'app/routes/userPreferences.js';
import { logger } from 'app/utils/logs/logger.js';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';

function validateEnv(): void {
  if (!process.env.DATABASE_URL) {
    console.error('Fatal: DATABASE_URL is required');
    process.exit(1);
  }
  if (isProduction() && !process.env.CORS_ORIGIN) {
    console.error('Fatal: CORS_ORIGIN is required in production');
    process.exit(1);
  }
}

const app = express();
export { app };
const REQUEST_TIMEOUT_MS = 30_000;

// Trust the first hop (reverse proxy / load balancer) so req.ip, req.protocol, and rate limiting work
// correctly with X-Forwarded-For / X-Forwarded-Proto headers. Set to the number of trusted proxy hops.
app.set('trust proxy', 1);

// Add security-related HTTP headers to reduce common web vulnerabilities (XSS, clickjacking, MIME sniffing, etc.).
app.use(helmet());

// Allow browser frontends to call this API while still controlling which origins are permitted.
app.use(corsConfig);

// Attach structured request/response logging (with request IDs) early so all downstream handlers are observable.
app.use(requestLogger);

// Apply a basic rate limiter to protect the API from simple abuse and accidental client floods.
app.use(rateLimiter);

// Parse JSON request bodies and cap payload size to avoid unexpectedly large requests.
app.use(express.json({ limit: '10kb' }));

// Parse URL-encoded form submissions (e.g. HTML forms) with the same size cap as JSON.
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

app.use(cookieParser());

// Require X-Requested-With on state-changing requests to mitigate CSRF.
app.use(csrfGuard);

// Load session from cookie and set req.user when valid (does not block unauthenticated requests).
app.use(loadSession);

// Timeout long-running requests so hung connections don't stay open indefinitely.
app.use((_req, res, next) => {
  res.setTimeout(REQUEST_TIMEOUT_MS, () => {
    if (!res.headersSent) {
      res
        .status(408)
        .json({ error: 'REQUEST_TIMEOUT', message: 'Request timeout' });
    }
  });
  next();
});

query('SELECT NOW()')
  .then(() => logger.info('Connected to database'))
  .catch((err: unknown) => logger.error({ err }, 'Database connection failed'));

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/health/ready', async (_req, res) => {
  let dbStatus = 'disconnected';
  let cacheStatus = 'unavailable';

  try {
    await query('SELECT 1');
    dbStatus = 'connected';
  } catch {
    // DB check failed
  }

  try {
    const { getRedis } = await import('app/services/cache.service.js');
    const redis = getRedis();
    if (redis) {
      await redis.ping();
      cacheStatus = 'connected';
    }
  } catch {
    cacheStatus = 'degraded';
  }

  let activeConversations = 0;
  try {
    const { getActiveConversationCount } = await import(
      'app/handlers/chat/chat.js'
    );
    activeConversations = getActiveConversationCount();
  } catch {
    // Module not loaded yet
  }

  const status = dbStatus === 'connected' ? 'ok' : 'degraded';
  const statusCode = dbStatus === 'connected' ? 200 : 503;
  res
    .status(statusCode)
    .json({ status, db: dbStatus, cache: cacheStatus, activeConversations });
});

// Static destinations data — public, aggressively cached
import destinationsData from 'app/data/destinations.json' with { type: 'json' };
app.get('/destinations', (_req, res) => {
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json(destinationsData);
});

app.use('/auth', authRouter);
app.use('/places', placesRouter);
app.use('/trips', tripRouter);
app.use('/user-preferences', userPreferencesRouter);

// Attach reusable utilities for 404 and error handling.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = Number(process.env.PORT) || 3001;
const HOST = '0.0.0.0';

export function startServer(): void {
  validateEnv();

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected idle-client error in pg pool');
  });

  process.on('uncaughtException', (err) => {
    logger.fatal({ err }, 'Uncaught exception – shutting down');
    logger.flush();
    process.exit(1);
  });
  process.on('unhandledRejection', (reason) => {
    logger.fatal({ reason }, 'Unhandled rejection – shutting down');
    logger.flush();
    process.exit(1);
  });

  const server = app.listen(PORT, HOST, () =>
    logger.info({ port: PORT }, 'Server running'),
  );

  async function shutdown(signal: string) {
    logger.info({ signal }, 'Shutting down gracefully');
    await new Promise<void>((resolve) => server.close(() => resolve()));
    logger.info('HTTP server closed');
    await pool.end();
    process.exit(0);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}
