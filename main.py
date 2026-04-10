import os
import re
import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, validator
from sklearn.feature_extraction.text import TfidfVectorizer

load_dotenv()

MODEL_PRICING = {
    "gemini-1.5-flash": {"input": 0.075, "output": 0.30}
}

ENVIRONMENT_FACTORS = {
    "gemini-1.5-flash": {
        "co2_per_1k": 0.03,
        "water_ml_per_query": 0.26,
        "energy_wh": 0.24,
    }
}

# Map our model IDs to OpenRouter model identifiers
OPENROUTER_MODEL_MAP = {
    "gemini-1.5-flash": "google/gemini-2.0-flash-001",
}

app = FastAPI(
    title="TokenScope AI Prompt Analytics",
    description="Backend for prompt analytics, cost, and environmental impact metrics.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def count_tokens(text: str) -> int:
    """Estimate token count for a text prompt.

    This function uses word-level tokenization for prompt length estimation.
    For exact tokenization, replace with a Gemini tokenizer helper when available.
    """
    return len(re.findall(r"\b\w+\b", text))


def calculate_tfidf_scores(text: str) -> List[Dict[str, Any]]:
    """Calculate TF-IDF scores for each token in the original prompt text.

    This function preserves whitespace token boundaries so the UI can render
    word-level importance while keeping phrase spacing intact.
    Stop words are assigned a default score of 0.1.
    """
    if not text or not text.strip():
        return []

    # Improved splitting to better capture punctuation and words
    tokens = re.split(r"(\s+)", text)
    
    # Use a single-document TF-IDF approach
    try:
        words_only = [re.sub(r"[^a-z0-9]", "", t.lower()) for t in tokens if t.strip()]
        words_only = [w for w in words_only if w]
        
        if not words_only:
            return [{"word": t, "score": -1.0 if t.isspace() else 0.0} for t in tokens]

        vectorizer = TfidfVectorizer(stop_words="english")
        tfidf_matrix = vectorizer.fit_transform([" ".join(words_only)])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]
        tfidf_scores = {feature: float(score) for feature, score in zip(feature_names, scores)}
        
        stop_words = set(vectorizer.get_stop_words() or [])

        result: List[Dict[str, Any]] = []
        for token in tokens:
            if not token.strip():
                result.append({"word": token, "score": -1.0})
                continue

            normalized = re.sub(r"[^a-z0-9]", "", token.lower())
            if not normalized:
                result.append({"word": token, "score": 0.0})
                continue

            if normalized in stop_words:
                score = 0.1
            else:
                # Boost scores for display visibility
                raw_score = tfidf_scores.get(normalized, 0.0)
                score = min(raw_score * 5.0, 1.0) if raw_score > 0 else 0.0

            result.append({"word": token, "score": round(score, 4)})

        return result
    except Exception as err:
        print(f"TF-IDF error: {err}")
        return [{"word": t, "score": -1.0 if t.isspace() else 0.0} for t in tokens]


def _call_openrouter(prompt: str, model: str, api_key: str) -> Dict[str, Any]:
    """Call the OpenRouter API (OpenAI-compatible)."""
    openrouter_model = OPENROUTER_MODEL_MAP.get(model, "google/gemini-2.0-flash-001")

    # Add a system-like instruction to improve response quality
    system_instruction = "You are a helpful AI assistant. Provide clear, concise, and well-structured responses. Use plain text and avoid excessive special characters unless necessary for code blocks."
    
    body_dict = {
        "model": openrouter_model,
        "messages": [
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": prompt}
        ],
    }
    body = json.dumps(body_dict).encode("utf-8")

    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": "http://localhost:8080",
        "X-Title": "TokenScope AI",
    }

    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/chat/completions",
        data=body,
        headers=headers,
    )

    try:
        resp = urllib.request.urlopen(req, timeout=30)
        data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        error_body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"OpenRouter API error {e.code}: {error_body}") from e
    except Exception as e:
        raise RuntimeError(f"OpenRouter request failed: {e}") from e

    # Extract response text
    ai_response = ""
    choices = data.get("choices", [])
    if choices:
        ai_response = choices[0].get("message", {}).get("content", "")

    # Extract token usage
    usage = data.get("usage", {})
    input_tokens_api = usage.get("prompt_tokens", 0)
    output_tokens = usage.get("completion_tokens", 0)

    return {
        "ai_response": str(ai_response).strip(),
        "output_tokens": int(output_tokens),
        "input_tokens_api": int(input_tokens_api),
    }


def _call_gemini(prompt: str, model: str, api_key: str) -> Dict[str, Any]:
    """Call the Google Gemini SDK directly."""
    import google.generativeai as genai

    genai.configure(api_key=api_key)

    try:
        gemini_model = genai.GenerativeModel(model)
        response = gemini_model.generate_content(prompt)

        ai_response = ""
        if response and response.text:
            ai_response = response.text

        # Extract token counts from usage_metadata
        output_tokens = 0
        input_tokens_api = 0
        if hasattr(response, "usage_metadata") and response.usage_metadata:
            meta = response.usage_metadata
            output_tokens = getattr(meta, "candidates_token_count", 0) or 0
            input_tokens_api = getattr(meta, "prompt_token_count", 0) or 0

        return {
            "ai_response": str(ai_response).strip(),
            "output_tokens": int(output_tokens),
            "input_tokens_api": int(input_tokens_api),
        }
    except Exception as err:
        raise RuntimeError(f"Gemini content generation failed: {err}") from err


class AnalyzeRequest(BaseModel):
    prompt: str = Field(..., title="Prompt Text", min_length=1)
    model: str = Field("gemini-1.5-flash", title="Gemini Model")

    @validator("prompt")
    def prompt_must_not_be_empty(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Prompt must not be empty.")
        return value


def generate_content(prompt: str, model: str) -> Dict[str, Any]:
    """Call an LLM via OpenRouter and return generated text and token usage metrics.

    Uses the OpenRouter API (openrouter.ai) which supports many models via a
    single OpenAI-compatible endpoint. Falls back to GEMINI_API_KEY + google
    SDK if OPENROUTER_API_KEY is not set.
    """
    api_key = os.getenv("OPENROUTER_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError(
            "Missing API key. Set OPENROUTER_API_KEY or GEMINI_API_KEY in your .env file."
        )

    # Determine which path to use
    use_openrouter = bool(os.getenv("OPENROUTER_API_KEY"))

    if use_openrouter:
        return _call_openrouter(prompt, model, api_key)
    else:
        return _call_gemini(prompt, model, api_key)


class TokenScore(BaseModel):
    word: str
    score: float


class AnalyzeResponse(BaseModel):
    success: bool
    ai_response: str
    metrics: Dict[str, Any]
    token_scores: List[TokenScore]


@app.post("/api/v1/analyze", response_model=AnalyzeResponse)
async def analyze_prompt(request: AnalyzeRequest):
    """Analyze a prompt and return AI response, token costs, and environmental metrics."""
    prompt = request.prompt.strip()
    model = request.model.strip() or "gemini-1.5-flash"

    if model not in MODEL_PRICING or model not in ENVIRONMENT_FACTORS:
        raise HTTPException(status_code=400, detail="Unsupported model specified.")

    try:
        input_tokens = count_tokens(prompt)
        content_result = generate_content(prompt, model)
        output_tokens = content_result["output_tokens"]

        # Prefer the API's input token count if available, fall back to local estimate
        if content_result.get("input_tokens_api", 0) > 0:
            input_tokens = content_result["input_tokens_api"]

        pricing = MODEL_PRICING[model]
        environment = ENVIRONMENT_FACTORS[model]
        total_tokens = input_tokens + output_tokens

        cost_usd = round(
            (input_tokens / 1_000_000) * pricing["input"]
            + (output_tokens / 1_000_000) * pricing["output"],
            6,
        )

        carbon_g = round((total_tokens / 1_000) * environment["co2_per_1k"], 6)
        water_ml = round(environment["water_ml_per_query"], 6)
        energy_wh = round(environment["energy_wh"], 6)

        token_scores = calculate_tfidf_scores(prompt)

        return {
            "success": True,
            "ai_response": content_result["ai_response"],
            "metrics": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost_usd": cost_usd,
                "carbon_g": carbon_g,
                "water_ml": water_ml,
                "energy_wh": energy_wh,
            },
            "token_scores": token_scores,
        }
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {err}")
