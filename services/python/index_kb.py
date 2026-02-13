#!/usr/bin/env python3
# python-service/index_kb.py
# Script to index product documents into ChromaDB

import os
import sys
import argparse
import logging
from pathlib import Path
from typing import List, Tuple

import chromadb
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Configuration
CHROMA_DB_PATH = os.environ.get("CHROMA_DB_PATH", "./chroma_db")
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
COLLECTION_NAME = "products"
DATA_DIR = os.environ.get("DATA_DIR", "../../data/products")

# Chunking settings (word-based per rubric §3)
CHUNK_SIZE_WORDS = 400  # 200-500 words per chunk
CHUNK_OVERLAP_WORDS = 50


def chunk_text(
    text: str,
    chunk_size_words: int = CHUNK_SIZE_WORDS,
    overlap_words: int = CHUNK_OVERLAP_WORDS
) -> List[str]:
    """Split text into overlapping chunks by word count (200-500 words per chunk)."""
    words = text.split()
    if len(words) <= chunk_size_words:
        return [text.strip()] if text.strip() else []

    chunks = []
    start = 0
    while start < len(words):
        end = min(start + chunk_size_words, len(words))
        chunk_words = words[start:end]
        chunk = " ".join(chunk_words)

        # Optional: prefer sentence boundary near end
        if end < len(words) and chunk_size_words > 50:
            last_period = chunk.rfind(".")
            last_newline = chunk.rfind("\n")
            brk = max(last_period, last_newline)
            if brk > len(chunk) - 80:
                chunk = chunk[: brk + 1].strip()
                consumed = len(chunk.split())
                end = start + consumed

        chunks.append(chunk.strip())
        start = end - overlap_words
        if start < 0:
            start = 0

    return [c for c in chunks if c]


def load_documents(data_dir: str) -> List[Tuple[str, str]]:
    """Load all .txt files from data directory"""
    documents = []
    data_path = Path(data_dir)

    if not data_path.exists():
        logger.error(f"Data directory not found: {data_dir}")
        return documents

    for file_path in data_path.glob("*.txt"):
        try:
            content = file_path.read_text(encoding="utf-8")
            documents.append((file_path.name, content))
            logger.info(f"Loaded: {file_path.name} ({len(content)} chars)")
        except Exception as e:
            logger.error(f"Error loading {file_path}: {e}")

    return documents


def index_documents(rebuild: bool = False, data_dir: str = DATA_DIR):
    """Index documents into ChromaDB"""
    logger.info("=" * 60)
    logger.info("Starting KB indexing")
    logger.info("=" * 60)

    # Load embedding model
    logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
    model = SentenceTransformer(EMBEDDING_MODEL)
    logger.info("Model loaded")

    # Initialize ChromaDB
    logger.info(f"Initializing ChromaDB at: {CHROMA_DB_PATH}")
    client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

    # Handle rebuild flag
    if rebuild:
        try:
            client.delete_collection(COLLECTION_NAME)
            logger.info(f"Deleted existing collection: {COLLECTION_NAME}")
        except Exception:
            pass  # Collection doesn't exist

    # Create collection
    collection = client.get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"}
    )

    existing_count = collection.count()
    if existing_count > 0 and not rebuild:
        logger.info(f"Collection already has {existing_count} documents")
        logger.info("Use --rebuild to replace existing index")
        return

    # Load documents
    logger.info(f"Loading documents from: {data_dir}")
    documents = load_documents(data_dir)

    if not documents:
        logger.error("No documents found to index")
        return

    logger.info(f"Found {len(documents)} documents")

    # Process and index
    all_chunks = []
    all_metadatas = []
    all_ids = []

    for filename, content in documents:
        chunks = chunk_text(content)
        logger.info(f"  {filename}: {len(chunks)} chunks")

        for i, chunk in enumerate(chunks):
            chunk_id = f"{filename}_{i}"
            all_chunks.append(chunk)
            all_metadatas.append({
                "source": filename,
                "chunk_index": i,
                "language": "en"
            })
            all_ids.append(chunk_id)

    logger.info(f"Total chunks to index: {len(all_chunks)}")

    # Generate embeddings
    logger.info("Generating embeddings...")
    embeddings = model.encode(all_chunks, show_progress_bar=True)
    logger.info("Embeddings generated")

    # Add to collection
    logger.info("Adding to ChromaDB collection...")
    collection.add(
        ids=all_ids,
        embeddings=embeddings.tolist(),
        documents=all_chunks,
        metadatas=all_metadatas
    )

    final_count = collection.count()
    logger.info("=" * 60)
    logger.info(f"Indexing complete!")
    logger.info(f"Indexed {final_count} chunks from {len(documents)} documents")
    logger.info(f"ChromaDB path: {CHROMA_DB_PATH}")
    logger.info("=" * 60)


def main():
    parser = argparse.ArgumentParser(description="Index product documents into ChromaDB")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="Delete existing index and rebuild from scratch"
    )
    parser.add_argument(
        "--data-dir",
        type=str,
        default=DATA_DIR,
        help=f"Path to data directory (default: {DATA_DIR})"
    )
    args = parser.parse_args()

    try:
        index_documents(rebuild=args.rebuild, data_dir=args.data_dir)
    except Exception as e:
        logger.error(f"Indexing failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
