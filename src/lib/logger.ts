// =============================================================================
// Structured Logger - Pino-based logging for production observability
// =============================================================================

import pino from 'pino';

const isProduction = process.env.NODE_ENV === 'production';

function initLogger() {
  try {
    return pino({
      level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
      ...(isProduction
        ? {
            timestamp: pino.stdTimeFunctions.isoTime,
          }
        : {
            transport: {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'HH:MM:ss',
                ignore: 'pid,hostname',
              },
            },
          }),
    });
  } catch {
    // Fallback if pino config fails (e.g. pino-pretty not available in production)
    return pino({ level: 'info' });
  }
}

export const logger = initLogger();

// Create child loggers for different modules
export const createLogger = (module: string) => logger.child({ module });

// Pre-configured loggers for key services
export const log = {
  api: createLogger('api'),
  auth: createLogger('auth'),
  billing: createLogger('billing'),
  telephony: createLogger('telephony'),
  ai: createLogger('ai'),
  knowledge: createLogger('knowledge'),
  webhook: createLogger('webhook'),
  tenant: createLogger('tenant'),
  db: createLogger('database'),
};

export default logger;
