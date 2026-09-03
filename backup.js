import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { db } from './db.js';
import { DATA_DIR, UPLOADS_DIR } from './paths.js';
import { logError, logInfo, logWarn } from './logger.js';

const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const UPLOAD_STATE_FILE = path.join(BACKUP_DIR, 'upload-state.json');

const state = {
  running: false,
  lastAttemptAt: null,
  lastSuccessAt: null,
  lastError: null,
  lastDatabaseFile: null,
  offsiteConfigured: false,
  offsiteUploadedFiles: 0
};

function backupIntervalMs() {
  const hours = Math.max(1, Math.min(168, Number(process.env.BACKUP_INTERVAL_HOURS) || 24));
  return hours * 60 * 60 * 1000;
}

function localRetention() {
  return Math.max(2, Math.min(30, Number(process.env.BACKUP_LOCAL_RETENTION) || 7));
}

function s3Config() {
  const endpoint = String(process.env.BACKUP_S3_ENDPOINT || '').trim().replace(/\/+$/, '');
  const bucket = String(process.env.BACKUP_S3_BUCKET || '').trim();
  const accessKeyId = String(process.env.BACKUP_S3_ACCESS_KEY_ID || '').trim();
  const secretAccessKey = String(process.env.BACKUP_S3_SECRET_ACCESS_KEY || '').trim();
  const region = String(process.env.BACKUP_S3_REGION || 'auto').trim() || 'auto';
  const prefix = String(process.env.BACKUP_S3_PREFIX || 'fastfishing').trim().replace(/^\/+|\/+$/g, '') || 'fastfishing';
  if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) return null;
  return { endpoint, bucket, accessKeyId, secretAccessKey, region, prefix };
}

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, char => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalPath(...parts) {
  return '/' + parts
    .flatMap(part => String(part || '').split('/'))
    .filter(Boolean)
    .map(awsEncode)
    .join('/');
}

async function putS3Object(config, key, body, contentType = 'application/octet-stream') {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const payloadHash = sha256(payload);
  const endpoint = new URL(config.endpoint);
  const uri = canonicalPath(endpoint.pathname, config.bucket, key);
  const url = new URL(endpoint.origin + uri);
  const canonicalHeaders = `host:${url.host}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
  const canonicalRequest = ['PUT', uri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const scope = `${dateStamp}/${config.region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');
  const dateKey = hmac(`AWS4${config.secretAccessKey}`, dateStamp);
  const regionKey = hmac(dateKey, config.region);
  const serviceKey = hmac(regionKey, 's3');
  const signingKey = hmac(serviceKey, 'aws4_request');
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${config.accessKeyId}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

  const response = await fetch(url, {
    method: 'PUT',
    body: payload,
    headers: {
      Authorization: authorization,
      'Content-Type': contentType,
      'x-amz-content-sha256': payloadHash,
      'x-amz-date': amzDate
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Backup upload failed (${response.status}): ${text.slice(0, 300)}`);
  }
}

function readUploadState() {
  try {
    return JSON.parse(fs.readFileSync(UPLOAD_STATE_FILE, 'utf8')) || {};
  } catch {
    return {};
  }
}

function writeUploadState(value) {
  fs.writeFileSync(UPLOAD_STATE_FILE, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
}

async function createDatabaseSnapshot() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const finalPath = path.join(BACKUP_DIR, `fastfishing-${stamp}.db`);
  const tempPath = `${finalPath}.tmp`;
  await db.backup(tempPath);
  fs.renameSync(tempPath, finalPath);
  fs.chmodSync(finalPath, 0o600);
  return finalPath;
}

function pruneLocalBackups() {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(name => /^fastfishing-.*\.db$/.test(name))
    .map(name => ({ name, stat: fs.statSync(path.join(BACKUP_DIR, name)) }))
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs);

  files.slice(localRetention()).forEach(file => {
    try {
      fs.unlinkSync(path.join(BACKUP_DIR, file.name));
    } catch (error) {
      logWarn('local_backup_prune_failed', { file: file.name, message: error.message });
    }
  });
}

async function uploadOffsite(config, databasePath) {
  const uploadState = readUploadState();
  const dbName = path.basename(databasePath);
  const dbKey = `${config.prefix}/database/${dbName}`;
  await putS3Object(config, dbKey, await fs.promises.readFile(databasePath));

  let uploadedFiles = 0;
  const imageNames = (await fs.promises.readdir(UPLOADS_DIR)).filter(name => /^[a-f0-9]{32}\.jpg$/i.test(name));
  for (const name of imageNames) {
    const filePath = path.join(UPLOADS_DIR, name);
    const stat = await fs.promises.stat(filePath);
    const fingerprint = `${stat.size}:${Math.round(stat.mtimeMs)}`;
    if (uploadState[name] === fingerprint) continue;
    await putS3Object(config, `${config.prefix}/uploads/${name}`, await fs.promises.readFile(filePath), 'image/jpeg');
    uploadState[name] = fingerprint;
    uploadedFiles += 1;
  }
  writeUploadState(uploadState);

  const manifest = {
    createdAt: new Date().toISOString(),
    databaseKey: dbKey,
    uploadCount: imageNames.length,
    newlyUploadedImages: uploadedFiles
  };
  await putS3Object(config, `${config.prefix}/latest.json`, `${JSON.stringify(manifest, null, 2)}\n`, 'application/json');
  return uploadedFiles;
}

export async function runBackup() {
  if (state.running) return { ...state };
  state.running = true;
  state.lastAttemptAt = new Date().toISOString();
  state.lastError = null;

  try {
    const databasePath = await createDatabaseSnapshot();
    pruneLocalBackups();
    state.lastDatabaseFile = path.basename(databasePath);

    const config = s3Config();
    state.offsiteConfigured = !!config;
    state.offsiteUploadedFiles = 0;
    if (config) {
      state.offsiteUploadedFiles = await uploadOffsite(config, databasePath);
    }

    state.lastSuccessAt = new Date().toISOString();
    logInfo('backup_completed', {
      databaseFile: state.lastDatabaseFile,
      offsiteConfigured: state.offsiteConfigured,
      offsiteUploadedFiles: state.offsiteUploadedFiles
    });
    return { ...state };
  } catch (error) {
    state.lastError = error.message;
    logError('backup_failed', { message: error.message });
    throw error;
  } finally {
    state.running = false;
  }
}

export function getBackupStatus() {
  const config = s3Config();
  const ageHours = state.lastSuccessAt
    ? Math.round(((Date.now() - new Date(state.lastSuccessAt).getTime()) / 3600000) * 10) / 10
    : null;
  return {
    configured: !!config,
    localBackups: true,
    running: state.running,
    lastAttemptAt: state.lastAttemptAt,
    lastSuccessAt: state.lastSuccessAt,
    ageHours,
    lastError: state.lastError,
    lastDatabaseFile: state.lastDatabaseFile,
    offsiteUploadedFiles: state.offsiteUploadedFiles
  };
}

let backupTimer = null;

export function startBackupScheduler() {
  if (backupTimer) return backupTimer;
  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });

  const run = () => runBackup().catch(() => {});
  const initial = setTimeout(run, 60_000);
  initial.unref?.();
  backupTimer = setInterval(run, backupIntervalMs());
  backupTimer.unref?.();
  return backupTimer;
}
