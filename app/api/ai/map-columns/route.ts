import { mapColumnsWithAI } from "@/lib/ai/mapColumns";
import type { ColumnMappingRequest } from "@/types/column";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ColumnMappingRequest;

    if (!body.columns || !Array.isArray(body.columns)) {
      return Response.json(
        { error: "Invalid request: missing columns array" },
        { status: 400 },
      );
    }

    const result = await mapColumnsWithAI(body);

    console.log("\n=== API ROUTE: map-columns final result ===");
    console.log(JSON.stringify(result, null, 2));

    if (!result.success) {
      return Response.json(
        { error: result.error },
        { status: 500 },
      );
    }

    return Response.json(result.data);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.log("message: ", message)
    return Response.json(
      { error: message },
      { status: 500 },
    );
  }
}
