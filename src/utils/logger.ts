import winston from 'winston';

const { combine, timestamp, printf, colorize, align } = winston.format;

/**
 * Safely serialize an object, handling circular references and Error objects.
 * This prevents "Converting circular structure to JSON" errors when logging.
 */
function safeStringify(obj: unknown, depth: number = 0): string {
  if (depth > 3) return '[max depth reached]';
  
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  
  if (obj instanceof Error) {
    const errorObj: Record<string, unknown> = {
      name: obj.name,
      message: obj.message,
      stack: obj.stack,
    };
    // Include any additional error properties
    const errorKeys = Object.keys(obj) as (keyof Error)[];
    for (const key of errorKeys) {
      if (!['name', 'message', 'stack'].includes(key)) {
        errorObj[key] = obj[key] as unknown;
      }
    }
    // Handle Axios-style errors with response data
    const axiosError = obj as any;
    if (axiosError.response) {
      errorObj.response = {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        data: axiosError.response.data,
      };
    }
    if (axiosError.config && !errorObj.response) {
      errorObj.config = {
        url: axiosError.config.url,
        method: axiosError.config.method,
        baseURL: axiosError.config.baseURL,
      };
    }
    return JSON.stringify(errorObj);
  }
  
  if (typeof obj !== 'object') {
    try {
      return JSON.stringify(obj);
    } catch {
      return String(obj);
    }
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    const items = obj.slice(0, 10).map(item => safeStringify(item, depth + 1));
    if (obj.length > 10) items.push(`... ${obj.length - 10} more`);
    return `[${items.join(', ')}]`;
  }
  
  // Handle plain objects - check for circular references
  const seen = new WeakSet();
  
  try {
    return JSON.stringify(obj, (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return '[circular]';
        }
        seen.add(value);
        
        // Truncate large objects
        const keys = Object.keys(value);
        if (keys.length > 20 && depth < 2) {
          const truncated: Record<string, unknown> = {};
          for (const k of keys.slice(0, 20)) {
            truncated[k] = value[k];
          }
          truncated['...'] = `${keys.length - 20} more keys`;
          return truncated;
        }
      }
      return value;
    });
  } catch {
    return '[unserializable]';
  }
}

const logFormat = printf(({ level, message, timestamp, ...metadata }) => {
  let msg = `${timestamp} [${level}]: ${message}`;
  if (Object.keys(metadata).length > 0) {
    msg += ` ${safeStringify(metadata)}`;
  }
  return msg;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(
    colorize(),
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    align(),
    logFormat
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

/**
 * Helper function to safely log errors without circular reference issues.
 * Use this when logging caught errors, especially from HTTP requests.
 */
export function logError(context: string, error: unknown): void {
  if (error instanceof Error) {
    const errorInfo: Record<string, unknown> = {
      name: error.name,
      message: error.message,
    };

    // Include stack trace for non-production environments
    if (process.env.NODE_ENV !== 'production') {
      errorInfo.stack = error.stack;
    }

    // Handle Axios-style errors
    const axiosError = error as any;
    if (axiosError.response) {
      errorInfo.response = {
        status: axiosError.response.status,
        statusText: axiosError.response.statusText,
        data: axiosError.response.data,
      };
    } else if (axiosError.config) {
      errorInfo.request = {
        url: axiosError.config.url,
        method: axiosError.config.method,
      };
    }

    logger.error(`${context}:`, errorInfo);
  } else {
    // For non-Error objects, use safeStringify to avoid circular reference errors
    logger.error(`${context}: ${safeStringify(error)}`);
  }
}

export default logger;
