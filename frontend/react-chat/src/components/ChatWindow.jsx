import { useEffect, useRef, useState } from "react";

export default function ChatWindow({
  conversations,
  activeConversationId,
  messages,
  loading,
  onClearChat,
  onNewChat,
  onSelectConversation,
  onSend,
}) {
  const [input, setInput] = useState("");
  const logRef = useRef(null);
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.metadata);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, loading]);

  function handleSubmit(event) {
    event.preventDefault();
    const value = input.trim();
    if (!value || loading) {
      return;
    }
    onSend(value);
    setInput("");
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit(event);
    }
  }

  return (
    <section className="chat-layout">
      <aside className="session-panel">
        <div className="session-header">
          <div>
            <p className="eyebrow">Conversations</p>
            <h2>Session History</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onNewChat}>
            New Chat
          </button>
        </div>
        <div className="status-pill-grid">
          <StatusPill label="Active Model" value={buildModelLabel(latestAssistantMessage)} />
          <StatusPill label="Intent" value={latestAssistantMessage?.metadata?.intent || "Waiting"} />
          <StatusPill
            label="Retrieval"
            value={latestAssistantMessage?.metadata?.retrievalSource || "Pending"}
          />
          <StatusPill label="Sessions" value={String(conversations.length)} />
        </div>
        <div className="session-list">
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              className={`session-item ${
                conversation.id === activeConversationId ? "active" : ""
              }`}
              onClick={() => onSelectConversation(conversation.id)}
            >
              <strong>{conversation.title}</strong>
              <span>{conversation.preview}</span>
              <time>{formatTimestamp(conversation.updatedAt)}</time>
            </button>
          ))}
        </div>
      </aside>

      <section className="chat-shell">
        <div className="chat-toolbar">
          <div>
            <p className="eyebrow">Current Context</p>
            <h2>Active Chat</h2>
          </div>
          <div className="chat-toolbar-actions">
            <button type="button" className="secondary-button" onClick={onNewChat}>
              Start Fresh Context
            </button>
            <button type="button" className="ghost-button" onClick={onClearChat}>
              Clear Chat
            </button>
          </div>
        </div>

        <div className="chat-log" ref={logRef}>
          {messages.map((message) => (
            <article key={message.id} className={`message ${message.role}`}>
              <div className="message-header">
                <span className="message-role">{message.role}</span>
                {message.createdAt ? <time>{formatTimestamp(message.createdAt)}</time> : null}
              </div>
              {message.role === "assistant" ? (
                <AssistantAnswer content={message.content} />
              ) : (
                <p>{message.content}</p>
              )}
              {message.role === "assistant" && message.metadata ? (
                <>
                  <section className="message-metadata">
                    <MetadataBadge label="Intent" value={message.metadata.intent || "unknown"} />
                    <MetadataBadge
                      label="Docs Retrieved"
                      value={message.metadata.retrievalHit ? "yes" : "no"}
                    />
                    <MetadataBadge
                      label="Tool Used"
                      value={message.metadata.toolsUsed?.join(", ") || "none"}
                    />
                    <MetadataBadge
                      label="Evidence Found"
                      value={message.metadata.evidenceFound ? "yes" : "no"}
                    />
                    <MetadataBadge
                      label="LLM"
                      value={
                        message.metadata.llmProvider && message.metadata.llmModel
                          ? `${message.metadata.llmProvider} / ${message.metadata.llmModel}`
                          : "unknown"
                      }
                    />
                    <MetadataBadge
                      label="Retrieval Source"
                      value={message.metadata.retrievalSource || "unknown"}
                    />
                    <MetadataBadge
                      label="Latency"
                      value={
                        typeof message.metadata.latencyMs === "number"
                          ? `${message.metadata.latencyMs} ms`
                          : "n/a"
                      }
                    />
                    {message.metadata.requestId ? (
                      <MetadataBadge label="Request ID" value={message.metadata.requestId} />
                    ) : null}
                    {message.metadata.error ? (
                      <MetadataBadge label="Status" value={message.metadata.error} tone="warning" />
                    ) : null}
                    {Object.keys(message.metadata.stageLatenciesMs || {}).length ? (
                      <div className="stage-latencies">
                        {Object.entries(message.metadata.stageLatenciesMs).map(([stage, value]) => (
                          <span key={stage} className="stage-chip">
                            {stage}: {value} ms
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </section>

                  <section className="follow-up-panel">
                    <p className="follow-up-title">Ask a follow-up</p>
                    <div className="follow-up-list">
                      {buildFollowUps(message.metadata).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          className="follow-up-chip"
                          onClick={() => onSend(suggestion)}
                          disabled={loading}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  </section>
                </>
              ) : null}
            </article>
          ))}
          {loading ? <p className="loading">Thinking through logs, docs, and metrics...</p> : null}
        </div>

        <form className="chat-input-row" onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Why is CPU high in my Java service?"
            rows={3}
          />
          <button type="submit" disabled={loading}>
            Send
          </button>
        </form>
      </section>
    </section>
  );
}

function MetadataBadge({ label, value, tone = "default" }) {
  return (
    <div className={`metadata-badge ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function AssistantAnswer({ content }) {
  const sections = parseAssistantContent(content);

  return (
    <div className="assistant-answer">
      {sections.map((section, index) => {
        if (section.type === "paragraph") {
          return (
            <p key={index} className="answer-lead">
              {renderInline(section.text)}
            </p>
          );
        }

        return (
          <section key={index} className="answer-section">
            <div className="answer-section-header">
              <span className={`section-icon ${section.kind}`}>{section.shortLabel}</span>
              <h3>{section.title}</h3>
            </div>
            {section.paragraphs.map((paragraph, paragraphIndex) => (
              <p key={`${index}-p-${paragraphIndex}`} className="answer-body">
                {renderInline(paragraph)}
              </p>
            ))}
            {section.items.length ? (
              <ul className="answer-list">
                {section.items.map((item, itemIndex) => (
                  <li key={`${index}-i-${itemIndex}`}>
                    <span className="answer-list-label">{renderInline(item.label)}</span>
                    {item.detail ? (
                      <span className="answer-list-detail">{renderInline(item.detail)}</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function parseAssistantContent(content) {
  const normalized = content.replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");
  const sections = [];
  let currentSection = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      continue;
    }

    const headingMatch = line.match(/^\*{0,2}(\d+)\.\s+(.+?)\*{0,2}$/);
    if (headingMatch) {
      if (currentSection) {
        sections.push(currentSection);
      }
      currentSection = {
        type: "section",
        title: cleanText(headingMatch[2]),
        shortLabel: buildSectionShortLabel(cleanText(headingMatch[2])),
        kind: classifySectionKind(cleanText(headingMatch[2])),
        paragraphs: [],
        items: [],
      };
      continue;
    }

    const bulletMatch = line.match(/^\*\s+(.+)$/);
    if (bulletMatch && currentSection) {
      const itemText = cleanText(bulletMatch[1]);
      const colonIndex = itemText.indexOf(":");
      if (colonIndex > -1) {
        currentSection.items.push({
          label: itemText.slice(0, colonIndex + 1),
          detail: itemText.slice(colonIndex + 1).trim(),
        });
      } else {
        currentSection.items.push({ label: itemText, detail: "" });
      }
      continue;
    }

    const cleaned = cleanText(line);
    if (currentSection) {
      currentSection.paragraphs.push(cleaned);
    } else {
      sections.push({ type: "paragraph", text: cleaned });
    }
  }

  if (currentSection) {
    sections.push(currentSection);
  }

  return sections;
}

function cleanText(text) {
  return text.replace(/\*\*(.*?)\*\*/g, "$1").trim();
}

function classifySectionKind(title) {
  const normalized = title.toLowerCase();
  if (normalized.includes("diagnosis")) {
    return "diagnosis";
  }
  if (normalized.includes("evidence") || normalized.includes("timestamp")) {
    return "evidence";
  }
  if (normalized.includes("action")) {
    return "action";
  }
  return "general";
}

function buildSectionShortLabel(title) {
  const words = title.split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0]?.toUpperCase() || "").join("");
}

function renderInline(text) {
  const parts = text.split(/(`[^`]+`)/g);
  return parts.map((part, index) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return <code key={index}>{part.slice(1, -1)}</code>;
    }
    return <span key={index}>{part}</span>;
  });
}

function buildFollowUps(metadata) {
  if (metadata?.intent === "logs") {
    return [
      "Show me the likely root cause in one sentence.",
      "What should I check in Kubernetes next?",
      "Do you see any trace ID or correlation clue here?",
    ];
  }

  if (metadata?.intent === "metrics") {
    return [
      "What is the most likely reason CPU is high?",
      "What metric should I inspect next?",
      "Summarize the evidence in three bullets.",
    ];
  }

  return [
    "Summarize the key recommendation.",
    "What should I investigate next?",
    "Give me a shorter answer for this issue.",
  ];
}

function formatTimestamp(timestamp) {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildModelLabel(message) {
  if (!message?.metadata?.llmModel) {
    return "Not run";
  }

  const provider = message.metadata.llmProvider || "unknown";
  return `${provider} · ${message.metadata.llmModel}`;
}

function StatusPill({ label, value }) {
  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
