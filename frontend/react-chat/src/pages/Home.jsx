export default function Home({ children }) {
  return (
    <main className="page">
      <section className="hero">
        <p className="eyebrow">Agentic AI Learning Project</p>
        <h1>Observability AI Agent</h1>
        <p className="hero-copy">
          A small but professional starter that combines FastAPI, LangGraph, RAG,
          Pinecone, Groq, and MCP tools into one debugging assistant.
        </p>
      </section>
      {children}
    </main>
  );
}
