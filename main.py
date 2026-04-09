"""
TokenScope Backend API

A FastAPI-based backend for AI Prompt Analytics Dashboard.
Provides endpoints for analyzing prompts with OpenAI, calculating costs,
environmental impact, and TF-IDF token scores.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
from openai import OpenAI

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(
    title="TokenScope API",
    description="AI Prompt Analytics Dashboard Backend",
    version="1.0.0"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins for React frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global dictionaries for calculations
MODEL_PRICING = {
    "gpt-oss-20b": {
        "input": 0.0,  # Free model
        "output": 0.0   # Free model
    },
    "gpt-4o-mini": {
        "input": 0.15,  # USD per 1M tokens
        "output": 0.60   # USD per 1M tokens
    },
    "gpt-4": {
        "input": 30.0,  # USD per 1M tokens
        "output": 60.0   # USD per 1M tokens
    }
}

ENVIRONMENT_FACTORS = {
    "gpt-oss-20b": {
        "co2_per_1k": 0.02,       # grams CO2 per 1000 tokens (efficient open-source)
        "water_ml_per_query": 0.15,  # ml water per query
        "energy_wh": 0.15        # watt-hours per query
    },
    "gpt-4o-mini": {
        "co2_per_1k": 0.025,      # grams CO2 per 1000 tokens
        "water_ml_per_query": 0.22,  # ml water per query
        "energy_wh": 0.20        # watt-hours per query
    },
    "gpt-4": {
        "co2_per_1k": 0.04,       # grams CO2 per 1000 tokens
        "water_ml_per_query": 0.35,  # ml water per query
        "energy_wh": 0.30        # watt-hours per query
    }
}


def calculate_tfidf_scores(text: str) -> list:
    """
    Calculate TF-IDF scores for words in the given text.

    Args:
        text (str): The input text to analyze

    Returns:
        list: List of dictionaries with word and score pairs.
              Stop words default to score 0.1, other words get their TF-IDF scores.
    """
    try:
        # Initialize TF-IDF vectorizer with English stop words and no normalization
        vectorizer = TfidfVectorizer(stop_words='english', norm=None)

        # Fit and transform the text
        tfidf_matrix = vectorizer.fit_transform([text])
        feature_names = vectorizer.get_feature_names_out()
        scores = tfidf_matrix.toarray()[0]

        # Create scores dictionary and normalize so max score equals 1.0
        scores_dict = dict(zip(feature_names, scores))
        max_score = max(scores_dict.values(), default=1.0)
        if max_score <= 0:
            max_score = 1.0

        normalized_scores = {word: value / max_score for word, value in scores_dict.items()}

        # Get stop words set
        stop_words = set(vectorizer.get_stop_words())

        # Tokenize text to get all unique words
        words = text.lower().split()
        unique_words = set(words)

        result = []
        for word in unique_words:
            if word in normalized_scores:
                result.append({
                    "word": word,
                    "score": float(normalized_scores[word])
                })
            else:
                result.append({
                    "word": word,
                    "score": 0.1
                })

        return result

    except Exception as e:
        print(f"TF-IDF calculation error: {e}")
        return []


class AnalyzeRequest(BaseModel):
    """Request model for prompt analysis."""
    prompt: str
    model: str = "gpt-oss-20b"


@app.post("/api/v1/analyze")
async def analyze_prompt(request: AnalyzeRequest):
    """
    Analyze a prompt using OpenAI and return analytics.

    Args:
        request (AnalyzeRequest): The prompt and model to analyze

    Returns:
        dict: Analysis results including AI response, metrics, and token scores

    Raises:
        HTTPException: If prompt is empty or AI service fails
    """
    # Model mapping for OpenRouter
    OPENROUTER_MODEL_MAP = {
        "gemini-1.5-flash": "openrouter/free",
        "Gemini 1.5 Flash": "openrouter/free",
        "gpt-oss-20b": "openai/gpt-oss-20b",
        "GPT-4o": "openai/gpt-4o",
        "gpt-4o": "openai/gpt-4o"
    }
    
    # Validate input
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        # Configure OpenRouter API
        api_key = os.getenv("OPENROUTER_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="OPENROUTER_API_KEY not configured")

        client = OpenAI(base_url="https://openrouter.ai/api/v1", api_key=os.getenv("OPENROUTER_API_KEY"))

        # Map the model name to OpenRouter ID
        actual_model_id = OPENROUTER_MODEL_MAP.get(request.model, "openrouter/free")
        
        # Generate AI response
        response = client.chat.completions.create(
            model=actual_model_id,
            messages=[
                {"role": "system", "content": "You are a helpful assistant."},
                {"role": "user", "content": request.prompt}
            ]
        )
        ai_response = response.choices[0].message.content

        # Get token counts from response
        input_tokens = response.usage.prompt_tokens
        output_tokens = response.usage.completion_tokens
        total_tokens = response.usage.total_tokens

        # Calculate costs (use original request.model as key for pricing lookup)
        input_cost = (input_tokens / 1_000_000) * MODEL_PRICING.get(request.model, MODEL_PRICING["gpt-oss-20b"])["input"]
        output_cost = (output_tokens / 1_000_000) * MODEL_PRICING.get(request.model, MODEL_PRICING["gpt-oss-20b"])["output"]
        cost_usd = input_cost + output_cost

        # Calculate environmental impact
        env_factors = ENVIRONMENT_FACTORS.get(request.model, ENVIRONMENT_FACTORS["gpt-oss-20b"])
        carbon_g = (total_tokens / 1000) * env_factors["co2_per_1k"]
        water_ml = env_factors["water_ml_per_query"]
        energy_wh = env_factors["energy_wh"]

        # Calculate TF-IDF scores
        token_scores = calculate_tfidf_scores(request.prompt)

        return {
            "success": True,
            "ai_response": ai_response,
            "metrics": {
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "total_tokens": total_tokens,
                "cost_usd": round(cost_usd, 4),
                "carbon_g": round(carbon_g, 4),
                "water_ml": round(water_ml, 4),
                "energy_wh": round(energy_wh, 4)
            },
            "token_scores": token_scores
        }

    except Exception as e:
        error_str = str(e)
        print(f"AI service error: {error_str}")
        raise HTTPException(status_code=500, detail=f"AI service error: {error_str}")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "TokenScope API is running"}
