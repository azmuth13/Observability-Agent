import { useState } from "react";
import ChatWindow from "./components/ChatWindow";
import Home from "./pages/Home";

const API_BASE_URL = "http://localhost:8000/api";

export default function App() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content:
        "Ask about logs, metrics, JVM issues, or incident debugging and I will walk through it.",
    },
  ]);
  const [loading, setLoading] = useState(false);

  async function handleSendMessage(input) {
    const nextMessages = [...messages, { role: "user", content: input }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: input }),
      });
      const data = await response.json();
      setMessages([
        ...nextMessages,
        { role: "assistant", content: data.answer || "No answer returned." },
      ]);
    } catch (error) {
      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: "The backend is not reachable yet. Start FastAPI and try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Home>
      <ChatWindow messages={messages} loading={loading} onSend={handleSendMessage} />
    </Home>
  );
}
