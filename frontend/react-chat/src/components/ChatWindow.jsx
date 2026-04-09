import { useEffect, useMemo, useRef, useState } from "react";

export default function ChatWindow({
  conversations,
  activeConversationId,
  debugMode,
  loading,
  loadingStage,
  elapsedMs,
  backendStatus,
  messages,
  sessionQuery,
  onCancelRequest,
  onClearChat,
  onDeleteConversation,
  onNewChat,
  onRenameConversation,
  onRetryLastRequest,
  onSelectConversation,
  onSend,
  onSessionQueryChange,
  onToggleDebugMode,
  onTogglePin,
}) {
  const [input, setInput] = useState("");
  const [showDebugPanels, setShowDebugPanels] = useState(debugMode);
  const logRef = useRef(null);
  const latestAssistantMessage = [...messages]
    .reverse()
    .find((message) => message.role === "assistant" && message.metadata);
  const isNearBottomRef = useRef(true);

  useEffect(() => {
    setShowDebugPanels(debugMode);
  }, [debugMode]);

  useEffect(() => {
    const node = logRef.current;
    if (!node) {
      return undefined;
    }

    function handleScroll() {
      const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
      isNearBottomRef.current = distanceFromBottom < 80;
    }

    node.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => node.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (logRef.current && isNearBottomRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [messages, loading]);

  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

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
      <aside className="session-panel" aria-label="Conversation history">
        <div className="session-header">
          <div>
            <p className="eyebrow">Conversations</p>
            <h2>Session History</h2>
          </div>
          <button type="button" className="secondary-button" onClick={onNewChat}>
            New Chat
          </button>
        </div>

        <StatusBanner backendStatus={backendStatus} />

        <div className="status-pill-grid">
          <StatusPill label="Active Model" value={buildModelLabel(latestAssistantMessage)} />
          <StatusPill label="Intent" value={latestAssistantMessage?.metadata?.intent || "Waiting"} />
          <StatusPill
            label="Retrieval"
            value={buildRetrievalBadge(latestAssistantMessage?.metadata)}
          />
          <StatusPill label="Sessions" value={String(conversations.length)} />
        </div>

        <label className="session-search">
          <span>Search chats</span>
          <input
            type="text"
            value={sessionQuery}
            onChange={(event) => onSessionQueryChange(event.target.value)}
            placeholder="Find a conversation"
          />
        </label>

        <div className="session-list">
          {conversations.map((conversation) => (
            <div
              key={conversation.id}
              className={`session-item ${conversation.id === activeConversationId ? "active" : ""}`}
            >
              <button
                type="button"
                className="session-main"
                onClick={() => onSelectConversation(conversation.id)}
              >
                <strong>
                  {conversation.title}
                  {conversation.pinned ? <span className="session-pin">Pinned</span> : null}
                </strong>
                <span>{conversation.preview}</span>
                <time title={formatFullTimestamp(conversation.updatedAt)}>
                  {formatRelativeTime(conversation.updatedAt)}
                </time>
              </button>
              <div className="session-actions">
                <button type="button" className="mini-button" onClick={() => onTogglePin(conversation.id)}>
                  {conversation.pinned ? "Unpin" : "Pin"}
                </button>
                <button
                  type="button"
                  className="mini-button"
                  onClick={() => onRenameConversation(conversation.id)}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="mini-button danger"
                  onClick={() => onDeleteConversation(conversation.id)}
                >
                  Delete
                </button>
              </div>
            </div>
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
            <button type="button" className="ghost-button" onClick={onToggleDebugMode}>
              {showDebugPanels ? "Hide Debug" : "Show Debug"}
            </button>
            <button type="button" className="secondary-button" onClick={onNewChat}>
              Start Fresh Context
            </button>
            <button type="button" className="ghost-button" onClick={onClearChat}>
              Clear Chat
            </button>
          </div>
        </div>
        <div className="chat-log" ref={logRef}>
          {groupedMessages.map((group) => (
            <section key={group.id} className={`message-group ${group.role}`}>
              {group.messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="message-header">
                    <span className="message-role">{message.role}</span>
                    {message.createdAt ? (
                      <time title={formatFullTimestamp(message.createdAt)}>
                        {formatRelativeTime(message.createdAt)}
                      </time>
                    ) : null}
                  </div>

                  {message.role === "assistant" ? (
                    <AssistantAnswer content={message.content} />
                  ) : (
                    <p>{message.content}</p>
                  )}

                  {message.role === "assistant" && message.metadata ? (
                    <>
                      {message.metadata.requestId || message.metadata.error ? (
                        <div className="message-actions">
                          {message.metadata.requestId ? (
                            <button
                              type="button"
                              className="mini-button"
                              onClick={() => copyText(message.metadata.requestId)}
                            >
                              Copy Request ID
                            </button>
                          ) : null}
                          {message.metadata.error ? (
                            <>
                              <section className="response-alert warning">
                                <strong>Attention</strong>
                                <span>{mapErrorToHint(message.metadata.error)}</span>
                              </section>
                              <button type="button" className="mini-button" onClick={onRetryLastRequest}>
                                Retry
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : null}

                      {showDebugPanels ? (
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
                                ? `${Math.round(message.metadata.latencyMs)} ms`
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
                            <StageLatencyBars stageLatenciesMs={message.metadata.stageLatenciesMs} />
                          ) : null}
                          {(message.metadata.retrievedContext || message.metadata.toolContext) && (
                            <details className="raw-context-panel">
                              <summary>Raw Context</summary>
                              {message.metadata.toolContext ? (
                                <pre>{message.metadata.toolContext}</pre>
                              ) : null}
                              {message.metadata.retrievedContext ? (
                                <pre>{message.metadata.retrievedContext}</pre>
                              ) : null}
                            </details>
                          )}
                        </section>
                      ) : null}

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
            </section>
          ))}

          {loading ? (
            <section className="loading-panel" aria-live="polite">
              <div className="loading-skeleton" />
              <div className="loading-copy">
                <strong>{loadingStage}</strong>
                <span>{Math.max(1, Math.round(elapsedMs / 1000))}s elapsed</span>
              </div>
              <div className="loading-steps">
                {buildLoadingSteps(loadingStage).map((step, index) => (
                  <span key={step} className={`loading-step ${index === 0 ? "active" : ""}`}>
                    {step}
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className="request-actions">
          {loading ? (
            <button type="button" className="ghost-button" onClick={onCancelRequest}>
              Cancel Request
            </button>
          ) : (
            <button type="button" className="ghost-button" onClick={onRetryLastRequest}>
              Retry Last Question
            </button>
          )}
        </div>

        <form className={`chat-input-row ${loading ? "busy" : ""}`} onSubmit={handleSubmit}>
          <textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Why is CPU high in my Java service?"
            rows={3}
            disabled={loading}
            aria-label="Ask the observability agent"
          />
          <button type="submit" disabled={loading || !input.trim()}>
            {loading ? "Working..." : "Send"}
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

function StatusBanner({ backendStatus }) {
  return (
    <section className={`status-banner ${backendStatus.state}`}>
      <strong>{backendStatus.message}</strong>
      <span>
        {backendStatus.state === "online"
          ? "Agent calls can be sent right now."
          : "Check FastAPI or your network connection before sending a request."}
      </span>
    </section>
  );
}

function StageLatencyBars({ stageLatenciesMs }) {
  const stages = Object.entries(stageLatenciesMs);
  const maxValue = Math.max(...stages.map(([, value]) => value), 1);

  return (
    <div className="stage-latency-bars">
      {stages.map(([stage, value]) => (
        <div key={stage} className="stage-bar-row">
          <span>{stage}</span>
          <div className="stage-bar-track">
            <div className="stage-bar-fill" style={{ width: `${(value / maxValue) * 100}%` }} />
          </div>
          <strong>{Math.round(value)} ms</strong>
        </div>
      ))}
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

function groupMessages(messages) {
  return messages.reduce((groups, message) => {
    const lastGroup = groups[groups.length - 1];
    if (lastGroup && lastGroup.role === message.role) {
      lastGroup.messages.push(message);
      return groups;
    }
    groups.push({
      id: `${message.role}-${message.id}`,
      role: message.role,
      messages: [message],
    });
    return groups;
  }, []);
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
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() || "")
    .join("");
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

function formatRelativeTime(timestamp) {
  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.floor(diffMs / 60000);
  if (diffMinutes < 1) {
    return "just now";
  }
  if (diffMinutes < 60) {
    return `${diffMinutes}m ago`;
  }
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) {
    return `${diffHours}h ago`;
  }
  return `${Math.floor(diffHours / 24)}d ago`;
}

function formatFullTimestamp(timestamp) {
  return new Date(timestamp).toLocaleString();
}

function buildModelLabel(message) {
  if (!message?.metadata?.llmModel) {
    return "Not run";
  }

  const provider = message.metadata.llmProvider || "unknown";
  return `${provider} · ${message.metadata.llmModel}`;
}

function buildRetrievalBadge(metadata) {
  if (!metadata?.retrievalSource) {
    return "Pending";
  }
  if (metadata.retrievalSource === "pinecone") {
    return "Pinecone";
  }
  if (metadata.retrievalSource === "local") {
    return "Sample docs";
  }
  if (metadata.retrievalSource === "mock") {
    return "Mock mode";
  }
  return metadata.retrievalSource;
}

function mapErrorToHint(error) {
  if (error === "backend_unreachable") {
    return "The frontend could not reach FastAPI. Start the backend or verify the API URL.";
  }
  if (error === "request_cancelled") {
    return "The request was intentionally stopped before the answer was completed.";
  }
  if (error?.includes("connection")) {
    return "The model provider was unreachable. Check internet access or provider availability.";
  }
  if (error?.includes("auth")) {
    return "The provider rejected credentials. Verify your configured API key.";
  }
  return "Something interrupted the agent workflow. Retry or inspect backend logs for the request ID.";
}

function buildLoadingSteps(currentStage) {
  return ["Queued", currentStage, "Preparing final answer"];
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    window.alert("Unable to copy to clipboard in this browser.");
  }
}

function StatusPill({ label, value }) {
  return (
    <div className="status-pill">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
