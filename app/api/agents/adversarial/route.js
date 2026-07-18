// app/api/agents/adversarial/route.js
import { auth } from "@clerk/nextjs/server";
import { OPERATOR_PRIORS, ADVERSARIAL_SYSTEM_PROMPT } from "../../../../lib/prompts";
import { callAgent } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { query, primaryOutput, l7Data } = await req.json();
    if (!query?.trim() || !primaryOutput?.trim()) {
      return Response.json({ error: "Missing query or primaryOutput." }, { status: 400 });
    }

    const userMsg = [
      OPERATOR_PRIORS,
      l7Data ? `\nCROWD SIGNAL DATA:\n${JSON.stringify(l7Data, null, 2)}\n` : "",
      `\nORIGINAL QUESTION: ${query}`,
      `\nPRIMARY ANALYSIS (you did NOT write this — your job is to challenge it):\n${primaryOutput}`,
    ].filter(Boolean).join("\n\n");

    const adversarialOutput = await callAgent(ADVERSARIAL_SYSTEM_PROMPT, userMsg);
    return Response.json({ adversarialOutput });
  } catch (err) {
    return Response.json({ error: err.message || "Adversarial agent failed." }, { status: 500 });
  }
}
