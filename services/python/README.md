# Python Microservice

FastAPI service: sentiment analysis + knowledge base search (ChromaDB).

## Setup

### 1. Create Virtual Environment

Use **Python 3.12** (PyTorch does not fully support 3.13 yet):

```bash
cd services/python
py -3.12 -m venv .venv

# Windows
.venv\Scripts\activate

# macOS/Linux
source .venv/bin/activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

Note: First run downloads the sentiment model (~250MB) and indexing loads sentence-transformers + ChromaDB.

### 3. Start the Service

```bash
uvicorn server:app --host 0.0.0.0 --port 8000
```

Or with auto-reload for development:

```bash
uvicorn server:app --host 0.0.0.0 --port 8000 --reload
```

## API

### POST /analyze

Analyze sentiment of text.

**Request:**

```json
{
   "text": "The food was amazing but the service was terrible"
}
```

**Response:**

```json
{
   "sentiment": "NEGATIVE",
   "confidence": 0.87
}
```

### POST /search_kb

Search the knowledge base for product chunks.

**Request:**

```json
{
   "query": "laptop battery",
   "top_k": 3
}
```

**Response:**

```json
{
   "chunks": [
      {
         "text": "Battery: Up to 17 hours...",
         "metadata": { "source": "laptop_pro_x1.txt", "chunk_index": 0 },
         "score": 0.85
      }
   ]
}
```

**KB indexing:** Run `python index_kb.py --rebuild` from `services/python` (loads from `../../data/products`). ChromaDB stored at `./chroma_db` by default.

### GET /health

Health check endpoint.

**Response:**

```json
{
   "status": "healthy",
   "model": "distilbert-base-uncased-finetuned-sst-2-english"
}
```

## Testing

```bash
# Test sentiment analysis
curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"This product is amazing!"}'

# Expected: {"sentiment":"POSITIVE","confidence":0.9998}

curl -X POST http://localhost:8000/analyze \
  -H "Content-Type: application/json" \
  -d '{"text":"Terrible experience, would not recommend"}'

# Expected: {"sentiment":"NEGATIVE","confidence":0.9997}
```

## Model

Uses `distilbert-base-uncased-finetuned-sst-2-english`:

- 66M parameters
- Fine-tuned on SST-2 (Stanford Sentiment Treebank)
- Binary classification: POSITIVE / NEGATIVE
- Inference time: ~50-150ms on CPU
