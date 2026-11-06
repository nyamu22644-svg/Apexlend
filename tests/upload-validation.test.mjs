import test from 'node:test';
import assert from 'node:assert/strict';

const startsWith = (bytes, magic) => magic.every((value, index) => bytes[index] === value);
test('accepts a valid PDF header', () => assert.equal(startsWith(Buffer.from('%PDF-1.7'), [0x25, 0x50, 0x44, 0x46, 0x2d]), true));
test('rejects a claimed PDF with executable content', () => assert.equal(startsWith(Buffer.from('MZ executable'), [0x25, 0x50, 0x44, 0x46, 0x2d]), false));
test('requires RIFF and WEBP markers for WebP', () => assert.equal(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP')]).subarray(8, 12).toString('ascii'), 'WEBP'));
