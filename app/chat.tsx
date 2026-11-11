"use client";

import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useEffect, useRef, useState, type FormEvent } from "react";

const transport = new DefaultChatTransport({
  api: "/api/chat",
  fetch: async (input, init) => {
    try {
      return await fetch(input, init);
    } catch {
      throw new Error("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
    }
  },
});

export default function Chat() {
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, status, error } = useChat({ transport });
  const conversationRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    const conversation = conversationRef.current;
    if (conversation) conversation.scrollTop = conversation.scrollHeight;
  }, [messages]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || busy) return;

    setDraft("");
    void sendMessage({ text });
  }

  return (
    <main>
      <header className="chat-header">
        <h1>Mój chatbot</h1>
        <form action="/api/logout" method="post">
          <button type="submit">Wyjdź</button>
        </form>
      </header>
      <div className="conversation" ref={conversationRef} role="log" aria-label="Rozmowa">
        {messages.map((message) => {
          const text = message.parts
            .filter((part) => part.type === "text")
            .map((part) => part.text)
            .join("");

          return text && <p key={message.id} data-role={message.role}>{text}</p>;
        })}
      </div>
      {busy && (
        <p role="status">
          {status === "submitted" ? "Czekam na odpowiedź…" : "Odbieram odpowiedź…"}
        </p>
      )}
      {error && <p className="chat-error" role="alert">{error.message}</p>}
      <form onSubmit={handleSubmit}>
        <label htmlFor="message">Wiadomość</label>
        <div className="composer">
          <input
            id="message"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <button type="submit" disabled={busy || !draft.trim()}>Wyślij</button>
        </div>
      </form>
    </main>
  );
}
