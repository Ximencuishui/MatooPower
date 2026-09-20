/**
 * Matoo Admin API · Logger
 *
 * Writes structured JSON lines to api/data/audit.log and mirrors to
 * stdout in dev. Append-only; never throws.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');

function ensureLogFile() {
  if (!fs.existsSync(config.paths.dataDir)) {
    fs.mkdirSync(config.paths.dataDir, { recursive: true });
  }
  if (!fs.existsSync(config.paths.auditLog)) {
    fs.writeFileSync(config.paths.auditLog, '', 'utf8');
  }
}

function log(entry) {
  const record = Object.assign(
    {
      ts: new Date().toISOString(),
      user: 'system',
    },
    entry
  );
  try {
    ensureLogFile();
    fs.appendFileSync(config.paths.auditLog, JSON.stringify(record) + '\n', 'utf8');
  } catch (err) {
    // Logging must never break the request
    console.error('[audit] failed to write log:', err.message);
  }
  // Mirror to console for operator visibility
  const tag = `[${record.action || 'log'}]`;
  console.log(tag, record.user, record.target || '', record.after || '');
}

function readAll(limit) {
  ensureLogFile();
  const lines = fs.readFileSync(config.paths.auditLog, 'utf8').split(/\r?\n/).filter(Boolean);
  const parsed = [];
  for (const line of lines) {
    try {
      parsed.push(JSON.parse(line));
    } catch (_) {
      // Skip malformed lines silently
    }
  }
  parsed.reverse(); // newest first
  return typeof limit === 'number' ? parsed.slice(0, limit) : parsed;
}

module.exports = { log, readAll };