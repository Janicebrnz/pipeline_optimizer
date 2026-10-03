// ci/deps.js <RUN_INSTALL|USE_CACHE>
// Executes the AI decision, measures "Dependency Management Time", and records it in ci-history.json.

const { spawnSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

const decision = process.argv[2];
const source = fs.existsSync('source.txt') ? fs.readFileSync('source.txt', 'utf8').trim() : 'UNKNOWN';
const build = process.env.BUILD_NUMBER || 'local';

const start = Date.now();
let executed;
let note = '';

const lodashPresent = fs.existsSync('node_modules/lodash/package.json');

if (decision === 'USE_CACHE' && lodashPresent) {
  console.log('USE_CACHE: skipping npm ci, reusing existing node_modules');
  executed = 'cache';
} else {
  if (decision === 'USE_CACHE') {
    note = 'cache miss recovered by running npm ci';
    console.log('WARNING: USE_CACHE requested but lodash is missing -> running npm ci for safety');
  }
  console.log('RUN_INSTALL: executing npm ci');
  const r = spawnSync('npm ci', { shell: true, stdio: 'inherit' });
  if (r.status !== 0) {
    console.error('npm ci failed');
    process.exit(1);
  }
  // stamp node_modules with the hash of the lock file it was installed from
  const hash = crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex');
  fs.writeFileSync('node_modules/.lock-hash', hash);
  executed = 'npm_ci';
}

const seconds = Number(((Date.now() - start) / 1000).toFixed(3));

const history = fs.existsSync('ci-history.json') ? JSON.parse(fs.readFileSync('ci-history.json', 'utf8')) : [];
history.push({ build, decision, decisionSource: source, executed, seconds, note });
fs.writeFileSync('ci-history.json', JSON.stringify(history, null, 2));

console.log('');
console.log(`Decision Source           : ${source}`);
console.log(`Decision Executed         : ${executed === 'cache' ? 'USE_CACHE (npm ci skipped)' : 'RUN_INSTALL (npm ci executed)'}`);
console.log(`Dependency Management Time: ${seconds} seconds`);
if (note) console.log(`Note                      : ${note}`);

// Comparison table of all past builds (copy this into your report)
console.log('\n--- Build history ---');
console.table(history.map((h) => ({ build: h.build, source: h.decisionSource, executed: h.executed, seconds: h.seconds })));
