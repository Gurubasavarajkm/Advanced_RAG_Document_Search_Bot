import os
import re
import numpy as np
from google import genai
from google.genai import types
import chromadb
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder
from langchain_text_splitters import RecursiveCharacterTextSplitter
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
genai_client = genai.Client(api_key=api_key) if api_key else genai.Client()

# Initialize Cross-Encoder model globally
cross_encoder = CrossEncoder('cross-encoder/ms-marco-MiniLM-L-6-v2', max_length=512)

# Setup ChromaDB client
client = chromadb.PersistentClient(path="./chroma_db")
collection = client.get_or_create_collection("docu_mind_collection")

# Semantic Chunking
def split_into_sentences(text: str) -> list[str]:
    """Split raw text into clean individual sentences."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    return [s.strip() for s in sentences if s.strip()]

def cosine_similarity(u, v) -> float:
    """Calculate cosine similarity between two 1D vectors."""
    u = np.array(u, dtype=np.float32)
    v = np.array(v, dtype=np.float32)
    norm_u = np.linalg.norm(u)
    norm_v = np.linalg.norm(v)
    if norm_u == 0 or norm_v == 0:
        return 0.0
    return float(np.dot(u, v) / (norm_u * norm_v))

def semantic_chunk_text(text: str, max_chunk_chars: int = 1200, min_chunk_chars: int = 150) -> list[str]:
    """
    Splits text into chunks dynamically based on semantic similarity between
    consecutive sentence embeddings.
    """
    sentences = split_into_sentences(text)
    
    # Fallback to recursive character splitter if text is too short to chunk semantically
    if len(sentences) <= 2:
        splitter = RecursiveCharacterTextSplitter(chunk_size=max_chunk_chars, chunk_overlap=150)
        return splitter.split_text(text)

    try:
        # Generate embeddings for each sentence to detect semantic boundary shifts
        embeddings = []
        batch_size = 100
        for i in range(0, len(sentences), batch_size):
            batch = sentences[i:i + batch_size]
            response = genai_client.models.embed_content(
                model="gemini-embedding-2",
                contents=batch,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            embeddings.extend([e.values for e in response.embeddings])
    except Exception as e:
        print(f"Embedding failed during semantic chunking: {e}. Falling back to RecursiveCharacterTextSplitter.")
        splitter = RecursiveCharacterTextSplitter(chunk_size=max_chunk_chars, chunk_overlap=150)
        return splitter.split_text(text)

    # Compute semantic distance (1 - cosine_similarity) between consecutive sentence embeddings
    distances = []
    for i in range(len(embeddings) - 1):
        sim = cosine_similarity(embeddings[i], embeddings[i + 1])
        distances.append(1.0 - sim)

    if not distances:
        return sentences

    # Calculate threshold (70th percentile distance to identify semantic topic shifts)
    threshold = float(np.percentile(distances, 70))

    chunks = []
    current_chunk = [sentences[0]]
    current_len = len(sentences[0])

    for i in range(len(distances)):
        dist = distances[i]
        next_sentence = sentences[i + 1]

        # Break chunk boundary if semantic distance > threshold and min_chunk_chars met,
        # OR if appending next_sentence exceeds max_chunk_chars limit
        if (dist > threshold and current_len >= min_chunk_chars) or (current_len + len(next_sentence) > max_chunk_chars):
            chunks.append(" ".join(current_chunk))
            current_chunk = [next_sentence]
            current_len = len(next_sentence)
        else:
            current_chunk.append(next_sentence)
            current_len += len(next_sentence) + 1

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks


# BM25 & Hybrid Search (Reciprocal Rank Fusion)
def tokenize_text(text: str) -> list[str]:
    """Tokenize text into lowercase alphanumeric tokens for BM25 search."""
    return re.findall(r'\w+', text.lower())

def get_bm25_corpus_and_docs():
    """Retrieve all document text chunks stored in ChromaDB for BM25 indexing."""
    all_data = collection.get(include=["documents", "metadatas"])
    docs = all_data.get("documents", [])
    ids = all_data.get("ids", [])
    metadatas = all_data.get("metadatas", [])
    return ids, docs, metadatas

def hybrid_search_rrf(query: str, top_k: int = 10, rrf_k: int = 60) -> list[str]:
    """
    Performs Hybrid Search using Dense Vector Search (ChromaDB + Gemini Embeddings)
    and Sparse Search (BM25Okapi), fused using Reciprocal Rank Fusion (RRF).
    """
    ids, docs, metadatas = get_bm25_corpus_and_docs()
    if not docs:
        return []

    # --- Dense Retrieval ---
    dense_results_docs = []
    try:
        response = genai_client.models.embed_content(
            model="gemini-embedding-2",
            contents=query,
            config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
        )
        query_embedding = response.embeddings[0].values
        
        dense_res = collection.query(
            query_embeddings=[query_embedding],
            n_results=min(20, len(docs))
        )
        if dense_res and dense_res.get('documents') and dense_res['documents'][0]:
            dense_results_docs = dense_res['documents'][0]
    except Exception as e:
        print(f"Dense vector query failed: {e}")

    # --- Sparse Retrieval (BM25 Keyword Search) ---
    sparse_results_docs = []
    try:
        tokenized_corpus = [tokenize_text(doc) for doc in docs]
        tokenized_query = tokenize_text(query)
        
        bm25 = BM25Okapi(tokenized_corpus)
        bm25_scores = bm25.get_scores(tokenized_query)
        
        top_bm25_indices = np.argsort(bm25_scores)[::-1][:min(20, len(docs))]
        sparse_results_docs = [docs[idx] for idx in top_bm25_indices if bm25_scores[idx] > 0]
    except Exception as e:
        print(f"BM25 sparse query failed: {e}")

    # --- Reciprocal Rank Fusion (RRF) ---
    rrf_scores = {}  # text chunk -> score

    for rank, doc in enumerate(dense_results_docs):
        rrf_scores[doc] = rrf_scores.get(doc, 0.0) + (1.0 / (rrf_k + rank + 1))

    for rank, doc in enumerate(sparse_results_docs):
        rrf_scores[doc] = rrf_scores.get(doc, 0.0) + (1.0 / (rrf_k + rank + 1))

    # Sort chunks by RRF score descending
    sorted_candidates = sorted(rrf_scores.keys(), key=lambda d: rrf_scores[d], reverse=True)
    return sorted_candidates[:top_k]

# Reranker (LLM-based Cross-Encoder Scoring)
def rerank_chunks(query: str, candidate_chunks: list[str], top_n: int = 5) -> list[str]:
    """
    Reranks top candidate chunks using Gemini LLM to select the most relevant chunks.
    """
    if not candidate_chunks:
        return []
    if len(candidate_chunks) <= top_n:
        return candidate_chunks

    try:
        # Create pairs of (query, chunk)
        pairs = [[query, chunk] for chunk in candidate_chunks]        
       
        # Get scores from the cross-encoder
        scores = cross_encoder.predict(pairs)
        
        # Sort chunks based on descending scores
        scored_chunks = sorted(zip(candidate_chunks, scores), key=lambda x: x[1], reverse=True)
        reranked = [chunk for chunk, score in scored_chunks]
        return reranked[:top_n]
    except Exception as e:
        print(f"Reranking failed: {e}. Falling back to top hybrid search candidates.")
        return candidate_chunks[:top_n]

# Add documents to vector db
def add_document_to_db(text: str, doc_id: str):
    """ Adds a new document to the vector database. """
    if not text.strip():
        print(f"Skipping empty document: {doc_id}")
        return

    # Semantic Chunking
    chunks = semantic_chunk_text(text)
    
    # Generate embeddings for each semantic chunk
    try:
        embeddings = []
        batch_size = 100
        for i in range(0, len(chunks), batch_size):
            batch = chunks[i:i + batch_size]
            response = genai_client.models.embed_content(
                model="gemini-embedding-2",
                contents=batch,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            embeddings.extend([e.values for e in response.embeddings])
    except Exception as e:
        print(f"Error embedding document {doc_id}: {e}")
        raise Exception(f"Failed to generate embeddings: {str(e)}")

    # Store chunks in ChromaDB
    collection.add(
        embeddings=embeddings,
        documents=chunks,
        metadatas=[{"source": doc_id} for _ in chunks],
        ids=[f"{doc_id}_{i}" for i in range(len(chunks))]
    )
    print(f"Successfully added {len(chunks)} semantic chunks for document {doc_id}")

def query_relevant_chunks(query: str) -> list[str]:
    """ Queries the vector database for relevant text chunks using Hybrid Search. """
    # Advanced RAG Step 2: Hybrid Search (Dense + BM25 with Reciprocal Rank Fusion)
    hybrid_candidates = hybrid_search_rrf(query, top_k=12)
    if not hybrid_candidates:
        return []

    # Advanced RAG Step 3: Rerank top candidates down to top 5
    reranked_chunks = rerank_chunks(query, hybrid_candidates, top_n=5)
    return reranked_chunks

def generate_answer_from_context(context: list[str], query: str) -> str:
    """ Generates an answer to a query based on the provided context. """
    if not context:
        return "I'm sorry, I couldn't find any relevant information in the uploaded documents to answer your question."

    context_str = "\n---\n".join(context)
    
    prompt = f"""
    You are a helpful AI assistant for the 'Document Search Bot' application. Your task is to answer user questions based *only* on the context provided from a set of documents.
    Do not use any external knowledge. If the answer is not found in the context, say "I'm sorry, I couldn't find information about that in the documents."

    CONTEXT:
    {context_str}

    QUESTION:
    {query}

    ANSWER:
    """

    response = genai_client.models.generate_content(
        model="gemini-1.5-flash",
        contents=prompt
    )
    return response.text

def delete_document_from_db(doc_id: str):
    """ Deletes a document from the vector database. """
    collection.delete(where={"source": doc_id})
    print(f"Deleted document {doc_id} from vector store.")

def get_all_documents():
    """ Retrieves all documents from the vector database. """
    all_items = collection.get(include=["metadatas"])
    if not all_items or not all_items.get('metadatas'):
        return []
    sources = set(item['source'] for item in all_items['metadatas'])
    return list(sources)