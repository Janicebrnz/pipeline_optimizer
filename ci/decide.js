// ci/decide.js
// Asks Gemini: RUN_INSTALL or USE_CACHE?
// Retries on 429/5xx, tries a chain of models, and falls back to a simple rule if Gemini is unavailable.
// Outputs: decision.txt, source.txt, decision.json
//
// source values (use these words in your report):
//   GEMINI_AI             -> Gemini made the decision
//   GEMINI_AI_OVERRIDDEN  -> Gemini answered, but the safety guard corrected an unsafe USE_CACHE
//   FALLBACK_RULE         -> Gemini unavailable, rule-based decision used

const fs = require('fs');

const ctx = JSON.parse(fs.readFileSync('context.json', 'utf8'));
const KEY = process.env.GEMINI_API_KEY;
const MODELS = (process.env.GEMINI_MODELS || 'gemini-3.8-flash,gemini-3.5-flash-lite')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const MAX_ATTEMPTS = 3;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Is it safe to skip npm ci?
function cacheIsSafe(c) {
  return c.lodashInstalled && c.lockMatchesInstalled && !c.lockChanged && !c.packageJsonChanged;
}

// Simple deterministic rule used ONLY when Gemini is unavailable
function fallbackRule(c) {
  return cacheIsSafe(c) ? 'USE_CACHE' : 'RUN_INSTALL';
}

async function askGemini() {
  const prompt = `You are the dependency-management optimizer inside a Jenkins CI/CD pipeline for a Node.js project (dependency: lodash).
Decide whether Jenkins should run "npm ci" (RUN_INSTALL) or skip it and reuse the existing node_modules (USE_CACHE).
Goal: minimise dependency-management time WITHOUT risking a broken build.

Rules of thumb:
- Reusing node_modules is only safe if lodash is installed AND node_modules matches package-lock.json (lockMatchesInstalled=true) AND neither package.json nor package-lock.json changed.
- If anything about the dependencies is uncertain, choose RUN_INSTALL.
- Changes only to source/docs files (e.g. build.js, README.md) do not require reinstalling.

Pipeline facts (JSON):
${JSON.stringify(ctx, null, 2)}

Reply with JSON: decision (RUN_INSTALL or USE_CACHE), confidence (0 to 1), reason (one short sentence).`;

  const body = {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0,
      maxOutputTokens: 1024,
      responseMimeType: 'application/json',
      responseSchema: {
        type: 'OBJECT',
        properties: {
          decision: { type: 'STRING', enum: ['RUN_INSTALL', 'USE_CACHE'] },
          confidence: { type: 'NUMBER' },
          reason: { type: 'STRING' },
        },
        required: ['decision', 'confidence', 'reason'],
      },
    },
  };

  let attemptsTotal = 0;
  let lastError = 'unknown';

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attemptsTotal++;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
      try {
        const res = await fetch(url, {
          method: 'POST',
          // key goes in a header, never in the URL, so it can't leak into logs
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          const parsed = JSON.parse(text);
          if (!['RUN_INSTALL', 'USE_CACHE'].includes(parsed.decision)) throw new Error('Invalid decision value');
          console.log(`[AI] ${model} attempt ${attempt}: HTTP 200 OK`);
          return { ...parsed, model, attempts: attemptsTotal };
        }

        const errText = await res.text();
        let msg = errText;
        try { msg = JSON.parse(errText).error.message; } catch (e) { /* keep raw */ }
        lastError = `HTTP ${res.status}: ${String(msg).slice(0, 200)}`;
        console.log(`[AI] ${model} attempt ${attempt}: ${lastError}`);

        // 429 with "limit: 0" means this model has no quota for your key -> go to next model
        if (res.status === 429 && /limit:\s*0/.test(errText)) break;
        // Retry only on rate-limit / temporary server errors
        if ([429, 500, 503].includes(res.status) && attempt < MAX_ATTEMPTS) {
          const wait = 2000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
          console.log(`[AI] waiting ${wait} ms before retry...`);
          await sleep(wait);
          continue;
        }
        break; // 400/403/404 etc. -> try next model
      } catch (e) {
        lastError = e.message;
        console.log(`[AI] ${model} attempt ${attempt}: error ${e.message}`);
        break;
      }
    }
  }
  const err = new Error(lastError);
  err.attempts = attemptsTotal;
  throw err;
}

(async () => {
  let result;

  if (process.env.SIMULATE_AI_FAILURE === 'true') {
    console.log('[AI] SIMULATE_AI_FAILURE=true -> skipping Gemini on purpose (fallback demo)');
    result = { decision: fallbackRule(ctx), source: 'FALLBACK_RULE', model: 'none', reason: 'AI failure simulated', attempts: 0 };
  } else if (!KEY) {
    console.log('[AI] GEMINI_API_KEY not set -> using fallback');
    result = { decision: fallbackRule(ctx), source: 'FALLBACK_RULE', model: 'none', reason: 'No API key', attempts: 0 };
  } else {
    try {
      const ai = await askGemini();
      let decision = ai.decision;
      let source = 'GEMINI_AI';
      let reason = ai.reason;
      // Safety guard: never let a wrong USE_CACHE break the build
      if (decision === 'USE_CACHE' && !cacheIsSafe(ctx)) {
        decision = 'RUN_INSTALL';
        source = 'GEMINI_AI_OVERRIDDEN';
        reason = `Gemini chose USE_CACHE but safety guard forced RUN_INSTALL. Gemini said: ${ai.reason}`;
      }
      result = { decision, source, model: ai.model, confidence: ai.confidence, reason, attempts: ai.attempts };
    } catch (e) {
      console.log(`[AI] Gemini unavailable (${e.message}) -> fallback rule`);
      result = { decision: fallbackRule(ctx), source: 'FALLBACK_RULE', model: 'none', reason: `Gemini unavailable: ${e.message}`, attempts: e.attempts || 0 };
    }
  }

  fs.writeFileSync('decision.txt', result.decision);
  fs.writeFileSync('source.txt', result.source);
  fs.writeFileSync('decision.json', JSON.stringify({ ...result, context: ctx }, null, 2));

  console.log('');
  console.log('==============================================');
  console.log(` DECISION SOURCE : ${result.source}`);
  console.log(` DECISION        : ${result.decision}`);
  console.log(` MODEL           : ${result.model}`);
  console.log(` API ATTEMPTS    : ${result.attempts}`);
  if (result.confidence !== undefined) console.log(` CONFIDENCE      : ${result.confidence}`);
  console.log(` REASON          : ${result.reason}`);
  console.log('==============================================');
})();
