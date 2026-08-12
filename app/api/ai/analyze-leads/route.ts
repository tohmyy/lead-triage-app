import { analyzeLeadsWithAI } from "@/lib/qualification/analyzeLead";

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
    const result = await analyzeLeadsWithAI(body.leads, batchSize);

    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
