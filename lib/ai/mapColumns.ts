import { ColumnMappingResponseSchema } from "@/lib/validation/aiSchemas";
import type { ColumnMappingRequest } from "@/types/column";

const SEMANTIC_FIELDS = [
  "leadId",
  "createdAt",
  "name",
  "email",
  "phone",
  "company",
  "employeeCount",
  "website",
  "jobTitle",
  "industry",
  "location",
  "source",
  "budget",
  "productInterest",
  "notes",
  "other",
  "ignore",
];

const SYSTEM_PROMPT = `You are a data analyst expert at understanding CSV lead export structures.

Your task is to analyze column names and sample values, then classify each column into a normalized semantic field.

Available semantic fields:
${SEMANTIC_FIELDS.join("\n")}

CRITICAL RULES:
1. Do not invent information.
2. Do not assume missing columns exist.
3. Prefer semantic field "other" if uncertain what a column represents.
4. Only map to "ignore" if the column appears irrelevant or duplicate.
5. For notes/messages/comments columns, map to "notes".
6. For employee count variations, map to "employeeCount".
7. Provide confidence scores 0.0-1.0 based on certainty.
8. Always return valid JSON with the exact structure requested.

You MUST respond with ONLY valid JSON, no other text.`;

export async function mapColumnsWithAI(request: ColumnMappingRequest) {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    const model = process.env.GOOGLE_GENERATIVE_AI_MODEL;
    if (!apiKey) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
    }
    if (!model) {
      throw new Error("GOOGLE_GENERATIVE_AI_MODEL not set");
    }

    const userMessage = `Analyze these CSV columns and classify each into a normalized semantic field.

Columns:
${request.columns
  .map(
    (col) => `
Name: ${col.name}
Samples: ${col.samples.join("; ")}
`,
  )
  .join("\n")}

Respond with ONLY this JSON structure (no markdown, no explanation):
{
  "mappings": [
    {
      "originalColumn": "string",
      "normalizedField": "string (must be one of: ${SEMANTIC_FIELDS.join(", ")})",
      "confidence": number (0.0-1.0),
      "reason": "string explaining the classification"
    }
  ]
}`;


    const response = await fetch(
       `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    //   `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey},
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
    const errorBody = await response.text();

    console.error("Gemini API error:", {
        status: response.status,
        statusText: response.statusText,
        body: errorBody,
    });

    throw new Error(
        `Gemini API error: ${response.status} ${response.statusText}`
    );
    }
    const data = await response.json();

    console.log("\n=== mapColumnsWithAI: RAW API RESPONSE ===");
    console.log(JSON.stringify(data, null, 2));
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No response from Gemini");
    }

    console.log("\n=== mapColumnsWithAI: EXTRACTED TEXT FROM RESPONSE ===");
    console.log(text);

    // Extract JSON from response (handle markdown code blocks)
    let jsonText = text;
    const jsonMatch = text.match(/```json\n?([\s\S]*?)\n?```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1];
    } else if (text.includes("{")) {
      // Extract first JSON object
      const startIdx = text.indexOf("{");
      const endIdx = text.lastIndexOf("}");
      if (startIdx !== -1 && endIdx !== -1) {
        jsonText = text.substring(startIdx, endIdx + 1);
      }
    }

    console.log("\n=== mapColumnsWithAI: PARSED JSON ===");
    const parsed = JSON.parse(jsonText);
    console.log(JSON.stringify(parsed, null, 2));

    console.log("\n=== mapColumnsWithAI: VALIDATED SCHEMA ===");
    const validated = ColumnMappingResponseSchema.parse(parsed);
    console.log(JSON.stringify(validated, null, 2));

    return { success: true, data: validated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: message };
  }
}
