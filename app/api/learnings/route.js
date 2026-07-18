// app/api/learnings/route.js
// GET returns the current pending + approved learnings (for the Review tab).
// PATCH approves or rejects a pending item — this is the ONLY path by which
// anything reaches approvedLearnings and gets injected into future analyses.

import { getPending, getApproved, approvePending, rejectPending, updatePending } from "../../../lib/storage";

export const runtime = "nodejs";

export async function GET() {
  const [pending, approved] = await Promise.all([getPending(), getApproved()]);
  return Response.json({ pending, approved });
}

export async function PATCH(req) {
  try {
    const { id, action, useRewrite, editedText } = await req.json();
    if (!id || !action) {
      return Response.json({ error: "Missing id or action." }, { status: 400 });
    }

    if (action === "approve") {
      const approvedItem = await approvePending(id, useRewrite !== false);
      if (!approvedItem) return Response.json({ error: "Item not found." }, { status: 404 });
      return Response.json({ approved: approvedItem });
    }

    if (action === "reject") {
      await rejectPending(id);
      return Response.json({ ok: true });
    }

    if (action === "edit") {
      const updated = await updatePending(id, { raw: editedText, edited: true });
      return Response.json({ item: updated });
    }

    return Response.json({ error: "Unknown action." }, { status: 400 });
  } catch (err) {
    return Response.json({ error: err.message || "Update failed." }, { status: 500 });
  }
}
