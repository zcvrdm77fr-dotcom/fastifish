import multer from 'multer';
import { logError } from './logger.js';

export function apiNotFound(req, res) {
  res.status(404).json({
    error: 'Ei löytynyt.',
    code: 'NOT_FOUND',
    requestId: req.requestId || null
  });
}

export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  const isUploadError = err instanceof multer.MulterError;
  const requestedStatus = Number(err?.status);
  const status = isUploadError
    ? 400
    : (Number.isInteger(requestedStatus) && requestedStatus >= 400 && requestedStatus < 600 ? requestedStatus : 500);

  if (status >= 500) {
    logError('request_error', {
      requestId: req.requestId || null,
      method: req.method,
      path: req.path,
      message: err?.message || String(err),
      stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack
    });
  }

  res.status(status).json({
    error: status >= 500 ? 'Palvelinvirhe.' : (err?.message || 'Pyyntö epäonnistui.'),
    code: isUploadError ? 'UPLOAD_ERROR' : (status >= 500 ? 'INTERNAL_ERROR' : 'REQUEST_ERROR'),
    requestId: req.requestId || null
  });
}
