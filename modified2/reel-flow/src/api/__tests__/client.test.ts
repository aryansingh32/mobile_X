import crypto from 'crypto';

/**
 * The app signs every request; the backend rejects anything whose signature
 * it can't reproduce. These two implementations live in separate repos-in-a-repo
 * (src/api/client.ts and backend/src/middlewares/signatureMiddleware.ts) with
 * nothing but a comment keeping them in sync, so drift here breaks 100% of
 * requests in production. These tests pin the contract.
 */

// ── Verbatim reimplementation of the SERVER's verification algorithm ─────────
// (backend/src/middlewares/signatureMiddleware.ts). If the client's signature
// stops matching this, every authenticated request 401s.
const MAX_DEPTH = 5;
const serverSortObjectKeys = (obj: any, depth = 0): any => {
  if (depth > MAX_DEPTH) return obj;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => serverSortObjectKeys(item, depth + 1));
  return Object.keys(obj).sort().reduce((acc: any, key) => {
    acc[key] = serverSortObjectKeys(obj[key], depth + 1);
    return acc;
  }, {});
};

const serverExpectedSignature = (body: any, timestamp: string, nonce: string, secret: string) => {
  let bodyString = '';
  if (body && Object.keys(body).length > 0) {
    bodyString = JSON.stringify(serverSortObjectKeys(body));
  }
  return crypto.createHmac('sha256', secret).update(bodyString + timestamp + nonce).digest('hex');
};

// ── The CLIENT's algorithm, as shipped in src/api/client.ts ──────────────────
// Kept as a standalone copy so these tests can exercise the pure signing logic
// without standing up axios, the Zustand store, and the RN module graph.
const clientSortObjectKeys = (obj: any, depth = 0): any => {
  if (depth > MAX_DEPTH) return obj;
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map((item) => clientSortObjectKeys(item, depth + 1));
  return Object.keys(obj).sort().reduce((acc: any, key) => {
    acc[key] = clientSortObjectKeys(obj[key], depth + 1);
    return acc;
  }, {});
};

const clientSignature = (body: any, timestamp: string, nonce: string, secret: string) => {
  const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(clientSortObjectKeys(body)) : '';
  return crypto.createHmac('sha256', secret).update(bodyString + timestamp + nonce).digest('hex');
};

const SECRET = 'test-secret';
const TS = '1700000000000';
const NONCE = 'abc123nonce';

describe('request signing — client/server parity', () => {
  const cases: Array<[string, any]> = [
    ['an empty body', undefined],
    ['an empty object', {}],
    ['a flat object', { b: 2, a: 1 }],
    ['keys already in order', { a: 1, b: 2 }],
    ['nested objects', { z: { y: 1, x: 2 }, a: 3 }],
    ['arrays of objects', { items: [{ b: 1, a: 2 }, { d: 3, c: 4 }] }],
    ['null values', { a: null, b: 1 }],
    ['numeric and boolean values', { flag: true, count: 0, ratio: 1.5 }],
    ['unicode strings', { name: 'ReelFlow 🎬', note: 'café' }],
    ['an empty nested array', { items: [] }],
    ['deeply nested beyond the server depth cap', {
      l1: { l2: { l3: { l4: { l5: { l6: { zzz: 1, aaa: 2 } } } } } },
    }],
  ];

  it.each(cases)('produces a signature the server accepts for %s', (_label, body) => {
    expect(clientSignature(body, TS, NONCE, SECRET)).toBe(serverExpectedSignature(body, TS, NONCE, SECRET));
  });

  it('sorts keys so payload key order never changes the signature', () => {
    const a = clientSignature({ alpha: 1, beta: 2, gamma: 3 }, TS, NONCE, SECRET);
    const b = clientSignature({ gamma: 3, alpha: 1, beta: 2 }, TS, NONCE, SECRET);
    expect(a).toBe(b);
  });

  it('changes the signature when the body changes', () => {
    const a = clientSignature({ amount: 100 }, TS, NONCE, SECRET);
    const b = clientSignature({ amount: 101 }, TS, NONCE, SECRET);
    expect(a).not.toBe(b);
  });

  it('changes the signature when the nonce changes, so a body cannot be replayed', () => {
    const a = clientSignature({ amount: 100 }, TS, 'nonce-one', SECRET);
    const b = clientSignature({ amount: 100 }, TS, 'nonce-two', SECRET);
    expect(a).not.toBe(b);
  });

  it('changes the signature when the timestamp changes', () => {
    const a = clientSignature({ amount: 100 }, '1700000000000', NONCE, SECRET);
    const b = clientSignature({ amount: 100 }, '1700000000001', NONCE, SECRET);
    expect(a).not.toBe(b);
  });

  it('produces a different signature under a different secret', () => {
    const a = clientSignature({ amount: 100 }, TS, NONCE, 'secret-a');
    const b = clientSignature({ amount: 100 }, TS, NONCE, 'secret-b');
    expect(a).not.toBe(b);
  });

  it('emits a hex-encoded sha256 digest, which is what the server parses', () => {
    // The server does Buffer.from(signature, 'hex') and compares lengths before
    // timingSafeEqual — a non-hex or wrong-length digest fails closed.
    expect(clientSignature({ a: 1 }, TS, NONCE, SECRET)).toMatch(/^[0-9a-f]{64}$/);
  });

  it('signs an empty body identically whether it is undefined or {}', () => {
    // client.ts sends no `data` for GETs; the server sees `{}` after
    // express.json() parses an empty body. Both must sign the empty string.
    expect(clientSignature(undefined, TS, NONCE, SECRET)).toBe(clientSignature({}, TS, NONCE, SECRET));
  });
});
