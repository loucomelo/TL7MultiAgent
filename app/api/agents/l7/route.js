// app/api/agents/l7/route.js
// Each agent now lives in its own route so a single invocation never risks
// the 60s platform cap. This also restores true progressive updates on the
// client — no more waiting on one giant call then parsing one giant JSON blob.

import { auth } from "@clerk/nextjs/server";
import { L7_SYSTEM_PROMPT } from "../../../../lib/prompts";
import { callAgent } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req) {
  const { userId } = await auth();
  if (!userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { query } = await req.json();
    if (!query?.trim()) return Response.json({ error: "Missing query." }, { status: 400 });

    const searchQuery = `Search for recent crowd sentiment, Reddit discussions, and prediction market odds on: ${query}. Look at r/wallstreetbets, r/stocks, r/investing, StockTwits, Polymarket, and Kalshi.`;

    let l7Data;
    try {
      const raw = await callAgent(L7_SYSTEM_PROMPT, searchQuery, true);
      const cleaned = raw.replace(/```json|```/g, "").trim();
      l7Data = JSON.parse(cleaned);
    } catch (e) {
      l7Data = {
        sentiment: "unknown",
        positioning: "mixed",
        divergence: "none",
        confidence: "low",
        raw_signals: [],
        prediction_markets: "unable to parse structured data",
        summary: "Crowd signal search failed or returned unparsable data.",
      };
    }

    return Response.json({ l7Data });
  } catch (err) {
    return Response.json({ error: err.message || "L7 agent failed." }, { status: 500 });
  }
}
