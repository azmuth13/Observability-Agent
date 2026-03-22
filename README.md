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
```

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
