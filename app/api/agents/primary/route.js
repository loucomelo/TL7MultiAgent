// app/api/agents/primary/route.js
import { auth } from "@clerk/nextjs/server";
import { OPERATOR_PRIORS, PRIMARY_SYSTEM_PROMPT } from "../../../../lib/prompts";
import { callAgent } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { query, l7Data, historyText, learningsHistory } = await req.json();
    if (!query?.trim()) return Response.json({ error: "Missing query." }, { status: 400 });

    const l7Section = l7Data
      ? `\nCROWD SIGNAL DATA (from L7 Agent — real search results):\n${JSON.stringify(l7Data, null, 2)}\n`
      : "\nCROWD SIGNAL DATA: L7 Agent returned no data. Reason about likely positioning from training knowledge, but flag this as unverified.\n";

    const userMsg = [
      OPERATOR_PRIORS,
      learningsHistory ? `\nAPPROVED ENGINE LEARNINGS (human-reviewed, apply these):\n${learningsHistory}\n` : "",
      l7Section,
      historyText ? `\nPRIOR CONVERSATION:\n${historyText}\n` : "",
      `\nREQUEST:\n${query}`,
    ].filter(Boolean).join("\n\n");

    const primaryOutput = await callAgent(PRIMARY_SYSTEM_PROMPT, userMsg);
    if (!primaryOutput?.trim()) throw new Error("Primary analyst returned empty response");

    return Response.json({ primaryOutput });
  } catch (err) {
    return Response.json({ error: err.message || "Primary agent failed." }, { status: 500 });
  }
}
