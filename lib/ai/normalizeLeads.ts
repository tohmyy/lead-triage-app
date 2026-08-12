import { SemanticNormalizationBatchResponseSchema } from "@/lib/validation/aiSchemas";
import type { NormalizedLead, RawRow } from "@/types/lead";
import type { ColumnMapping } from "@/types/column";

const SYSTEM_PROMPT = `You are an expert at normalizing and standardizing lead data fields.

Your task is to normalize free-form lead data like job titles, industries, and notes.

CRITICAL RULES:
1. Do NOT invent information.
2. Do NOT infer missing values as facts.
3. Do NOT fabricate company information.
4. Do NOT fabricate budget.
5. Do NOT fabricate employee count.
6. Do NOT fabricate intent.
7. Do NOT fabricate information from lead notes.
8. Preserve original notes - do not modify them.
9. Prefer the original value when uncertain.
10. Use null when appropriate.
11. Only normalize when the meaning is clear.
12. Return structured JSON only.
13. Include confidence (0.0-1.0) for each normalization.
14. Do not over-normalize - preserve nuance.

For job titles:
- Normalize common variations of the same role
- Preserve actual titles when uncertain
- Examples: CEO, Chief Executive Officer, C.E.O. → CEO

For industries:
- Normalize industry categories
- Preserve when uncertain
- Examples: FinTech, Financial Technology → Fintech

For location:
- Preserve the format unless obviously malformed
- Do not guess missing country codes

For lead notes:
- Preserve the original text
- Create "normalizedNotes" only if a meaningful summary is appropriate
- Do not rewrite or alter the original meaning`;

type LeadForNormalization = {
  id: string;
  jobTitle?: string | null;
  industry?: string | null;
  location?: string | null;
  productInterest?: string | null;
  notes?: string | null;
};

export async function normalizeLeadsWithAI(
  leads: LeadForNormalization[],
  batchSize: number = 10,
) {
  if (!leads.length) return { results: [], totalProcessed: 0, failures: 0 };

  const allResults = [];
  let totalProcessed = 0;
  let totalFailures = 0;

  // Process in batches
  for (let i = 0; i < leads.length; i += batchSize) {
    const batch = leads.slice(i, i + batchSize);
    
    try {
      const result = await normalizeBatch(batch);
      
      if (result.success && result.data) {
        allResults.push(...result.data.results);
        totalProcessed += result.data.results.length;
        totalFailures += result.data.failedIndices?.length || 0;
      } else {
        totalFailures += batch.length;
      }
    } catch (error) {
      console.error(`Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
      totalFailures += batch.length;
    }
  }

  return { results: allResults, totalProcessed, failures: totalFailures };
}

async function normalizeBatch(leads: LeadForNormalization[]) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const model = process.env.GOOGLE_GENERATIVE_AI_MODEL;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
    }
    if (!model) {
      throw new Error("GOOGLE_GENERATIVE_AI_MODEL not set");
    }

    const userMessage = `Normalize these lead records. Return normalized values and confidence scores.

Leads JSON:
${JSON.stringify(leads, null, 2)}

Respond with ONLY this JSON structure (no other text):
{
  "results": [
    {
      "leadId": "string",
      "normalized": {
        "jobTitle": "string or null",
        "industry": "string or null",
        "location": "string or null",
        "productInterest": "string or null",
        "normalizedNotes": "string or null"
      },
      "changes": [
        {
          "field": "string",
          "originalValue": "string or null",
          "normalizedValue": "string or null",
          "confidence": number (0.0-1.0)
        }
      ]
    }
  ],
  "failedIndices": []
}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
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
    
    console.log("\n=== normalizeLeadsWithAI: RAW API RESPONSE ===");
    console.log(JSON.stringify(data, null, 2));
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No response from Gemini");
    }

    console.log("\n=== normalizeLeadsWithAI: EXTRACTED TEXT FROM RESPONSE ===");
    console.log(text);

    // Extract JSON from response
    let jsonText = text;
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else if (text.includes("{")) {
      const startIdx = text.indexOf("{");
      const endIdx = text.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        jsonText = text.substring(startIdx, endIdx + 1);
      }
    }

    console.log("\n=== normalizeLeadsWithAI: PARSED JSON ===");
    const parsed = JSON.parse(jsonText);
    console.log(JSON.stringify(parsed, null, 2));
    
    console.log("\n=== normalizeLeadsWithAI: VALIDATED SCHEMA ===");
    const validated = SemanticNormalizationBatchResponseSchema.parse(parsed);
    console.log(JSON.stringify(validated, null, 2));

    return { success: true, data: validated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Batch normalization error:", message);
    return { success: false, error: message };
  }
}
