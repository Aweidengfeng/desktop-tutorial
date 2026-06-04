const fs = require('fs');
const path = require('path');

describe('storage adapter', () => {
  const originalEnv = { ...process.env };
  const uploadsDir = '/tmp/storage-adapter-tests';

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv, UPLOADS_DIR: uploadsDir };
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  afterEach(() => {
    jest.resetModules();
    jest.unmock('cos-nodejs-sdk-v5');
    process.env = { ...originalEnv };
    fs.rmSync(uploadsDir, { recursive: true, force: true });
  });

  test('cn upload uses Tencent COS and returns CDN URL when configured', async () => {
    const putObject = jest.fn((params, cb) => cb(null, params));
    const getObjectUrl = jest.fn(({ Key }) => `https://signed.example.com/${Key}`);
    const deleteObject = jest.fn((params, cb) => cb(null, params));
    const putObjectCopy = jest.fn((params, cb) => cb(null, params));

    jest.doMock('cos-nodejs-sdk-v5', () => jest.fn().mockImplementation(() => ({
      putObject,
      getObjectUrl,
      deleteObject,
      putObjectCopy,
    })), { virtual: true });

    process.env.COS_BUCKET = 'unsummit-cn';
    process.env.TENCENT_CLOUD_APPID = '1234567890';
    process.env.COS_REGION = 'ap-beijing';
    process.env.COS_SECRET_ID = 'secret-id';
    process.env.COS_SECRET_KEY = 'secret-key';
    process.env.COS_CDN_DOMAIN = 'https://cdn.unsummit.cn';

    const { uploadFile, getSignedUrl, moveFile, deleteFile } = require('../lib/storage');

    const uploaded = await uploadFile(Buffer.from('hello'), 'gallery/demo image.png', 'cn');
    expect(uploaded).toEqual({
      provider: 'cos',
      key: 'gallery/demo image.png',
      url: 'https://cdn.unsummit.cn/gallery/demo%20image.png',
    });
    expect(putObject).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'unsummit-cn-1234567890',
      Region: 'ap-beijing',
      Key: 'gallery/demo image.png',
      Body: expect.any(Buffer),
    }), expect.any(Function));

    await expect(getSignedUrl('gallery/demo image.png', 600, { region: 'cn' }))
      .resolves.toBe('https://signed.example.com/gallery/demo image.png');

    const moved = await moveFile('gallery/demo image.png', 'archive/demo image.png', { region: 'cn' });
    expect(moved).toEqual({
      provider: 'cos',
      key: 'archive/demo image.png',
      url: 'https://cdn.unsummit.cn/archive/demo%20image.png',
    });
    expect(putObjectCopy).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'unsummit-cn-1234567890',
      Region: 'ap-beijing',
      Key: 'archive/demo image.png',
      CopySource: 'unsummit-cn-1234567890.cos.ap-beijing.myqcloud.com/gallery/demo%20image.png',
    }), expect.any(Function));

    await expect(deleteFile('archive/demo image.png', { region: 'cn' }))
      .resolves.toEqual({ provider: 'cos', key: 'archive/demo image.png', deleted: true });
    expect(deleteObject).toHaveBeenCalledWith(expect.objectContaining({
      Bucket: 'unsummit-cn-1234567890',
      Region: 'ap-beijing',
      Key: 'archive/demo image.png',
    }), expect.any(Function));
  });

  test('cn upload gracefully falls back to local storage when COS is not configured', async () => {    const { uploadFile, getSignedUrl, moveFile, deleteFile } = require('../lib/storage');

    const uploaded = await uploadFile(Buffer.from('fallback'), 'tmp/demo.txt', { region: 'cn' });
    expect(uploaded).toEqual({
      provider: 'local',
      key: 'tmp/demo.txt',
      url: '/uploads/tmp/demo.txt',
    });
    expect(fs.existsSync(path.join(uploadsDir, 'tmp', 'demo.txt'))).toBe(true);

    await expect(getSignedUrl('tmp/demo.txt', 60, { region: 'cn' }))
      .resolves.toBe('/uploads/tmp/demo.txt');

    const moved = await moveFile('tmp/demo.txt', 'tmp/moved.txt', { region: 'cn' });
    expect(moved).toEqual({
      provider: 'local',
      key: 'tmp/moved.txt',
      url: '/uploads/tmp/moved.txt',
    });
    expect(fs.existsSync(path.join(uploadsDir, 'tmp', 'moved.txt'))).toBe(true);

    await expect(deleteFile('tmp/moved.txt', { region: 'cn' }))
      .resolves.toEqual({ provider: 'local', key: 'tmp/moved.txt', deleted: true });
    expect(fs.existsSync(path.join(uploadsDir, 'tmp', 'moved.txt'))).toBe(false);
  });

  test('production refuses to fall back to local disk when COS is not configured (Fail Closed)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COS_BUCKET;
    delete process.env.COS_SECRET_ID;
    delete process.env.COS_SECRET_KEY;

    const { uploadFile } = require('../lib/storage');
    await expect(uploadFile(Buffer.from('x'), 'tmp/demo.txt', { region: 'cn' }))
      .rejects.toThrow(/COS 未配置/);
    // 必须没有写入本地磁盘
    expect(fs.existsSync(path.join(uploadsDir, 'tmp', 'demo.txt'))).toBe(false);
  });

  test('assertProductionStorageReady throws in production without COS config', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COS_BUCKET;
    delete process.env.COS_SECRET_ID;
    delete process.env.COS_SECRET_KEY;

    const { assertProductionStorageReady } = require('../lib/storage');
    expect(() => assertProductionStorageReady()).toThrow(/Fail Closed/);
  });

  test('assertProductionStorageReady throws in production when STORAGE_PROVIDER=local', () => {
    process.env.NODE_ENV = 'production';
    process.env.STORAGE_PROVIDER = 'local';
    process.env.COS_BUCKET = 'unsummit-cn-1234567890';
    process.env.COS_REGION = 'ap-beijing';
    process.env.COS_SECRET_ID = 'secret-id';
    process.env.COS_SECRET_KEY = 'secret-key';

    const { assertProductionStorageReady } = require('../lib/storage');
    expect(() => assertProductionStorageReady()).toThrow(/STORAGE_PROVIDER=local/);
  });

  test('assertProductionStorageReady passes in production when COS is configured', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.STORAGE_PROVIDER;
    process.env.COS_BUCKET = 'unsummit-cn-1234567890';
    process.env.COS_REGION = 'ap-beijing';
    process.env.COS_SECRET_ID = 'secret-id';
    process.env.COS_SECRET_KEY = 'secret-key';

    const { assertProductionStorageReady } = require('../lib/storage');
    expect(() => assertProductionStorageReady()).not.toThrow();
  });

  test('non-production environment does not enforce COS (allows local fallback)', () => {
    process.env.NODE_ENV = 'development';
    delete process.env.COS_BUCKET;
    const { assertProductionStorageReady } = require('../lib/storage');
    expect(() => assertProductionStorageReady()).not.toThrow();
  });
});
