'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const request = require('supertest');
const express = require('express');
const { registerAdminV2Page } = require('../routes/admin-v2-page');

describe('admin-v2 page route', () => {
  test('serves /admin-v2 with env injection and static assets', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-v2-test-'));
    const distDir = path.join(tmpRoot, 'dist-admin');
    fs.mkdirSync(path.join(distDir, 'assets'), { recursive: true });
    fs.writeFileSync(
      path.join(distDir, 'index.html'),
      '<html><head><title>x</title></head><body><script type="module" src="/assets/a.js"></script></body></html>'
    );
    fs.writeFileSync(path.join(distDir, 'assets', 'a.js'), 'console.log("ok")');

    const app = express();
    registerAdminV2Page(app, { rootPath: tmpRoot, htmlPageLimiter: (_req, _res, next) => next() });

    const pageRes = await request(app).get('/admin-v2');
    expect(pageRes.status).toBe(200);
    expect(pageRes.headers['cache-control']).toContain('no-store');
    expect(pageRes.text).toContain('window.__API_BASE__');
    expect(pageRes.text).toContain('/admin-v2-assets/a.js');

    const assetRes = await request(app).get('/admin-v2-assets/a.js');
    expect(assetRes.status).toBe(200);
    expect(assetRes.text).toContain('console.log');

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  test('does not register when dist-admin/index.html is missing', async () => {
    const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'admin-v2-test-missing-'));
    const app = express();

    const enabled = registerAdminV2Page(app, { rootPath: tmpRoot, htmlPageLimiter: (_req, _res, next) => next() });
    expect(enabled).toBe(false);

    const res = await request(app).get('/admin-v2');
    expect(res.status).toBe(404);

    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });
});
