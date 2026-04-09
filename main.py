import os
import re
from typing import Any, Dict, List, Optional

import google.generativeai as genai
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


def _safe_lookup(source: Any, keys: List[str], default: Any = None) -> Any:
    """Safely pull values from a response object or dictionary."""
    if isinstance(source, dict):
        for key in keys:
            if key in source:
                return source[key]
        return default

    for key in keys:
        value = getattr(source, key, None)
        if value is not None:
            return value

    if hasattr(source, "get"):
        for key in keys:
            try:
                value = source.get(key)
                if value is not None:
                    return value
            except Exception:
                continue

    return default


def count_tokens(text: str) -> int:
    """Estimate token count for a text prompt.

    This function uses word-level tokenization for prompt length estimation.
    For exact tokenization, replace with a Gemini tokenizer helper when available.
    """
    return len(re.findall(r"\b\w+\b", text))


def calculate_tfidf_scores(text: str) -> List[Dict[str, float]]:
    """Calculate TF-IDF scores for each token in the original prompt text.

    This function preserves whitespace token boundaries so the UI can render
    word-level importance while keeping phrase spacing intact.
    Stop words are assigned a default score of 0.1.
    """
    if not text or not text.strip():
        return []

    tokens = re.split(r"(\s+)", text)
    normalized_text = "".join([token for token in tokens if token.strip()])

    try:
        vectorizer = TfidfVectorizer(stop_words="english")
        try:
            tfidf_matrix = vectorizer.fit_transform([normalized_text])
            feature_names = vectorizer.get_feature_names_out()
            scores = tfidf_matrix.toarray()[0]
            tfidf_scores = {feature: float(score) for feature, score in zip(feature_names, scores)}
        except ValueError:
            tfidf_scores = {}

        stop_words = set(vectorizer.get_stop_words() or [])

        result: List[Dict[str, float]] = []
        for token in tokens:
            if token.isspace() or token == "":
                result.append({"word": token, "score": -1.0})
                continue

            normalized = re.sub(r"[^a-z0-9]", "", token.lower())
            if not normalized:
                result.append({"word": token, "score": 0.0})
                continue

            if normalized in stop_words:
                score = 0.1
            else:
                score = tfidf_scores.get(normalized, 0.0)

            result.append({"word": token, "score": round(score, 4)})

        return result
    except Exception as err:
        raise RuntimeError(f"TF-IDF scoring failed: {err}") from err


def generate_content(prompt: str, model: str) -> Dict[str, Optional[object]]:
    """Call the Gemini API and return generated text and token usage metrics."""
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("Missing GEMINI_API_KEY in environment.")

    genai.configure(api_key=api_key)

    try:
        response = genai.generate_text(model=model, prompt=prompt)
        ai_response = _safe_lookup(response, ["text", "response", "output_text"], "")

        usage = _safe_lookup(response, ["usage", "metadata", "tokenUsage"], {})
        if usage is None:
            usage = {}

        if isinstance(usage, dict) and "metadata" in usage:
            usage = usage.get("metadata", usage)

        output_tokens = _safe_lookup(
            usage,
            ["outputTokens", "output_tokens", "output_token_count"],
            0,
        )

        if ai_response is None:
            ai_response = ""

        return {
            "ai_response": str(ai_response).strip(),
            "output_tokens": int(output_tokens),
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


class AnalyzeResponse(BaseModel):
    success: bool
    ai_response: str
    metrics: Dict[str, object]
    token_scores: List[Dict[str, float]]


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
            },
            "token_scores": token_scores,
        }
    except RuntimeError as err:
        raise HTTPException(status_code=500, detail=str(err))
    except Exception as err:
        raise HTTPException(status_code=500, detail=f"Unexpected server error: {err}")
