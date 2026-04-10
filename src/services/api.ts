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
    energy_wh: number;
  };
  token_scores: Array<{ word: string; score: number }>;
}

export async function analyzePrompt(payload: AnalyzeRequest): Promise<AnalyzeResponse> {
  try {
    const baseUrl = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";
    const apiUrl = `${baseUrl}/api/v1/analyze`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: payload.prompt,
        model: payload.model,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || `Server error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error: any) {
    // Re-throw the actual error message so the UI can display it
    throw new Error(error.message || "Network error: Failed to connect to backend");
  }
}
