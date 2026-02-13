# python-service/server.py
# FastAPI microservice: sentiment analysis + KB search

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from transformers import pipeline
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="ChatBot Python Service")

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


class SearchKBRequest(BaseModel):
    query: str
    top_k: int = 3


class SearchKBChunkMetadata(BaseModel):
    source: str
    chunk_index: int


class SearchKBChunk(BaseModel):
    text: str
    metadata: SearchKBChunkMetadata
    score: float


class SearchKBResponse(BaseModel):
    chunks: list[SearchKBChunk]


@app.on_event("startup")
async def startup_event():
    """Initialize KB service on startup"""
    try:
        from kb_service import kb_service
        if kb_service.initialize():
            logger.info("KB service initialized successfully")
        else:
            logger.warning("KB service initialization failed (empty or missing ChromaDB)")
    except Exception as e:
        logger.error(f"KB service init error: {e}", exc_info=True)


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


@app.post("/search_kb", response_model=SearchKBResponse)
async def search_kb(request: SearchKBRequest):
    """
    Search the knowledge base for relevant chunks.
    Returns { chunks: [...] } matching python-kb-client.ts contract.
    On empty/failed: returns { chunks: [] } with 200 (never 500). Logs all failures.
    """
    try:
        from kb_service import kb_service

        if not kb_service._initialized:
            logger.warning("[search_kb] KB not initialized, returning empty chunks")
            return SearchKBResponse(chunks=[])

        results = kb_service.search(request.query, request.top_k)

        # Map to exact TS contract: { text, metadata: { source, chunk_index }, score }
        chunks = []
        for r in results:
            meta = r.get("metadata") or {}
            source = meta.get("source") if isinstance(meta.get("source"), str) else str(meta.get("source", ""))
            chunk_index = meta.get("chunk_index")
            if chunk_index is not None and not isinstance(chunk_index, int):
                try:
                    chunk_index = int(chunk_index)
                except (ValueError, TypeError):
                    chunk_index = 0
            else:
                chunk_index = 0

            chunks.append(SearchKBChunk(
                text=str(r.get("text", "")),
                metadata=SearchKBChunkMetadata(source=source, chunk_index=chunk_index),
                score=float(r.get("score", 0.0)),
            ))

        return SearchKBResponse(chunks=chunks)

    except Exception as e:
        logger.error(f"[search_kb] KB search error: {e}", exc_info=True)
        return SearchKBResponse(chunks=[])


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
