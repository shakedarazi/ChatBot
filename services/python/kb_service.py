# python-service/kb_service.py
# Knowledge Base service using ChromaDB and sentence-transformers

import os
import logging
from typing import List, Optional
from pathlib import Path

import chromadb
from chromadb.config import Settings
from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Configuration
CHROMA_DB_PATH = os.environ.get("CHROMA_DB_PATH", "./chroma_db")
EMBEDDING_MODEL = "sentence-transformers/all-MiniLM-L6-v2"
COLLECTION_NAME = "products"


class KBService:
    """Knowledge Base service for RAG retrieval"""

    def __init__(self):
        self._model: Optional[SentenceTransformer] = None
        self._client: Optional[chromadb.Client] = None
        self._collection: Optional[chromadb.Collection] = None
        self._initialized = False

    def initialize(self) -> bool:
        """Initialize the KB service (load model + Chroma collection)"""
        if self._initialized:
            return True

        try:
            logger.info(f"Loading embedding model: {EMBEDDING_MODEL}")
            self._model = SentenceTransformer(EMBEDDING_MODEL)
            logger.info("Embedding model loaded")

            # Initialize ChromaDB with persistent storage
            logger.info(f"Initializing ChromaDB at: {CHROMA_DB_PATH}")
            self._client = chromadb.PersistentClient(path=CHROMA_DB_PATH)

            # Get or create collection
            self._collection = self._client.get_or_create_collection(
                name=COLLECTION_NAME,
                metadata={"hnsw:space": "cosine"}
            )

            doc_count = self._collection.count()
            logger.info(f"KB collection loaded with {doc_count} documents")

            self._initialized = True
            return True

        except Exception as e:
            logger.error(f"Failed to initialize KB service: {e}")
            return False

    def search(self, query: str, top_k: int = 3) -> List[dict]:
        """Search the knowledge base for relevant chunks"""
        if not self._initialized:
            logger.warning("KB service not initialized")
            return []

        if self._collection.count() == 0:
            logger.warning("KB collection is empty")
            return []

        try:
            # Generate query embedding
            query_embedding = self._model.encode(query).tolist()

            # Search ChromaDB
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=min(top_k, self._collection.count()),
                include=["documents", "metadatas", "distances"]
            )

            # Format results
            chunks = []
            if results and results["documents"] and results["documents"][0]:
                for i, doc in enumerate(results["documents"][0]):
                    metadata = results["metadatas"][0][i] if results["metadatas"] else {}
                    distance = results["distances"][0][i] if results["distances"] else 0
                    # Convert distance to similarity score (cosine distance -> similarity)
                    score = 1 - distance

                    chunks.append({
                        "text": doc,
                        "metadata": metadata,
                        "score": score
                    })

            logger.info(f"KB search returned {len(chunks)} chunks for query: {query[:50]}...")
            return chunks

        except Exception as e:
            logger.error(f"KB search error: {e}")
            return []

    def is_ready(self) -> bool:
        """Check if KB service is ready"""
        return self._initialized and self._collection is not None

    def get_doc_count(self) -> int:
        """Get number of documents in the collection"""
        if self._collection:
            return self._collection.count()
        return 0


# Global KB service instance
kb_service = KBService()
