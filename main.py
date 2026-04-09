"""
TokenScope Backend API

A FastAPI-based backend for AI Prompt Analytics Dashboard.
Provides endpoints for analyzing prompts with Gemini AI, calculating costs,
environmental impact, and TF-IDF token scores.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os
from dotenv import load_dotenv
from sklearn.feature_extraction.text import TfidfVectorizer
import google.generativeai as genai

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
    "gemini-1.5-flash": {
        "input": 0.075,  # USD per 1M tokens
        "output": 0.30   # USD per 1M tokens
    }
}

ENVIRONMENT_FACTORS = {
    "gemini-1.5-flash": {
        "co2_per_1k": 0.03,      # grams CO2 per 1000 tokens
        "water_ml_per_query": 0.26,  # ml water per query
        "energy_wh": 0.24        # watt-hours per query
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
    model: str = "gemini-1.5-flash"


@app.post("/api/v1/analyze")
async def analyze_prompt(request: AnalyzeRequest):
    """
    Analyze a prompt using Gemini AI and return analytics.

    Args:
        request (AnalyzeRequest): The prompt and model to analyze

    Returns:
        dict: Analysis results including AI response, metrics, and token scores

    Raises:
        HTTPException: If prompt is empty or AI service fails
    """
    # Validate input
    if not request.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty")

    try:
        # Configure Gemini API
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="GEMINI_API_KEY not configured")

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel(request.model)

        # Count input tokens
        input_token_count = model.count_tokens(request.prompt)
        input_tokens = input_token_count.total_tokens

        # Generate AI response
        response = model.generate_content(request.prompt)
        ai_response = response.text

        # Get usage metadata
        usage = response.usage_metadata
        total_tokens = usage.total_token_count
        output_tokens = total_tokens - input_tokens

        # Calculate costs
        input_cost = (input_tokens / 1_000_000) * MODEL_PRICING[request.model]["input"]
        output_cost = (output_tokens / 1_000_000) * MODEL_PRICING[request.model]["output"]
        cost_usd = input_cost + output_cost

        # Calculate environmental impact
        carbon_g = (total_tokens / 1000) * ENVIRONMENT_FACTORS[request.model]["co2_per_1k"]
        water_ml = ENVIRONMENT_FACTORS[request.model]["water_ml_per_query"]
        energy_wh = ENVIRONMENT_FACTORS[request.model]["energy_wh"]

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
        raise HTTPException(status_code=500, detail=f"AI service error: {str(e)}")


@app.get("/")
async def root():
    """Health check endpoint."""
    return {"message": "TokenScope API is running"}
