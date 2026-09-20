/**
 * Matoo Admin API · Image routes
 */
'use strict';

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const config = require('../lib/config');
const imagesLib = require('../lib/images');
const scanner = require('../lib/scanner');
const logger = require('../lib/logger');
const { requireAuth } = require('./auth');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.maxUploadMB * 1024 * 1024 },
});

router.get('/', requireAuth('read'), (req, res) => {
  const list = imagesLib.listAssets();
  const { usedImages } = scanner.buildKeyIndex();
  const refs = {};
  for (const [img, files] of usedImages.entries()) refs[img] = Array.from(files);
  res.json({ ok: true, items: list, references: refs });
});

router.get('/references/*', requireAuth('read'), (req, res) => {
  // Express trick: route matches everything after /references/
  const rel = req.params[0];
  if (!imagesLib.isSafeAssetPath(rel)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  }
  const { usedImages } = scanner.buildKeyIndex();
  const files = usedImages.get(rel);
  res.json({ ok: true, image: rel, files: files ? Array.from(files) : [] });
});

router.post('/upload', requireAuth('write'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'No file uploaded' });
  const file = req.file;

  // Filename safety
  let targetName = (req.body && req.body.filename) || file.originalname;
  targetName = path.basename(targetName).replace(/[^A-Za-z0-9._-]/g, '_');
  if (!targetName || !imagesLib.isAllowedExt(targetName)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'File extension not allowed' });
  }

  // MIME magic check
  const ext = path.extname(targetName).toLowerCase();
  if (!imagesLib.detectMagic(file.buffer, ext)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'File content does not match extension' });
  }

  // Subdirectory under assets/ (e.g. "hero" or "products") — optional
  let subdir = (req.body && req.body.subdir) || '';
  subdir = subdir.replace(/[^A-Za-z0-9_-]/g, '');
  if (subdir.includes('..')) subdir = '';

  const targetFullDir = path.join(config.paths.assetsDir, subdir);
  const targetFull = path.join(targetFullDir, targetName);

  // Avoid overwriting by accident unless replace=true
  const replaceFlag = req.body && req.body.replace === 'true';
  if (fs.existsSync(targetFull) && !replaceFlag) {
    return res.status(409).json({ ok: false, code: 'CONFLICT', message: 'File already exists; pass replace=true to overwrite' });
  }

  fs.mkdirSync(targetFullDir, { recursive: true });

  // Archive existing file when replacing
  if (fs.existsSync(targetFull)) {
    imagesLib.archiveAsset(path.join(subdir, targetName));
  }

  fs.writeFileSync(targetFull, file.buffer);

  // Generate variants if applicable
  let variants = [];
  try {
    const baseName = targetName.replace(/\.[^.]+$/, '');
    variants = await imagesLib.maybeGenerateVariants(targetFull, baseName);
  } catch (err) {
    logger.log({ user: 'admin', action: 'images.variant.failed', target: targetName, after: err.message });
  }

  const rel = path.join(subdir, targetName).replace(/\\/g, '/');
  logger.log({ user: 'admin', action: 'images.upload', target: rel, after: (file.size + ' B; variants=' + variants.length) });
  res.json({ ok: true, path: rel, size: file.size, variants });
});

router.post('/replace', requireAuth('write'), upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  const targetRel = req.body && req.body.path;
  if (!targetRel || !imagesLib.isSafeAssetPath(targetRel)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  }
  let targetFull;
  try { targetFull = imagesLib.resolveAssetPath(targetRel); }
  catch (e) { return res.status(400).json({ ok: false, code: e.code || 'INVALID_INPUT', message: e.message }); }

  if (!fs.existsSync(targetFull)) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND', message: 'Original file not found' });
  }
  const ext = path.extname(targetRel).toLowerCase();
  if (!imagesLib.detectMagic(req.file.buffer, ext)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT', message: 'File content does not match extension' });
  }
  imagesLib.archiveAsset(targetRel);
  fs.writeFileSync(targetFull, req.file.buffer);

  const baseName = path.basename(targetRel, ext);
  const variants = await imagesLib.maybeGenerateVariants(targetFull, baseName);

  logger.log({ user: 'admin', action: 'images.replace', target: targetRel });
  res.json({ ok: true, path: targetRel, variants });
});

router.delete('/*', requireAuth('write'), (req, res) => {
  const rel = req.params[0];
  if (!rel || !imagesLib.isSafeAssetPath(rel)) {
    return res.status(400).json({ ok: false, code: 'INVALID_INPUT' });
  }
  let full;
  try { full = imagesLib.resolveAssetPath(rel); }
  catch (e) { return res.status(400).json({ ok: false, code: e.code || 'INVALID_INPUT', message: e.message }); }

  if (!fs.existsSync(full)) {
    return res.status(404).json({ ok: false, code: 'NOT_FOUND' });
  }
  const force = req.query && req.query.force === 'true';
  if (!force) {
    const { usedImages } = scanner.buildKeyIndex();
    const refs = usedImages.get(rel);
    if (refs && refs.size > 0) {
      return res.status(409).json({
        ok: false,
        code: 'IN_USE',
        message: 'Image is referenced by HTML pages',
        references: Array.from(refs),
      });
    }
  }

  imagesLib.archiveAsset(rel);
  fs.unlinkSync(full);
  logger.log({ user: 'admin', action: 'images.delete', target: rel });
  res.json({ ok: true });
});

module.exports = router;