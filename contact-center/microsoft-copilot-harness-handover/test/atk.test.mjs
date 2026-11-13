import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';
import { argumentsFor, executable, root, run } from '../scripts/setup.mjs';

test('real ATK parses both workflows and dispatches their portable commands without cloud access', async t => {
  await mkdir(path.join(root, '.local'), { recursive: true });
  const directory = await mkdtemp(path.join(root, '.local', 'atk workflow test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, 'scripts'));
  await mkdir(path.join(directory, 'env'));
  await writeFile(path.join(directory, 'package.json'), '{"name":"handover-atk-fixture","private":true}');
  await writeFile(path.join(directory, 'scripts/setup.mjs'),
    `import {appendFileSync} from 'node:fs'; appendFileSync('calls.jsonl', JSON.stringify(process.argv.slice(2))+'\\n');`);
  for (const [file, environment, target] of [
    ['m365agents.yml', 'dev', 'azure'], ['m365agents.local.yml', 'local', 'local']
  ]) {
    const yaml = await readFile(path.join(root, file), 'utf8');
    const workflow = parse(yaml);
    assert.equal(workflow.publish, undefined, 'deploy must not publish or share tenant-wide');
    for (const phase of ['provision', 'deploy']) {
      assert.equal(workflow[phase].length, 1);
      const step = workflow[phase][0];
      assert.equal(step.uses, 'script', 'the isolated fixture must never run cloud actions');
      assert.ok(step.with.run.startsWith('node scripts/setup.mjs '));
      const [stage, ...args] = step.with.run.split(' ').slice(2);
      assert.equal(argumentsFor(stage, args).target, target);
    }
    await writeFile(path.join(directory, file), yaml);
    await writeFile(path.join(directory, 'env', `.env.${environment}`), `TEAMSFX_ENV=${environment}\n`);
  }
  for (const environment of ['dev', 'local']) {
    for (const phase of ['provision', 'deploy']) {
      run(executable('atk'), [phase, '--folder', directory, '--env', environment, '--interactive', 'false', '--telemetry', 'false']);
    }
  }
  const calls = (await readFile(path.join(directory, 'calls.jsonl'), 'utf8')).trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.map(([stage, ...args]) => [stage, argumentsFor(stage, args).target]),
    [['provision', 'azure'], ['deploy', 'azure'], ['provision', 'local'], ['deploy', 'local']]);
});
