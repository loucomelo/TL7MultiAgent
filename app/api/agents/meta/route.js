// app/api/agents/meta/route.js
import { auth } from "@clerk/nextjs/server";
import { META_REVIEWER_SYSTEM_PROMPT } from "../../../../lib/prompts";
import { callAgent } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { query, l7Data, primaryOutput, adversarialOutput, learningsHistory } = await req.json();
    if (!query?.trim() || !primaryOutput?.trim()) {
      return Response.json({ error: "Missing required fields." }, { status: 400 });
    }

    const userMsg = [
      `ORIGINAL QUESTION: ${query}`,
      l7Data ? `\nCROWD SIGNAL DATA:\n${JSON.stringify(l7Data, null, 2)}` : "",
      learningsHistory ? `\nPAST APPROVED LEARNINGS (for calibration):\n${learningsHistory}` : "",
      `\nPRIMARY ANALYST OUTPUT:\n${primaryOutput}`,
      `\nCOUNTER-ANALYST OUTPUT:\n${adversarialOutput || "(unavailable)"}`,
    ].filter(Boolean).join("\n\n");

    const metaOutput = await callAgent(META_REVIEWER_SYSTEM_PROMPT, userMsg);

    let engineLearning = null;
    const learningMatch = metaOutput.match(/ENGINE LEARNING:\s*(.+)/i);
    if (learningMatch && learningMatch[1].trim().toLowerCase() !== "none") {
      engineLearning = learningMatch[1].trim();
    }

    return Response.json({ metaOutput, engineLearning });
  } catch (err) {
    return Response.json({ error: err.message || "Meta-reviewer agent failed." }, { status: 500 });
  }
}
