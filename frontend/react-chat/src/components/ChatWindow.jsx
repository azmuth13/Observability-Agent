import { useState } from "react";

export default function ChatWindow({ messages, loading, onSend }) {
  const [input, setInput] = useState("");

  function handleSubmit(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value || loading) {
      return;
    }
    onSend(value);
    setInput("");
  }

  return (
    <section className="chat-shell">
      <div className="chat-log">
        {messages.map((message, index) => (
          <article key={`${message.role}-${index}`} className={`message ${message.role}`}>
            <span className="message-role">{message.role}</span>
            <p>{message.content}</p>
          </article>
        ))}
        {loading ? <p className="loading">Thinking through logs, docs, and metrics...</p> : null}
      </div>

      <form className="chat-input-row" onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Why is CPU high in my Java service?"
          rows={3}
        />
        <button type="submit" disabled={loading}>
          Send
        </button>
      </form>
    </section>
  );
}
