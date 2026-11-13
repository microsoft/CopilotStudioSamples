import { mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { hostname } from 'node:os';

export const load = async file => JSON.parse(await readFile(file, 'utf8'));

export async function writeProtected(file, content) {
  const temporary = `${file}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, { mode: 0o600, flag: 'wx' });
    await rename(temporary, file);
  } finally {
    await rm(temporary, { force: true });
  }
}

export const save = (file, value) => writeProtected(file, `${JSON.stringify(value, null, 2)}\n`);

export async function withLock(file, action) {
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  let handle;
  try {
    handle = await open(file, 'wx', 0o600);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    throw new Error(`Another operation owns ${file}. If it crashed, verify that its recorded process has stopped before removing only this lock file.`);
  }
  try {
    await handle.writeFile(JSON.stringify({ pid: process.pid, host: hostname(), startedAt: new Date().toISOString() }));
    return await action();
  } finally {
    await handle.close();
    await rm(file);
  }
}
