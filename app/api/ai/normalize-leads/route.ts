import { normalizeLeadsWithAI } from "@/lib/ai/normalizeLeads";
import type { NormalizedLead } from "@/types/lead";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    if (!body.leads || !Array.isArray(body.leads)) {
      return Response.json(
        { error: "Invalid request: missing leads array" },
        { status: 400 },
      );
    }

    const batchSize = body.batchSize || 10;
    const result = await normalizeLeadsWithAI(body.leads, batchSize);

    console.log("\n=== API ROUTE: normalize-leads final result ===");
    console.log(JSON.stringify(result, null, 2));

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
