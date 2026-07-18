# Thinking Layer v5.0 — Multi-Agent Debate Engine

A reasoning engine that runs four agents against every question — Crowd Signal
(live web search), Primary Analyst, Counter-Analyst, and Meta-Reviewer — then
gates anything the engine "learns" behind a fifth Fact-Check agent and a human
review queue before it can enter permanent memory.

## What changed from the artifact version

The Claude.ai artifact version called `api.anthropic.com` directly from the
browser. That's fine inside claude.ai (the platform proxies it), but in a real
deployment it would put your API key in the client bundle for anyone to steal.
This project moves every agent call server-side:

```
components/ThinkingLayerChat.jsx   ← client. Calls only /api/* routes.
app/api/analyze/route.js           ← server. Runs L7 → Primary → Adversarial → Meta.
app/api/factcheck/route.js         ← server. Runs the Fact-Check agent, stores result.
app/api/learnings/route.js         ← server. GET queue / PATCH approve-reject-edit.
lib/prompts.js                     ← server-only. All 5 system prompts + operator priors.
lib/storage.js                     ← server-only. Vercel KV, falls back to in-memory.
```

Your `ANTHROPIC_API_KEY` never reaches the browser.

## Local setup

```bash
npm install
cp .env.example .env.local
# edit .env.local and paste your real ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Without a KV store configured, the learnings
queue works fine locally but resets whenever the dev server restarts —
expected, not a bug.

## Deploying — I can't do this part for you

I don't have a GitHub connector available, and the Vercel connector I can see
only has read tools (list/inspect deployments) — nothing that creates a repo
or triggers a deploy. I also won't hold or enter your credentials on your
behalf. So this part is on you, but it's five steps:

### 1. Push to GitHub

```bash
cd thinking-layer
git init
git add .
git commit -m "Thinking Layer v5.0 — multi-agent debate + fact-check review queue"
```

Then either:
- **Web UI**: create a new empty repo at github.com/new, then:
  ```bash
  git remote add origin https://github.com/<your-username>/thinking-layer.git
  git branch -M main
  git push -u origin main
  ```
- **GitHub CLI** (if you have `gh` installed and are logged in):
  ```bash
  gh repo create thinking-layer --private --source=. --push
  ```

### 2. Import into Vercel

- Go to vercel.com/new
- Import the GitHub repo you just pushed
- Framework preset should auto-detect as Next.js — leave it

### 3. Set environment variables in Vercel

Project Settings → Environment Variables:
- `ANTHROPIC_API_KEY` — required
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` — see step 4

### 4. Add Vercel KV (required for the review queue to persist)

Without this, `pendingLearnings` and `approvedLearnings` live in a
serverless function's memory and reset on every cold start — meaning your
review queue will randomly lose items. This matches the storage
abstraction pattern already described in `chatgpt-learning.md`
(`lib/storage.ts` with in-memory fallback).

- In the Vercel dashboard: Storage → Create Database → KV
- Connect it to this project — Vercel auto-populates the env vars for you
- Redeploy

### 5. Deploy

Push to `main` and Vercel deploys automatically. Or trigger manually from
the Vercel dashboard.

## Architecture notes

- **Why one `/api/analyze` call instead of four separate requests?** Fewer
  round trips from the client, and it's the natural place for prompt caching
  optimizations later (the stable L1-L6 reasoning framework is a candidate
  for Anthropic's prompt caching once you're ready to wire that in).
- **Why does Fact-Check run *after* the response is shown?** So a slow or
  failed fact-check never blocks the operator from seeing their analysis.
  The candidate learning shows up in the Review tab once it's ready.
- **Why gate every verdict, even "trustworthy" ones?** A trustworthy verdict
  from the Fact-Checker is still one LLM's opinion of another LLM's output —
  it reduces risk, it doesn't eliminate it. See the CRWD NRR case study in
  `chatgpt-learning.md` for the concrete example that motivated this.

## Known gaps / next steps

- Conversation history is client-side only (localStorage) — fine for a
  single-device workflow, would need a database for cross-device sync.
- No rate limiting on `/api/analyze` — add before sharing the URL publicly,
  since each call burns 4 Sonnet requests.
- No auth on any route — anyone with the URL can run analyses and burn your
  API budget. Add a simple password gate or Vercel's built-in auth before
  this goes anywhere other than your own use.
