# python-service/server.py
# FastAPI sentiment analysis microservice using Hugging Face transformers

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Sentiment Analysis Service")

# Load sentiment model on startup (cached in memory)
logger.info("Loading sentiment analysis model...")
sentiment_pipeline = pipeline(
    "sentiment-analysis",
    model="distilbert-base-uncased-finetuned-sst-2-english"
)
logger.info("Sentiment model loaded successfully")


class AnalyzeRequest(BaseModel):
    text: str


class AnalyzeResponse(BaseModel):
    sentiment: str  # "POSITIVE" or "NEGATIVE"
    confidence: float


@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_sentiment(request: AnalyzeRequest):
    """
    Analyze the sentiment of the provided text.
    Returns sentiment (POSITIVE/NEGATIVE) and confidence score.
    """
    if not request.text or not request.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")

    try:
        # Run sentiment analysis
        result = sentiment_pipeline(request.text[:512])[0]  # Truncate to model max length
        
        return AnalyzeResponse(
            sentiment=result["label"],  # "POSITIVE" or "NEGATIVE"
            confidence=round(result["score"], 4)
        )
    except Exception as e:
        logger.error(f"Sentiment analysis error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "model": "distilbert-base-uncased-finetuned-sst-2-english"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
