const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MAX_FILE_BYTES, validateFile, prepareAttachments } = require('../temp/tests/components/Chat/attachments');

test('supported files include the exact byte limit but not one byte over', () => {
  assert.equal(validateFile('REPORT.PDF', MAX_FILE_BYTES), 'application/pdf');
  assert.throws(() => validateFile('report.pdf', MAX_FILE_BYTES + 1), /15 MiB/);
  for (const size of [0, -1, NaN, Infinity]) assert.throws(() => validateFile('empty.txt', size), /empty|read/);
  assert.throws(() => validateFile('script.exe', 1), /not supported/);
});
test('local bytes retain name and get a meaningful MIME type instead of the blob transport type', async () => {
  const result = await prepareAttachments(
    [{ name: 'notes.txt', contentType: 'application/octet-stream', contentUrl: 'blob:local' }],
    true,
    async () => new Response('a small fixture')
  );
  assert.deepEqual(result, [{
    name: 'notes.txt', contentType: 'text/plain',
    contentUrl: `data:text/plain;base64,${Buffer.from('a small fixture').toString('base64')}`
  }]);
});
test('multiple local attachments and attachment-only messages need no text', async () => {
  const input = ['one.txt', 'two.csv'].map(name => ({ name, contentType: '', contentUrl: `blob:${name}` }));
  const result = await prepareAttachments(input, true, async () => new Response('fixture'));
  assert.equal(result.length, 2);
  assert.equal(result[1].contentType, 'text/csv');
  assert.equal(input[0].contentUrl, 'blob:one.txt');
});
test('disabled uploads, remote URLs and unreadable files fail before sending', async () => {
  const attachment = { name: 'file.txt', contentType: 'text/plain', contentUrl: 'blob:file' };
  await assert.rejects(prepareAttachments([attachment], false), /disabled/);
  await assert.rejects(prepareAttachments([{ ...attachment, contentUrl: 'https://example.com/file' }], true), /local file/);
  await assert.rejects(prepareAttachments([attachment], true, async () => new Response('', { status: 404 })), /Could not read/);
  await assert.rejects(prepareAttachments([attachment], true, async () => { throw new Error('read failed'); }), /read failed/);
  assert.deepEqual(await prepareAttachments([], false), []);
});
