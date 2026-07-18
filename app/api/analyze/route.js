// app/api/analyze/route.js
// Server-side orchestrator. The client calls this ONE endpoint; the API key
// never leaves the server. Runs L7 -> Primary -> Adversarial -> Meta in
// sequence and returns the composed result plus a candidate learning (if any)
// for the client to send to /api/factcheck next.

import {
  OPERATOR_PRIORS,
  L7_SYSTEM_PROMPT,
  PRIMARY_SYSTEM_PROMPT,
  ADVERSARIAL_SYSTEM_PROMPT,
  META_REVIEWER_SYSTEM_PROMPT,
} from "../../../lib/prompts";

export const runtime = "nodejs";
export const maxDuration = 60; // seconds — 4 sequential Sonnet calls needs headroom

async function callAgent(systemPrompt, userMessage, useSearch = false) {
  const body = {
    model: "claude-sonnet-4-6",
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  };
  if (useSearch) {
    body.tools = [{ type: "web_search_20250305", name: "web_search" }];
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "Unknown error");
    throw new Error(`Agent call failed (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return data.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .filter(Boolean)
    .join("\n");
}

async function runL7Agent(query) {
  const searchQuery = `Search for recent crowd sentiment, Reddit discussions, and prediction market odds on: ${query}. Look at r/wallstreetbets, r/stocks, r/investing, StockTwits, Polymarket, and Kalshi.`;
  const raw = await callAgent(L7_SYSTEM_PROMPT, searchQuery, true);
  try {
    const cleaned = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(cleaned);
  } catch {
    return {
      sentiment: "unknown",
      positioning: "mixed",
      divergence: "none",
      confidence: "low",
      raw_signals: [],
      prediction_markets: "unable to parse structured data",
      summary: raw.slice(0, 500),
    };
  }
}

async function runPrimaryAgent(query, l7Data, historyText, learningsHistory) {
  const l7Section = l7Data
    ? `\nCROWD SIGNAL DATA (from L7 Agent — real search results):\n${JSON.stringify(l7Data, null, 2)}\n`
    : "\nCROWD SIGNAL DATA: L7 Agent returned no data. Reason about likely positioning from training knowledge, but flag this as unverified.\n";

  const userMsg = [
    OPERATOR_PRIORS,
    learningsHistory ? `\nAPPROVED ENGINE LEARNINGS (human-reviewed, apply these):\n${learningsHistory}\n` : "",
    l7Section,
    historyText ? `\nPRIOR CONVERSATION:\n${historyText}\n` : "",
    `\nREQUEST:\n${query}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return callAgent(PRIMARY_SYSTEM_PROMPT, userMsg);
}

async function runAdversarialAgent(query, primaryOutput, l7Data) {
  const userMsg = [
    OPERATOR_PRIORS,
    l7Data ? `\nCROWD SIGNAL DATA:\n${JSON.stringify(l7Data, null, 2)}\n` : "",
    `\nORIGINAL QUESTION: ${query}`,
    `\nPRIMARY ANALYSIS (you did NOT write this — your job is to challenge it):\n${primaryOutput}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return callAgent(ADVERSARIAL_SYSTEM_PROMPT, userMsg);
}

async function runMetaReviewer(query, l7Data, primaryOutput, adversarialOutput, learningsHistory) {
  const userMsg = [
    `ORIGINAL QUESTION: ${query}`,
    l7Data ? `\nCROWD SIGNAL DATA:\n${JSON.stringify(l7Data, null, 2)}` : "",
    learningsHistory ? `\nPAST APPROVED LEARNINGS (for calibration):\n${learningsHistory}` : "",
    `\nPRIMARY ANALYST OUTPUT:\n${primaryOutput}`,
    `\nCOUNTER-ANALYST OUTPUT:\n${adversarialOutput}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return callAgent(META_REVIEWER_SYSTEM_PROMPT, userMsg);
}

export async function POST(req) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 500 }
    );
  }

  try {
    const { query, historyText, learningsHistory } = await req.json();
    if (!query || !query.trim()) {
      return Response.json({ error: "Missing query." }, { status: 400 });
    }

    let l7Data = null;
    try {
      l7Data = await runL7Agent(query);
    } catch (e) {
      console.warn("L7 Agent failed:", e.message);
      l7Data = null;
    }

    const primaryOutput = await runPrimaryAgent(query, l7Data, historyText, learningsHistory);
    if (!primaryOutput?.trim()) {
      throw new Error("Primary analyst returned empty response");
    }

    let adversarialOutput = "";
    try {
      adversarialOutput = await runAdversarialAgent(query, primaryOutput, l7Data);
    } catch (e) {
      adversarialOutput = `*Counter-analyst unavailable: ${e.message}*`;
    }

    let metaOutput = "";
    let engineLearning = null;
    try {
      metaOutput = await runMetaReviewer(query, l7Data, primaryOutput, adversarialOutput, learningsHistory);
      const learningMatch = metaOutput.match(/ENGINE LEARNING:\s*(.+)/i);
      if (learningMatch && learningMatch[1].trim().toLowerCase() !== "none") {
        engineLearning = learningMatch[1].trim();
      }
    } catch (e) {
      metaOutput = `*Meta-reviewer unavailable: ${e.message}*`;
    }

    const composed = [
      primaryOutput,
      "",
      adversarialOutput,
      "",
      metaOutput,
      "",
      engineLearning
        ? "---\n*Candidate learning flagged — sent for fact-check, awaiting your review.*"
        : "",
      "",
      "Research and scenario analysis only — not personalised financial advice.",
    ]
      .filter((s) => s !== undefined)
      .join("\n");

    return Response.json({
      content: composed.trim(),
      l7Data,
      engineLearning,
      agents: { l7: !!l7Data, primary: true, adversarial: !!adversarialOutput, meta: !!metaOutput },
    });
  } catch (err) {
    return Response.json(
      { error: err.message || "Analysis pipeline failed." },
      { status: 500 }
    );
  }
}
