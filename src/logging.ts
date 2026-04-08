type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const REDACTED_KEYS = new Set(['password', 'privateKey', 'passphrase']);

function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        REDACTED_KEYS.has(key) ? '[REDACTED]' : redactValue(nestedValue)
      ])
    );
  }

  return value;
}

export function redactSecrets<T>(value: T): T {
  return redactValue(value) as T;
}

export function createLogger(component: string) {
  return {
    debug(message: string, context?: Record<string, unknown>) {
      log('debug', component, message, context);
    },
    info(message: string, context?: Record<string, unknown>) {
      log('info', component, message, context);
    },
    warn(message: string, context?: Record<string, unknown>) {
      log('warn', component, message, context);
    },
    error(message: string, context?: Record<string, unknown>) {
      log('error', component, message, context);
    }
  };
}

function log(
  level: LogLevel,
  component: string,
  message: string,
  context?: Record<string, unknown>
) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    component,
    message,
    ...(context ? { context: redactSecrets(context) } : {})
  };

  process.stderr.write(`${JSON.stringify(payload)}\n`);
}
