// ci/collect-context.js
// Gathers the facts about the latest commit + dependency state.
// Output: context.json (read by decide.js)

const { execSync } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch (e) {
    return null;
  }
}

// 1. Files changed in the latest commit
const diff = sh('git diff --name-only HEAD~1 HEAD');
const changedFilesKnown = diff !== null;
const changedFiles = diff ? diff.split(/\r?\n/).filter(Boolean) : [];

// 2. Is the installed node_modules still in sync with package-lock.json?
//    (hash stamp is written by deps.js after every successful npm ci)
const lockHash = crypto.createHash('sha256').update(fs.readFileSync('package-lock.json')).digest('hex');
const stampPath = 'node_modules/.lock-hash';
const installedHash = fs.existsSync(stampPath) ? fs.readFileSync(stampPath, 'utf8').trim() : null;

// 3. Previous timings (history is written by deps.js)
const history = fs.existsSync('ci-history.json') ? JSON.parse(fs.readFileSync('ci-history.json', 'utf8')) : [];
const lastSeconds = (type) => {
  const row = [...history].reverse().find((h) => h.executed === type);
  return row ? row.seconds : null;
};

const context = {
  changedFilesKnown,
  changedFiles,
  lockChanged: changedFiles.includes('package-lock.json'),
  packageJsonChanged: changedFiles.includes('package.json'),
  lodashInstalled: fs.existsSync('node_modules/lodash/package.json'),
  lockMatchesInstalled: installedHash === lockHash,
  lastNpmCiSeconds: lastSeconds('npm_ci'),
  lastCacheSeconds: lastSeconds('cache'),
};

fs.writeFileSync('context.json', JSON.stringify(context, null, 2));
console.log('=== CONTEXT COLLECTED ===');
console.log(JSON.stringify(context, null, 2));
