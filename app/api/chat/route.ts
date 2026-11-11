import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { APICallError, convertToModelMessages, safeValidateUIMessages, streamText } from "ai";
import type { NextRequest } from "next/server";
import { hasSession, sessionCookie } from "../../lib/session";

const invalidConversation = "Nieprawidłowa rozmowa. Wpisz wiadomość i spróbuj ponownie.";
const providerErrors: Partial<Record<number, string>> = {
  400: "OpenRouter odrzucił żądanie (400). Sprawdź identyfikator modelu w OPENROUTER_MODEL.",
  401: "OpenRouter odrzucił klucz API (401). Sprawdź OPENROUTER_API_KEY w .env.local.",
  402: "OpenRouter zgłosił problem z kredytami (402). Sprawdź saldo konta.",
  403: "OpenRouter odmówił dostępu (403). Sprawdź dostęp do wybranego modelu.",
  404: "OpenRouter nie znalazł modelu lub dostawcy (404). Sprawdź OPENROUTER_MODEL w .env.local.",
  408: "OpenRouter nie odpowiedział na czas (408). Spróbuj ponownie.",
  429: "OpenRouter ograniczył liczbę żądań (429). Odczekaj chwilę i spróbuj ponownie.",
};

function describeProviderError(error: unknown): string {
  const status = APICallError.isInstance(error)
    ? error.statusCode
    : typeof error === "object" && error !== null && "code" in error && typeof error.code === "number"
      ? error.code
      : undefined;

  if (status !== undefined && status >= 400 && status <= 599) {
    return providerErrors[status] ?? `OpenRouter zwrócił błąd (${status}). Spróbuj ponownie.`;
  }

  let cause = error;
  while (cause instanceof Error) {
    if ("code" in cause && (
      cause.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
      cause.code === "SELF_SIGNED_CERT_IN_CHAIN" ||
      cause.code === "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"
    )) {
      return "Serwer chatbota nie ufa certyfikatowi OpenRouter. Uruchom go ponownie poleceniem npm.cmd run dev.";
    }
    cause = cause.cause;
  }

  if (APICallError.isInstance(error) && status === undefined) {
    return "Serwer chatbota nie mógł połączyć się z OpenRouter. Sprawdź połączenie i spróbuj ponownie.";
  }

  return "OpenRouter przerwał odpowiedź. Spróbuj ponownie.";
}

export async function POST(request: NextRequest) {
  if (!hasSession(request.cookies.get(sessionCookie)?.value)) {
    return new Response("Sesja jest wymagana. Odśwież stronę i wpisz hasło.", { status: 401 });
  }

  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  const model = process.env.OPENROUTER_MODEL?.trim();

  if (!apiKey || !model) {
    return new Response(
      "Uzupełnij OPENROUTER_API_KEY i OPENROUTER_MODEL w pliku .env.local.",
      { status: 503 },
    );
  }

  if (request.headers.get("content-type")?.split(";")[0].trim() !== "application/json") {
    return new Response(invalidConversation, { status: 415 });
  }

  const body = await request.json().catch(() => null);
  const conversation = await safeValidateUIMessages({ messages: body?.messages });
  if (!conversation.success || conversation.data.some(({ role }) => role === "system")) {
    return new Response(invalidConversation, { status: 400 });
  }

  const messages = conversation.data.map((message) => ({
    ...message,
    parts: message.parts.filter((part) => part.type === "text" && part.text.trim()),
  }));
  const lastMessage = messages.at(-1);
  if (lastMessage?.role !== "user" || !lastMessage.parts.length) {
    return new Response(invalidConversation, { status: 400 });
  }

  const openrouter = createOpenRouter({ apiKey });
  const result = streamText({
    model: openrouter.chat(model),
    messages: await convertToModelMessages(messages.filter(({ parts }) => parts.length)),
    abortSignal: request.signal,
    maxRetries: 0,
    onError: ({ error }) => console.error(describeProviderError(error)),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: false,
    onError: describeProviderError,
  });
}
