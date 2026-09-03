import crypto from 'crypto';

function emit(level, event, fields = {}) {
  const record = {
    timestamp: new Date().toISOString(),
    level,
    event,
    ...fields
  };
  const line = JSON.stringify(record);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else console.log(line);
}

export const logInfo = (event, fields) => emit('info', event, fields);
export const logWarn = (event, fields) => emit('warn', event, fields);
export const logError = (event, fields) => emit('error', event, fields);

export function requestLogger(req, res, next) {
  const started = process.hrtime.bigint();
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader('X-Request-Id', requestId);

  res.on('finish', () => {
    if (!req.path.startsWith('/api')) return;
    const durationMs = Number(process.hrtime.bigint() - started) / 1e6;
    const fields = {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 10) / 10
    };
    if (res.statusCode >= 500) logError('http_request', fields);
    else if (res.statusCode >= 400) logWarn('http_request', fields);
    else logInfo('http_request', fields);
  });

  next();
}
