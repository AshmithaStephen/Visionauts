export interface AnalyzeRequest {
  prompt: string;
  model?: string;
}

export interface AnalyzeResponse {
  success: boolean;
  ai_response: string;
  metrics: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    cost_usd: number;
    carbon_g: number;
    water_ml: number;
  };
  token_scores: Array<{ word: string; score: number }>;
}

const baseUrl = import.meta.env.VITE_API_BASE_URL?.replace(/\/$/, "") ?? "";

export async function analyzePrompt(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  const response = await fetch(`${baseUrl}/api/v1/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const responseBody = await response.json().catch(() => null);
  if (!response.ok) {
    const errorMessage = responseBody?.detail || response.statusText || "Failed to analyze prompt";
    throw new Error(errorMessage);
  }

  return responseBody as AnalyzeResponse;
}
