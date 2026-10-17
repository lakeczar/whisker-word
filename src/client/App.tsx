import { FormEvent, useState } from "react";
import { getPublicRoom } from "./api";
import { HostScreen } from "./host";
import { LibraryPage } from "./library";
import { PlayerPage } from "./player";
import { SetupWizard } from "./setup";
import { Brand, InlineError, Mascots, PageHeader, errorText, navigate } from "./ui";

function roomCodeFromPath(index: number): string {
  return window.location.pathname.split("/").filter(Boolean)[index]?.toUpperCase() ?? "";
}

function HomePage() {
  const [joinCode, setJoinCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleJoin(event: FormEvent) {
    event.preventDefault();
    const code = joinCode.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (code.length !== 6) {
      setError("Enter the six-character room code.");
      return;
    }
    try {
      await getPublicRoom(code);
      navigate(`/room/${code}`);
    } catch (caught) {
      setError(errorText(caught, "Room not found."));
    }
  }

  return (
    <main className="home-shell">
      <PageHeader action={<a className="text-link" href="/library">My word library</a>} />
      <section className="hero">
        <div className="hero__copy">
          <div className="eyebrow">One QR. Every secret. Zero installs.</div>
          <h1>Same room.<br /><em>Different words.</em></h1>
          <p className="hero__lede">A fast, private word game for the people already sitting around your table.</p>
          <div className="hero__actions">
            <a className="button button--primary button--large" href="/new">Create a room</a>
            <form className="join-form" onSubmit={handleJoin}>
              <label htmlFor="room-code">Join with a code</label>
              <div>
                <input
                  id="room-code"
                  inputMode="text"
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={6}
                  placeholder="PAWS24"
                  value={joinCode}
                  onChange={(event) => setJoinCode(event.target.value.toUpperCase())}
                />
                <button className="button button--dark" type="submit">Join</button>
              </div>
            </form>
          </div>
          <InlineError message={error} />
          <ul className="trust-list" aria-label="Game benefits">
            <li>No accounts</li><li>4–12 players</li><li>Host and play on one phone</li>
          </ul>
        </div>
        <div className="hero__art">
          <div className="speech speech--kitten">I know the word.</div>
          <Mascots />
          <div className="speech speech--pup">…probably.</div>
        </div>
      </section>
      <section className="how-it-works">
        <article><span>01</span><h2>Set up in three taps</h2><p>Slide to your table size, see who gets which role, and pick the word packs.</p></article>
        <article><span>02</span><h2>Everyone scans once</h2><p>Each phone becomes a private card for the whole night, including the host’s.</p></article>
        <article><span>03</span><h2>Clue, vote, reveal</h2><p>One clue each, then vote someone out. Their role shows on every phone.</p></article>
      </section>
      <section className="rule-strip">
        <div><strong>Good Kittens</strong><span>Know the real word</span></div>
        <div><strong>Confused Kittens</strong><span>Get a close cousin of it, and don’t know</span></div>
        <div><strong>Spy Pup</strong><span>Gets no word and bluffs</span></div>
      </section>
      <footer><Brand compact /><span>Original art and hand-picked word pairs.</span></footer>
    </main>
  );
}

export function App() {
  const path = window.location.pathname.split("/").filter(Boolean);
  if (path[0] === "new") return <SetupWizard />;
  if (path[0] === "host" && path[1]) return <HostScreen code={roomCodeFromPath(1)} />;
  if (path[0] === "room" && path[1]) return <PlayerPage code={roomCodeFromPath(1)} />;
  if (path[0] === "library") return <LibraryPage />;
  return <HomePage />;
}
