export default function Home({ children }) {
  return (
    <main className="page">
      <section className="hero">
        <h2>Observability Agent</h2>
        <p className="hero-copy">
          Investigate incidents with a cleaner AI workspace built for logs, metrics,
          docs, and evidence-first debugging.
        </p>
        <div className="hero-chips">
          <span>Evidence-first answers</span>
          <span>Multi-session chat</span>
          <span>LLM and tool transparency</span>
        </div>
      </section>
      {children}
    </main>
  );
}
