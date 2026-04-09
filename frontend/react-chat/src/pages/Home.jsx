export default function Home({ children, theme, onToggleTheme }) {
  return (
    <main className="page">
      <section className="hero">
        <div className="hero-top">
          <div className="theme-toggle-wrap">
            <button type="button" className="theme-toggle" onClick={onToggleTheme}>
              {theme === "dark" ? "Light Mode" : "Dark Mode"}
            </button>
          </div>
        </div>
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
