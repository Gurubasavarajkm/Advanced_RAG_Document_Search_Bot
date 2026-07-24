# Document Search Bot

An advanced Retrieval-Augmented Generation (RAG) application that allows you to securely upload documents and ask questions about them. Built with a modern React frontend and a powerful FastAPI backend, this bot leverages state-of-the-art search pipelines to provide highly accurate, context-aware answers.

## 🚀 Features

- **Advanced RAG Pipeline**:
  - **Semantic Chunking**: Intelligently splits documents based on semantic boundary shifts rather than arbitrary character limits.
  - **Hybrid Search**: Combines Dense Vector Search (ChromaDB + Gemini Embeddings) with Sparse Keyword Search (BM25).
  - **Reciprocal Rank Fusion (RRF)**: Fuses the results from both dense and sparse retrievers for optimal candidate selection.
  - **Cross-Encoder Reranking**: Uses a local MS-MARCO MiniLM cross-encoder (`sentence-transformers`) to semantically rerank the top hybrid candidates for maximum relevance.
- **Secure Access**: Role-based JWT authentication (Admin/User). Admins can manage the knowledge base; users can query it.
- **Modern UI**: A sleek, responsive, and minimalistic React interface built with Vite.
- **Multi-format Support**: Process `.pdf`, `.docx`, `.xlsx`, `.txt`, and `.csv` files.

## 🛠️ Tech Stack

**Frontend:**
- React (Vite)
- React Router DOM
- Axios for API requests
- Lucide React for iconography
- Vanilla CSS with CSS Variables for theme management

**Backend:**
- FastAPI & Uvicorn
- Google Gemini API (`google-genai` SDK) for Embeddings and LLM Generation
- ChromaDB for Vector Storage
- `sentence-transformers` for Cross-Encoder Reranking
- `rank_bm25` for Sparse Search

## ⚙️ Setup Instructions

### 1. Clone the repository
```bash
git clone <your-repo-url>
cd RAG-DocumentSearchBot
```

### 2. Backend Setup
Navigate to the backend directory and set up your Python environment:
```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# Linux/Mac
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

Create a `.env` file in the `backend/` directory:
```env
# Gemini API Key (Generate from Google AI Studio)
GEMINI_API_KEY=your_google_gemini_api_key_here

# JWT Authentication
SECRET_KEY=your_super_secret_jwt_key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

Start the backend server:
```bash
uvicorn main:app --reload
```
*(Note: On the first run, the backend will automatically download the ~80MB Cross-Encoder model weights.)*

### 3. Frontend Setup
Open a new terminal, navigate to the frontend directory, and install dependencies:
```bash
cd frontend
npm install
```

Start the frontend development server:
```bash
npm run dev
```

## 📚 Usage

1. Open your browser and navigate to the frontend URL (typically `http://localhost:5173`).
2. **Log in**: 
   - **Admin** (Username: `admin`, Password: `adminpass`) - Can upload and delete documents in the Knowledge Base.
   - **User** (Username: `user`, Password: `userpass`) - Can only chat with the bot.
3. Head to the **Admin** tab to upload your files.
4. Head to the **Chat** tab to ask the bot questions based on the documents you provided!

## 📝 License
MIT License
