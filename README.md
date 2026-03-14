# AI Observability Agent

Small agentic AI project scaffold for learning:

- FastAPI
- LangChain
- LangGraph
- LangSmith tracing
- Pinecone
- HuggingFace embeddings
- MCP tools/server
- React frontend

## Project layout

- `backend/`: FastAPI app, agent graph, RAG, tools, and MCP server
- `frontend/react-chat/`: React chat UI placeholder
- `data/`: local sample docs and logs for early development
- `scripts/`: helper scripts such as ingestion and local setup

## Suggested build order

1. Implement RAG ingestion and retrieval
2. Add FastAPI chat endpoint
3. Build LangGraph flow
4. Add tools and MCP server
5. Add React UI

## Quick start

### Backend

1. Create a virtual environment
```bash
    python3.11 -m venv .venv
    source .venv/bin/activate
```
2. Install dependencies from `backend/requirements.txt`
```bash
    pip install --upgrade pip
    pip install -r backend/requirements.txt
```
3. Copy `.env.example` to `.env`
4. Start the API:

```bash
uvicorn backend.main:app --reload --app-dir .
```

5. Ingest documents:

```bash
python -m backend.rag.ingest
```

### Frontend

```bash
cd frontend/react-chat
npm install
npm run dev
```
