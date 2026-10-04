// ci/decide.js
// Asks an LLM: RUN_INSTALL or USE_CACHE?
// Provider chain: Gemini -> Groq (Llama) -> rule-based fallback.
// Each provider retries on 429/5xx and tries its own list of models.
// Outputs: decision.txt, source.txt, decision.json
//
// source values (use these words in your report):
//   GEMINI_AI / GROQ_AI              -> that LLM made the decision
//   GEMINI_AI_OVERRIDDEN / GROQ_AI_OVERRIDDEN -> LLM answered, safety guard corrected an unsafe USE_CACHE
//   FALLBACK_RULE                    -> no LLM reachable, rule-based decision used

const fs = require('fs');

const ctx = JSON.parse(fs.readFileSync('context.json', 'utf8'));
const list = (v, d) => (v || d).split(',').map((s) => s.trim()).filter(Boolean);

const GEMINI_KEY = process.env.GEMINI_API_KEY;
const GROQ_KEY = process.env.GROQ_API_KEY;
const GEMINI_MODELS = list(process.env.GEMINI_MODELS, 'gemini-3.8-flash,gemini-3.5-flash-lite');
const GROQ_MODELS = list(process.env.GROQ_MODELS, 'llama-3.3-70b-versatile,llama-3.1-8b-instant');
const PROVIDERS = list(process.env.AI_PROVIDERS, 'gemini,groq'); // order = preference
const MAX_ATTEMPTS = 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cacheIsSafe(c) {
  return c.lodashInstalled && c.lockMatchesInstalled && !c.lockChanged && !c.packageJsonChanged;
}
function fallbackRule(c) {
  return cacheIsSafe(c) ? 'USE_CACHE' : 'RUN_INSTALL';
}

const PROMPT = `You are the dependency-management optimizer inside a Jenkins CI/CD pipeline for a Node.js project (dependency: lodash).
Decide whether Jenkins should run "npm ci" (RUN_INSTALL) or skip it and reuse the existing node_modules (USE_CACHE).
Goal: minimise dependency-management time WITHOUT risking a broken build.

Rules of thumb:
- Reusing node_modules is only safe if lodash is installed AND node_modules matches package-lock.json (lockMatchesInstalled=true) AND neither package.json nor package-lock.json changed.
- If anything about the dependencies is uncertain, choose RUN_INSTALL.
- Changes only to source/docs/CI-script files (e.g. build.js, README.md, ci/*.js) do not require reinstalling.

Pipeline facts (JSON):
${JSON.stringify(ctx, null, 2)}

Reply with ONLY a JSON object with these keys: decision ("RUN_INSTALL" or "USE_CACHE"), confidence (number 0 to 1), reason (one short sentence).`;

// ---- provider definitions: how to build the request and read the answer ----
const providers = {
  gemini: {
    key: GEMINI_KEY,
    models: GEMINI_MODELS,
    request: (model) =>
      fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: JSON.stringify({
          contents: [{ parts: [{ text: PROMPT }] }],
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
        }),
      }),
    extract: (data) => data.candidates?.[0]?.content?.parts?.[0]?.text,
  },
  groq: {
    key: GROQ_KEY,
    models: GROQ_MODELS,
    request: (model) =>
      fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model,
          temperature: 0,
          max_tokens: 300,
          response_format: { type: 'json_object' },
          messages: [{ role: 'user', content: PROMPT }],
        }),
      }),
    extract: (data) => data.choices?.[0]?.message?.content,
  },
};

// Try every model of one provider, with retries on 429/500/503
async function runProvider(name) {
  const p = providers[name];
  let attempts = 0;
  let lastError = 'unknown';

  for (const model of p.models) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      attempts++;
      try {
        const res = await p.request(model);

        if (res.ok) {
          const data = await res.json();
          const parsed = JSON.parse(p.extract(data));
          if (!['RUN_INSTALL', 'USE_CACHE'].includes(parsed.decision)) throw new Error('Invalid decision value');
          console.log(`[AI] ${name}/${model} attempt ${attempt}: HTTP 200 OK`);
          return { ...parsed, provider: name, model, attempts };
        }

        const errText = await res.text();
        let msg = errText;
        try { msg = JSON.parse(errText).error.message; } catch (e) { /* keep raw */ }
        lastError = `HTTP ${res.status}: ${String(msg).slice(0, 160)}`;
        console.log(`[AI] ${name}/${model} attempt ${attempt}: ${lastError}`);

        if (res.status === 429 && /limit:\s*0/.test(errText)) break; // no quota on this model
        if ([429, 500, 503].includes(res.status) && attempt < MAX_ATTEMPTS) {
          const wait = 2000 * 2 ** (attempt - 1) + Math.floor(Math.random() * 500);
          console.log(`[AI] waiting ${wait} ms before retry...`);
          await sleep(wait);
          continue;
        }
        break; // other errors -> next model
      } catch (e) {
        lastError = e.message;
        console.log(`[AI] ${name}/${model} attempt ${attempt}: error ${e.message}`);
        break;
      }
    }
  }
  const err = new Error(lastError);
  err.attempts = attempts;
  throw err;
}

(async () => {
  let result;
  let totalAttempts = 0;
  const errors = [];

  if (process.env.SIMULATE_AI_FAILURE === 'true') {
    console.log('[AI] SIMULATE_AI_FAILURE=true -> skipping all LLMs on purpose (fallback demo)');
    errors.push('AI failure simulated');
  } else {
    for (const name of PROVIDERS) {
      if (!providers[name]) continue;
      if (!providers[name].key) {
        console.log(`[AI] ${name}: no API key configured, skipping`);
        continue;
      }
      try {
        const ai = await runProvider(name);
        totalAttempts += ai.attempts;
        let decision = ai.decision;
        let source = `${name.toUpperCase()}_AI`;
        let reason = ai.reason;
        if (decision === 'USE_CACHE' && !cacheIsSafe(ctx)) {
          decision = 'RUN_INSTALL';
          source += '_OVERRIDDEN';
          reason = `LLM chose USE_CACHE but safety guard forced RUN_INSTALL. LLM said: ${ai.reason}`;
        }
        result = { decision, source, provider: name, model: ai.model, confidence: ai.confidence, reason, attempts: totalAttempts };
        break;
      } catch (e) {
        totalAttempts += e.attempts || 0;
        errors.push(`${name}: ${e.message}`);
        console.log(`[AI] ${name} unavailable (${e.message}) -> trying next provider`);
      }
    }
  }

  if (!result) {
    result = {
      decision: fallbackRule(ctx), source: 'FALLBACK_RULE', provider: 'none', model: 'none',
      reason: `No LLM available (${errors.join(' | ') || 'no keys'})`.slice(0, 300), attempts: totalAttempts,
    };
  }

  fs.writeFileSync('decision.txt', result.decision);
  fs.writeFileSync('source.txt', result.source);
  fs.writeFileSync('decision.json', JSON.stringify({ ...result, context: ctx }, null, 2));

  console.log('');
  console.log('==============================================');
  console.log(` DECISION SOURCE : ${result.source}`);
  console.log(` DECISION        : ${result.decision}`);
  console.log(` PROVIDER/MODEL  : ${result.provider} / ${result.model}`);
  console.log(` API ATTEMPTS    : ${result.attempts}`);
  if (result.confidence !== undefined) console.log(` CONFIDENCE      : ${result.confidence}`);
  console.log(` REASON          : ${result.reason}`);
  console.log('==============================================');
})();
