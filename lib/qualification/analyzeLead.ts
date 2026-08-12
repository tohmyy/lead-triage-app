import { LeadAIAnalysisBatchResponseSchema } from "@/lib/validation/aiSchemas";
import type { AnalyzeLeadInput } from "@/types/qualification";

const SYSTEM_PROMPT = `You extract structured buying and buyer signals from lead notes and job titles.

CRITICAL RULES:
1. Do NOT invent buying intent.
2. Do NOT infer a purchase timeline when none is stated.
3. Do NOT assume someone is a decision maker purely because they sound senior — classify from the title only when the title clearly indicates authority.
4. Do NOT assume budget.
5. Do NOT assume company size.
6. Do NOT assume industry.
7. Do NOT assume urgency.
8. Do NOT fabricate pain points.
9. Only extract information supported by the supplied lead data (notes and job title).
10. Use "unknown", false, null, or an empty array when information is unavailable.
11. Return structured JSON only — no markdown, no commentary.

For job titles, classify:
- seniority: executive | director | manager | specialist | entry_level | unknown
- department: short string or null
- decisionMaker: very_high | high | medium | low | unknown

Examples:
- CEO → executive / decisionMaker very_high
- Marketing Director → director / marketing / high
- Marketing Manager → manager / marketing / medium
- Intern → entry_level / low

For notes, extract only explicit or clearly stated signals.`;

function extractJson(text: string): string {
  const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
  if (jsonMatch) return jsonMatch[1];
  if (text.includes("{")) {
    const startIdx = text.indexOf("{");
    const endIdx = text.lastIndexOf("}");
    if (startIdx !== -1 && endIdx !== -1) {
      return text.substring(startIdx, endIdx + 1);
    }
  }
  return text;
}

async function analyzeBatch(leads: AnalyzeLeadInput[]) {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const model = process.env.GOOGLE_GENERATIVE_AI_MODEL;
  if (!apiKey) throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
  if (!model) throw new Error("GOOGLE_GENERATIVE_AI_MODEL not set");

  const payload = leads.map((lead) => ({
    leadId: lead.id,
    jobTitle: lead.jobTitle || null,
    notes: lead.notes || null,
  }));

  const userMessage = `Extract buying and buyer signals for each lead. Preserve each leadId exactly.

Leads JSON:
${JSON.stringify(payload)}

Respond with ONLY this JSON structure:
{
  "results": [
    {
      "leadId": "string",
      "signals": {
        "intent": {
          "level": "none|low|medium|high",
          "readyToPurchase": false,
          "requestedPricing": false,
          "requestedQuote": false,
          "requestedMeeting": false,
          "activelyComparing": false,
          "problemIdentified": false
        },
        "timeline": {
          "value": "immediate|within_1_month|1_3_months|3_6_months|unknown",
          "urgency": "low|medium|high|unknown"
        },
        "painPoints": [],
        "buyer": {
          "seniority": "executive|director|manager|specialist|entry_level|unknown",
          "department": null,
          "decisionMaker": "very_high|high|medium|low|unknown"
        },
        "explanationSignals": ["short factual signal phrases supported by the data"]
      }
    }
  ],
  "failedLeadIds": []
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: userMessage }],
          },
        ],
        systemInstruction: {
          parts: [{ text: SYSTEM_PROMPT }],
        },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.statusText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");

  const parsed = JSON.parse(extractJson(text));
  return LeadAIAnalysisBatchResponseSchema.parse(parsed);
}

/**
 * Batch-analyze leads for qualification signals via Gemini REST.
 * Associates results by leadId (never by array index alone).
 */
export async function analyzeLeadsWithAI(
  leads: AnalyzeLeadInput[],
  batchSize: number = 10,
) {
  if (!leads.length) {
    return { results: [], failedLeadIds: [] as string[], totalProcessed: 0 };
  }

  const allResults: Awaited<ReturnType<typeof analyzeBatch>>["results"] = [];
  const failedLeadIds: string[] = [];

  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    try {
      const data = await analyzeBatch(batch);
      const returnedIds = new Set(data.results.map((r) => r.leadId));

      for (const result of data.results) {
        allResults.push(result);
      }

      for (const lead of batch) {
        if (!returnedIds.has(lead.id)) {
          failedLeadIds.push(lead.id);
        }
      }

      if (data.failedLeadIds?.length) {
        for (const id of data.failedLeadIds) {
          if (!failedLeadIds.includes(id)) failedLeadIds.push(id);
        }
      }
    } catch (error) {
      console.error(
        `analyzeLeadsWithAI batch ${Math.floor(i / batchSize) + 1} failed:`,
        error,
      );
      for (const lead of batch) {
        failedLeadIds.push(lead.id);
      }
    }
  }

  // Drop any results that also appear in failedLeadIds (AI marked failure)
  const failedSet = new Set(failedLeadIds);
  const results = allResults.filter((r) => !failedSet.has(r.leadId));

  return {
    results,
    failedLeadIds: [...failedSet],
    totalProcessed: results.length,
  };
}
