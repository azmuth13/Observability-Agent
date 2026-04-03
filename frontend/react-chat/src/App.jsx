import { useEffect, useMemo, useState } from "react";
import ChatWindow from "./components/ChatWindow";
import Home from "./pages/Home";

const API_BASE_URL = "http://localhost:8000/api";
const STORAGE_KEY = "observability-agent-conversations";

function createStarterMessage() {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      "Ask about logs, metrics, JVM issues, or incident debugging and I will walk through it.",
    createdAt: new Date().toISOString(),
  };
}

function createConversation(title = "New Chat") {
  return {
    id: crypto.randomUUID(),
    title,
    updatedAt: new Date().toISOString(),
    messages: [createStarterMessage()],
  };
}

function loadInitialState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const conversation = createConversation();
      return {
        conversations: [conversation],
        activeConversationId: conversation.id,
      };
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.conversations) || !parsed.activeConversationId) {
      throw new Error("Invalid conversation state");
    }

    return parsed;
  } catch {
    const conversation = createConversation();
    return {
      conversations: [conversation],
      activeConversationId: conversation.id,
    };
  }
}

export default function App() {
  const [state, setState] = useState(loadInitialState);
  const [loading, setLoading] = useState(false);

  const conversations = state.conversations;
  const activeConversation =
    conversations.find((conversation) => conversation.id === state.activeConversationId) ??
    conversations[0];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  const activeMessages = activeConversation?.messages ?? [];

  const sessionSummaries = useMemo(
    () =>
      conversations.map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        preview: conversation.messages.at(-1)?.content ?? "",
      })),
    [conversations]
  );

  function updateConversation(conversationId, updater) {
    setState((current) => ({
      ...current,
      conversations: current.conversations.map((conversation) =>
        conversation.id === conversationId ? updater(conversation) : conversation
      ),
    }));
  }

  function setActiveConversationId(conversationId) {
    setState((current) => ({
      ...current,
      activeConversationId: conversationId,
    }));
  }

  function handleNewChat() {
    const conversation = createConversation();
    setState((current) => ({
      conversations: [conversation, ...current.conversations],
      activeConversationId: conversation.id,
    }));
  }

  function handleClearChat() {
    if (!activeConversation) {
      return;
    }

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      title: "New Chat",
      updatedAt: new Date().toISOString(),
      messages: [createStarterMessage()],
    }));
  }

  async function handleSendMessage(input) {
    if (!activeConversation) {
      return;
    }

    const timestamp = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: timestamp,
    };

    const nextMessages = [...activeConversation.messages, userMessage];
    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      title: conversation.title === "New Chat" ? buildConversationTitle(input) : conversation.title,
      updatedAt: timestamp,
      messages: nextMessages,
    }));
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
      });
      const data = await response.json();
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.answer || "No answer returned.",
        createdAt: new Date().toISOString(),
        metadata: {
          requestId: data.request_id,
          intent: data.intent,
          toolsUsed: data.tools_used || [],
          retrievalSource: data.retrieval_source,
          retrievalHit: data.retrieval_hit,
          evidenceFound: data.evidence_found,
          llmEnabled: data.llm_enabled,
          llmProvider: data.llm_provider,
          llmModel: data.llm_model,
          latencyMs: data.latency_ms,
          stageLatenciesMs: data.stage_latencies_ms || {},
          error: data.error,
        },
      };

      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: assistantMessage.createdAt,
        messages: [...conversation.messages, assistantMessage],
      }));
    } catch {
      const assistantMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "The backend is not reachable yet. Start FastAPI and try again.",
        createdAt: new Date().toISOString(),
        metadata: {
          error: "backend_unreachable",
        },
      };

      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: assistantMessage.createdAt,
        messages: [...conversation.messages, assistantMessage],
      }));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Home>
      <ChatWindow
        conversations={sessionSummaries}
        activeConversationId={activeConversation?.id}
        messages={activeMessages}
        loading={loading}
        onClearChat={handleClearChat}
        onNewChat={handleNewChat}
        onSelectConversation={setActiveConversationId}
        onSend={handleSendMessage}
      />
    </Home>
  );
}

function buildConversationTitle(input) {
  const title = input.trim().replace(/\s+/g, " ");
  if (!title) {
    return "New Chat";
  }
  return title.length > 40 ? `${title.slice(0, 40)}...` : title;
}
