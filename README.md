# Thinking Layer v5.1 — Multi-Agent Debate Engine

A reasoning engine that runs four agents against every question — Crowd Signal
(live web search), Primary Analyst, Counter-Analyst, and Meta-Reviewer — then
gates anything the engine "learns" behind a fifth Fact-Check agent and a human
review queue before it can enter permanent memory. Protected by Clerk auth.

## v5.1 fixes two production bugs found on first deploy

**504 timeout on `/api/analyze`.** The v5.0 scaffold ran all 4 agents
sequentially inside ONE serverless function. That hit Vercel's hard 60-second
execution cap mid-chain. Fix: each agent is now its own endpoint —
`/api/agents/l7`, `/api/agents/primary`, `/api/agents/adversarial`,
`/api/agents/meta` — so no single invocation risks the cap, and the client
gets real progressive updates (Primary renders the moment it's back, instead
of waiting on all 4 before showing anything).

**Client crash on non-JSON error responses.** When a function does time out,
Vercel returns its own HTML/text error page, not JSON. The old client code
did `await response.json()` unconditionally and threw
`Unexpected token 'A', "An error o"... is not valid JSON` trying to parse it.
Fixed with `safeJsonFetch()` in the component, which checks `content-type`
before parsing and surfaces a readable error either way.

**Missing Clerk auth**, now added: `middleware.js` protects every route,
every API route also checks `auth()` itself server-side (defense-in-depth,
matching the documented production architecture), and `/sign-in` /
`/sign-up` pages are wired in.

## Project layout

```
components/ThinkingLayerChat.jsx   ← client. Calls only /api/* routes.
app/api/agents/l7/route.js         ← server. Crowd signal (web search).
app/api/agents/primary/route.js    ← server. Primary analyst.
app/api/agents/adversarial/route.js← server. Counter-analyst.
app/api/agents/meta/route.js       ← server. Meta-reviewer + learning extraction.
app/api/factcheck/route.js         ← server. Fact-check agent, writes to pending queue.
app/api/learnings/route.js         ← server. GET queue / PATCH approve-reject-edit.
lib/prompts.js                     ← server-only. All 5 system prompts + operator priors.
lib/anthropic.js                   ← server-only. Shared Anthropic API caller.
lib/storage.js                     ← server-only. Vercel KV, falls back to in-memory.
middleware.js                      ← Clerk route protection.
```

Your `ANTHROPIC_API_KEY` and Clerk secret key never reach the browser.

## Local setup

```bash
npm install
cp .env.example .env.local
# fill in .env.local: ANTHROPIC_API_KEY, and Clerk keys from dashboard.clerk.com
npm run dev
```

## Deploying

### 1. Push to GitHub

```bash
cd TL7-MultiAgent
git add -A
git commit -m "v5.1 — split agent endpoints (fixes 504 timeout), add Clerk auth"
git push
```

### 2. Vercel project settings

Environment Variables (Project Settings → Environment Variables):
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL` = `/sign-in`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL` = `/sign-up`

Get the Clerk keys by creating an application at dashboard.clerk.com — it's
free for this scale of usage.

### 3. Add Vercel KV (required for the review queue to persist)

Without this, `pendingLearnings` and `approvedLearnings` live in a
serverless function's memory and reset on every cold start.

- Vercel dashboard → Storage → Create Database → KV
- Connect it to this project — env vars auto-populate
- Redeploy

### 4. Redeploy

Push to `main`, or trigger manually from the Vercel dashboard. First load
will redirect to `/sign-in` — create an account, then you're in.

## Why the timeout fix matters beyond just "it works now"

Splitting into 4 endpoints isn't just a bandaid — it's the more correct
architecture. Each agent call is independently retryable, independently
cacheable, and a slow L7 web search no longer blocks Primary from starting
once it's back. It also means adding a 6th agent later doesn't push the
whole chain closer to the timeout ceiling — it's just one more fast call.

## Known gaps / next steps

- Conversation history is client-side only (localStorage) — fine for a
  single-device workflow, would need a database for cross-device sync.
- No rate limiting on the agent endpoints — each full analysis burns 4-5
  Sonnet requests per signed-in user; Clerk auth limits this to people you've
  approved, but doesn't cap request volume per user.
- L7's web search sometimes takes 15-20s on its own — if you see it timing
  out independently, consider trimming the search query or capping tool
  turns.
