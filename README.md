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

The backend now writes structured JSON logs to `logs/backend.log` and mirrors them to stdout.
Each HTTP response also includes an `X-Request-ID` header, and chat responses include observability metadata such as intent, tools used, retrieval source, and per-stage latency.

To switch LLM providers, configure `.env` like this:

```bash
LLM_PROVIDER=google
GOOGLE_API_KEY=your_google_api_key
GOOGLE_MODEL=gemini-3-flash-preview
```

Groq remains available with:

```bash
LLM_PROVIDER=groq
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
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

### Pinecone
https://app.pinecone.io/organizations/

## Deployment path

This repo now includes a Docker-first deployment baseline:

- `Dockerfile` for packaging the backend
- `.dockerignore` to keep the image lean
- `.github/workflows/ci.yml` for tests plus Docker build validation
- `.github/workflows/cd.yml` for publishing a container to GHCR and triggering Render
- `render.yaml` as a starter Render blueprint

### Run locally with Docker

```bash
docker build -t ai-observability-agent .
docker run --rm -p 8000:8000 --env-file .env ai-observability-agent
```

Then verify:

```bash
curl http://localhost:8000/api/health
curl http://localhost:8000/api/debug/status
```

### Runtime modes

Optional environment flags:

- `MOCK_MODE=true` disables live LLM usage and keeps responses deterministic for demos.
- `USE_PINECONE=false` forces local document fallback retrieval.
- `ENABLE_MCP=false` disables the MCP server startup path.

### Evaluation dataset

Sample regression-style prompts live in:

- [evaluation/sample_queries.json](/Users/suraj/Documents/Codex/ai-observability-agent/evaluation/sample_queries.json)

They capture expected intent, tool path, and evidence type so you can measure changes over time.

### MCP config

A starter MCP client configuration is included at:

- [mcp.json](/Users/suraj/Documents/Codex/ai-observability-agent/mcp.json)

### CI

CI runs on pull requests and pushes to `main`:

- installs backend dependencies
- runs `pytest`
- builds the Docker image

### CD

CD runs on pushes to `main`:

- builds and pushes `ghcr.io/<owner>/ai-observability-agent`
- tags the image with `latest` and the Git SHA
- triggers Render through `RENDER_DEPLOY_HOOK_URL`

### Render setup

1. Create a Render web service from an existing image.
2. Point it at `ghcr.io/<your-user-or-org>/ai-observability-agent:latest`.
3. Add the environment variables from `.env.example`.
4. Set the health check path to `/api/health`.
5. Add `RENDER_DEPLOY_HOOK_URL` as a GitHub Actions secret.

### GitHub Actions secrets

You only need one repository secret for the current CD flow:

- `RENDER_DEPLOY_HOOK_URL`

The workflow uses the built-in `GITHUB_TOKEN` to push to GHCR.
