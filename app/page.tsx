import { cookies } from "next/headers";
import Chat from "./chat";
import { hasSession, isAuthConfigured, sessionCookie } from "./lib/session";

export default async function Home({ searchParams }: PageProps<"/">) {
  const cookie = (await cookies()).get(sessionCookie)?.value;
  if (hasSession(cookie)) return <Chat />;

  const configured = isAuthConfigured();
  const { login } = await searchParams;
  const error = !configured
    ? "Logowanie jest niedostępne. Ustaw CHAT_PASSWORD i SESSION_SECRET na serwerze."
    : login === "invalid"
      ? "Błędne hasło. Spróbuj ponownie."
      : login === "limited"
        ? "Za dużo prób. Odczekaj minutę i spróbuj ponownie."
        : null;

  return (
    <main>
      <h1>Wpisz hasło</h1>
      {error && <p className="chat-error" role="alert">{error}</p>}
      <form action="/api/login" method="post">
        <label htmlFor="password">Hasło warsztatowe</label>
        <div className="composer">
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            maxLength={256}
            disabled={!configured}
          />
          <button type="submit" disabled={!configured}>Wejdź</button>
        </div>
      </form>
    </main>
  );
}
