import { useEffect, useMemo, useRef, useState } from "react";
import ChatWindow from "./components/ChatWindow";
import Home from "./pages/Home";

const API_BASE_URL = "http://localhost:8000/api";
const STORAGE_KEY = "observability-agent-state";
const LOADING_STAGES = [
  "Classifying your question",
  "Checking docs and retrieval context",
  "Scanning runtime evidence",
  "Generating a final answer",
];

function createStarterMessage() {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content:
      "Ask about logs, metrics, JVM issues, or incident debugging and I will walk through it.",
    createdAt: new Date().toISOString(),
    metadata: {
      isStarter: true,
    },
  };
}

function createConversation(title = "New Chat") {
  return {
    id: crypto.randomUUID(),
    title,
    updatedAt: new Date().toISOString(),
    messages: [createStarterMessage()],
    pinned: false,
  };
}

function createDefaultState() {
  const conversation = createConversation();
  return {
    conversations: [conversation],
    activeConversationId: conversation.id,
    debugMode: false,
    theme: "light",
  };
}

function loadInitialState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createDefaultState();
    }

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed.conversations) || !parsed.activeConversationId) {
      throw new Error("Invalid conversation state");
    }

    return {
      debugMode: Boolean(parsed.debugMode),
      theme: parsed.theme === "dark" ? "dark" : "light",
      conversations: parsed.conversations.map((conversation) => ({
        pinned: false,
        ...conversation,
      })),
      activeConversationId: parsed.activeConversationId,
    };
  } catch {
    return createDefaultState();
  }
}

export default function App() {
  const [state, setState] = useState(loadInitialState);
  const [loading, setLoading] = useState(false);
  const [loadingStageIndex, setLoadingStageIndex] = useState(0);
  const [requestStartedAt, setRequestStartedAt] = useState(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [sessionQuery, setSessionQuery] = useState("");
  const [backendStatus, setBackendStatus] = useState({
    state: "checking",
    message: "Checking backend connection...",
  });
  const abortControllerRef = useRef(null);
  const lastSubmittedQueryRef = useRef("");

  const conversations = state.conversations;
  const theme = state.theme || "light";
  const activeConversation =
    conversations.find((conversation) => conversation.id === state.activeConversationId) ??
    conversations[0];
  const activeMessages = activeConversation?.messages ?? [];

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) {
          throw new Error("Backend unhealthy");
        }
        if (!cancelled) {
          setBackendStatus({
            state: "online",
            message: "Backend connected",
          });
        }
      } catch {
        if (!cancelled) {
          setBackendStatus({
            state: "offline",
            message: "Backend offline or unreachable",
          });
        }
      }
    }

    checkBackend();
    const intervalId = window.setInterval(checkBackend, 20000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setElapsedMs(0);
      setLoadingStageIndex(0);
      return undefined;
    }

    const stageTimer = window.setInterval(() => {
      setLoadingStageIndex((index) => Math.min(index + 1, LOADING_STAGES.length - 1));
    }, 1800);
    const elapsedTimer = window.setInterval(() => {
      if (requestStartedAt) {
        setElapsedMs(Date.now() - requestStartedAt);
      }
    }, 200);

    return () => {
      window.clearInterval(stageTimer);
      window.clearInterval(elapsedTimer);
    };
  }, [loading, requestStartedAt]);

  const sessionSummaries = useMemo(() => {
    const filtered = conversations.filter((conversation) => {
      if (!sessionQuery.trim()) {
        return true;
      }
      const query = sessionQuery.toLowerCase();
      return (
        conversation.title.toLowerCase().includes(query) ||
        conversation.messages.some((message) => message.content.toLowerCase().includes(query))
      );
    });

    return filtered
      .slice()
      .sort((left, right) => {
        if (left.pinned !== right.pinned) {
          return left.pinned ? -1 : 1;
        }
        return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
      })
      .map((conversation) => ({
        id: conversation.id,
        title: conversation.title,
        updatedAt: conversation.updatedAt,
        preview: conversation.messages.at(-1)?.content ?? "",
        pinned: conversation.pinned,
      }));
  }, [conversations, sessionQuery]);

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
      conversations: current.conversations.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, hasUnread: false }
          : conversation
      ),
    }));
  }

  function handleNewChat() {
    const conversation = createConversation();
    setState((current) => ({
      ...current,
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

  function handleDeleteConversation(conversationId) {
    setState((current) => {
      const remaining = current.conversations.filter((conversation) => conversation.id !== conversationId);
      if (remaining.length === 0) {
        const conversation = createConversation();
        return {
          ...current,
          conversations: [conversation],
          activeConversationId: conversation.id,
        };
      }
      const nextActiveId =
        current.activeConversationId === conversationId ? remaining[0].id : current.activeConversationId;
      return {
        ...current,
        conversations: remaining,
        activeConversationId: nextActiveId,
      };
    });
  }

  function handleRenameConversation(conversationId) {
    const conversation = conversations.find((item) => item.id === conversationId);
    const nextTitle = window.prompt("Rename conversation", conversation?.title ?? "New Chat");
    if (!nextTitle?.trim()) {
      return;
    }
    updateConversation(conversationId, (currentConversation) => ({
      ...currentConversation,
      title: nextTitle.trim(),
    }));
  }

  function handleTogglePin(conversationId) {
    updateConversation(conversationId, (conversation) => ({
      ...conversation,
      pinned: !conversation.pinned,
    }));
  }

  function handleToggleDebugMode() {
    setState((current) => ({
      ...current,
      debugMode: !current.debugMode,
    }));
  }

  function handleToggleTheme() {
    setState((current) => ({
      ...current,
      theme: current.theme === "dark" ? "light" : "dark",
    }));
  }

  async function handleSendMessage(input) {
    if (!activeConversation || loading) {
      return;
    }

    lastSubmittedQueryRef.current = input;
    const timestamp = new Date().toISOString();
    const userMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
      createdAt: timestamp,
    };

    updateConversation(activeConversation.id, (conversation) => ({
      ...conversation,
      title: conversation.title === "New Chat" ? buildConversationTitle(input) : conversation.title,
      updatedAt: timestamp,
      messages: [...conversation.messages, userMessage],
    }));

    const controller = new AbortController();
    abortControllerRef.current = controller;
    setLoading(true);
    setRequestStartedAt(Date.now());
    setLoadingStageIndex(0);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
        signal: controller.signal,
      });
      const data = await response.json();
      const assistantMessage = createAssistantMessage(data);

      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: assistantMessage.createdAt,
        messages: [...conversation.messages, assistantMessage],
      }));
    } catch (error) {
      const assistantMessage =
        error?.name === "AbortError"
          ? createLocalAssistantMessage(
              "The in-flight request was cancelled. You can retry the same question or start a fresh chat."
            )
          : createLocalAssistantMessage(
              "The backend is not reachable yet. Start FastAPI and try again.",
              "backend_unreachable"
            );

      updateConversation(activeConversation.id, (conversation) => ({
        ...conversation,
        updatedAt: assistantMessage.createdAt,
        messages: [...conversation.messages, assistantMessage],
      }));
    } finally {
      abortControllerRef.current = null;
      setLoading(false);
      setRequestStartedAt(null);
      setElapsedMs(0);
    }
  }

  function handleCancelRequest() {
    abortControllerRef.current?.abort();
  }

  function handleRetryLastRequest() {
    if (lastSubmittedQueryRef.current && !loading) {
      handleSendMessage(lastSubmittedQueryRef.current);
    }
  }

  return (
    <Home theme={theme} onToggleTheme={handleToggleTheme}>
      <ChatWindow
        conversations={sessionSummaries}
        activeConversationId={activeConversation?.id}
        debugMode={state.debugMode}
        loading={loading}
        loadingStage={LOADING_STAGES[loadingStageIndex]}
        elapsedMs={elapsedMs}
        backendStatus={backendStatus}
        messages={activeMessages}
        sessionQuery={sessionQuery}
        onCancelRequest={handleCancelRequest}
        onClearChat={handleClearChat}
        onDeleteConversation={handleDeleteConversation}
        onNewChat={handleNewChat}
        onRenameConversation={handleRenameConversation}
        onRetryLastRequest={handleRetryLastRequest}
        onSelectConversation={setActiveConversationId}
        onSend={handleSendMessage}
        onSessionQueryChange={setSessionQuery}
        onToggleDebugMode={handleToggleDebugMode}
        onTogglePin={handleTogglePin}
      />
    </Home>
  );
}

function createAssistantMessage(data) {
  return {
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
      retrievedContext: data.retrieved_context,
      toolContext: data.tool_context,
    },
  };
}

function createLocalAssistantMessage(content, error = "request_cancelled") {
  return {
    id: crypto.randomUUID(),
    role: "assistant",
    content,
    createdAt: new Date().toISOString(),
    metadata: {
      error,
    },
  };
}

function buildConversationTitle(input) {
  const title = input.trim().replace(/\s+/g, " ");
  if (!title) {
    return "New Chat";
  }
  return title.length > 40 ? `${title.slice(0, 40)}...` : title;
}
