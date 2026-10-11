// Issue #160 (part of Epic #114): docs/crew/README.md and its Spanish twin are the public,
// end-user-facing explanation of the two visual modes (Cartoon/Caricatura vs Crew). Unlike the rest of
// docs/crew/, which targets implementers, this guide is meant to be read by someone evaluating the product
// who has never opened the source tree. Prose can drift from reality the moment a control is renamed or a
// script is removed, so this test parses the guide the same way docs-parity.test.mjs and
// docs-usage-keys.test.mjs already do for docs/library.md: every `npm run <script>` it tells a reader to
// type must exist in package.json, every relative file link it points at must exist on disk, and the exact
// control ids/button labels it documents must match both the live app (src/App.tsx, src/crew/CrewStage.tsx)
// and the already-working reproduction script (scripts/capture-crew-runtime.mjs) that issue #160's
// "reproducible evidence" section tells readers to run themselves.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));
const EM_DASH = '—';

const EN_PATH = 'docs/crew/README.md';
const ES_PATH = 'docs/crew/README.es.md';

function readRepoFile(relativePath) {
  return readFileSync(`${repoRoot}${relativePath}`, 'utf8');
}

function headingLevels(content) {
  return content
    .split('\n')
    .filter((line) => /^#{1,6}\s/.test(line))
    .map((line) => line.match(/^(#{1,6})\s/)[1]);
}

function npmRunCommands(content) {
  return [...content.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((match) => match[1]);
}

function relativeLinkTargets(content) {
  // Matches markdown links/images whose target is not an absolute URL or an in-page anchor.
  const targets = [];
  for (const match of content.matchAll(/]\(([^)]+)\)/g)) {
    const target = match[1].split('#')[0].trim();
    if (!target) continue;
    if (/^[a-z]+:\/\//i.test(target) || target.startsWith('mailto:')) continue;
    targets.push(target);
  }
  return targets;
}

test('docs/crew/README.md and docs/crew/README.es.md both exist', () => {
  assert.ok(existsSync(`${repoRoot}${EN_PATH}`), `${EN_PATH} must exist as the public guide for issue #160`);
  assert.ok(existsSync(`${repoRoot}${ES_PATH}`), `${ES_PATH} must exist as the Spanish twin, matching every other bilingual guide in docs/crew/`);
});

for (const relativePath of [EN_PATH, ES_PATH]) {
  test(`${relativePath} contains no em dash (U+2014)`, () => {
    const content = readRepoFile(relativePath);
    assert.ok(!content.includes(EM_DASH), `${relativePath} must not contain the em dash character, per repo style`);
  });
}

test('the two guides have the same heading levels in the same order', () => {
  const en = headingLevels(readRepoFile(EN_PATH));
  const es = headingLevels(readRepoFile(ES_PATH));
  assert.deepEqual(en, es, 'the sequence of #/##/###/... heading levels must match between languages, even though heading text is translated');
});

test('every "npm run <script>" command named in the guide exists in package.json', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'));
  const scripts = packageJson.scripts ?? {};
  for (const relativePath of [EN_PATH, ES_PATH]) {
    const content = readRepoFile(relativePath);
    const commands = npmRunCommands(content);
    assert.ok(commands.length > 0, `${relativePath} should document at least one real npm script`);
    for (const command of commands) {
      assert.ok(Object.hasOwn(scripts, command), `${relativePath} documents "npm run ${command}", but package.json has no such script`);
    }
  }
});

test('the crew:capture script documented as reproducible evidence points at a real, existing file', () => {
  const packageJson = JSON.parse(readRepoFile('package.json'));
  const command = packageJson.scripts?.['crew:capture'];
  assert.ok(command, 'package.json must keep a "crew:capture" script for the guide to document');
  const match = /^node (.+\.mjs)$/.exec(command.trim());
  assert.ok(match, `"crew:capture" should run a plain node script, got: ${command}`);
  assert.ok(existsSync(`${repoRoot}${match[1]}`), `${match[1]} referenced by the "crew:capture" script must exist`);
});

test('every relative file link in the guides resolves to a real file in the repository', () => {
  for (const relativePath of [EN_PATH, ES_PATH]) {
    const content = readRepoFile(relativePath);
    const baseDir = relativePath.slice(0, relativePath.lastIndexOf('/'));
    for (const target of relativeLinkTargets(content)) {
      const resolved = new URL(target, `file://${repoRoot}${baseDir}/`).pathname;
      assert.ok(existsSync(resolved), `${relativePath} links to "${target}", which does not exist at ${resolved}`);
    }
  }
});

test('the guide documents the real toggle labels and control ids used by the live app and the capture script', () => {
  const appSource = readRepoFile('src/App.tsx');
  const stageSource = readRepoFile('src/crew/CrewStage.tsx');
  const captureScript = readRepoFile('scripts/capture-crew-runtime.mjs');

  // These are the exact literals the working capture script already clicks/selects against; if the guide
  // names anything else, a reader following it by hand would fail where the automated script succeeds.
  assert.ok(captureScript.includes("name:'Crew · Beta'"), 'capture script no longer uses the expected Crew toggle label; update this assertion together with the guide');
  assert.ok(appSource.includes('Crew · Beta'), 'src/App.tsx no longer renders the "Crew · Beta" toggle label the guide documents');
  assert.ok(stageSource.includes("idPrefix = 'crew'"), "src/crew/CrewStage.tsx no longer defaults idPrefix to 'crew', so #crew-room/#crew-view/#crew-focus would be wrong");

  for (const relativePath of [EN_PATH, ES_PATH]) {
    const content = readRepoFile(relativePath);
    assert.ok(content.includes('Crew · Beta'), `${relativePath} must document the real toggle label "Crew · Beta"`);
    assert.ok(content.includes('#crew-room'), `${relativePath} must document the real room selector id "#crew-room"`);
    assert.ok(content.includes('#crew-view'), `${relativePath} must document the real camera selector id "#crew-view"`);
    assert.ok(content.includes('#crew-focus'), `${relativePath} must document the real focus selector id "#crew-focus"`);
  }
});

test('the guide is honest about traceability: it names issue #160, the epic #114, and the canonical status ledger', () => {
  for (const relativePath of [EN_PATH, ES_PATH]) {
    const content = readRepoFile(relativePath);
    assert.ok(content.includes('#160'), `${relativePath} must reference issue #160`);
    assert.ok(content.includes('#114'), `${relativePath} must reference epic #114`);
    assert.ok(content.includes('IMPLEMENTATION-STATUS.md'), `${relativePath} must point readers at docs/crew/IMPLEMENTATION-STATUS.md as the canonical per-issue ledger`);
  }
});

test('the guide is honest that the avatar catalog is a placeholder, not final art', () => {
  for (const relativePath of [EN_PATH, ES_PATH]) {
    const content = readRepoFile(relativePath);
    assert.ok(/placeholder/i.test(content), `${relativePath} must say the character catalog is a placeholder (issue #127, blocked on #125/#126)`);
    assert.ok(content.includes('#127'), `${relativePath} must reference issue #127 (the character editor built on the placeholder catalog)`);
  }
});

test('the guide explicitly scopes out final art, a polished production video and G1 certification', () => {
  for (const relativePath of [EN_PATH, ES_PATH]) {
    const content = readRepoFile(relativePath);
    assert.ok(/G1/.test(content), `${relativePath} must mention that G1 certification is not claimed`);
    assert.ok(/out of scope|fuera de alcance/i.test(content), `${relativePath} must have an explicit out-of-scope section`);
  }
});
