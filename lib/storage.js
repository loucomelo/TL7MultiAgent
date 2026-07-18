// lib/storage.js
// Storage abstraction for the learnings review queue and approved memory.
// Uses Vercel KV when configured (KV_REST_API_URL / KV_REST_API_TOKEN env vars),
// falls back to a process-memory store for local dev — matches the operator's
// existing lib/storage.ts pattern described in the project architecture.

let kv = null;
try {
  // Only resolves if @vercel/kv is installed and env vars are present.
  if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    // eslint-disable-next-line global-require
    kv = require("@vercel/kv").kv;
  }
} catch {
  kv = null;
}

// In-memory fallback (dev only — resets on every serverless cold start in prod,
// which is exactly why KV is required for real deployments).
const memStore = {
  pendingLearnings: [],
  approvedLearnings: [],
};

export async function getPending() {
  if (kv) return (await kv.get("tl:pendingLearnings")) || [];
  return memStore.pendingLearnings;
}

export async function setPending(list) {
  if (kv) return kv.set("tl:pendingLearnings", list);
  memStore.pendingLearnings = list;
}

export async function getApproved() {
  if (kv) return (await kv.get("tl:approvedLearnings")) || [];
  return memStore.approvedLearnings;
}

export async function setApproved(list) {
  if (kv) return kv.set("tl:approvedLearnings", list);
  memStore.approvedLearnings = list;
}

export async function addPending(item) {
  const list = await getPending();
  list.push(item);
  await setPending(list);
  return item;
}

export async function updatePending(id, patch) {
  const list = await getPending();
  const next = list.map((p) => (p.id === id ? { ...p, ...patch } : p));
  await setPending(next);
  return next.find((p) => p.id === id);
}

export async function approvePending(id, useRewrite = true) {
  const pending = await getPending();
  const item = pending.find((p) => p.id === id);
  if (!item) return null;

  const text =
    useRewrite && item.factCheck?.suggested_rewrite
      ? item.factCheck.suggested_rewrite
      : item.raw;

  const approvedItem = {
    id: "a" + Date.now() + Math.random().toString(36).slice(2, 6),
    text: `[${new Date().toISOString().slice(0, 10)}] ${text}`,
    approvedFrom: item.raw,
    ts: Date.now(),
  };

  const approved = await getApproved();
  approved.push(approvedItem);
  await setApproved(approved);

  const nextPending = pending.map((p) =>
    p.id === id ? { ...p, status: "approved" } : p
  );
  await setPending(nextPending);

  return approvedItem;
}

export async function rejectPending(id) {
  const pending = await getPending();
  const next = pending.map((p) =>
    p.id === id ? { ...p, status: "rejected" } : p
  );
  await setPending(next);
}
