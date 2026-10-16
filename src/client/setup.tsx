import { FormEvent, useEffect, useState } from "react";
import { MAX_PLAYERS, MIN_PLAYERS, isOfficialSize, roleDistribution } from "../shared/rules";
import type { PackSummary, RoomSettings, WordPack } from "../shared/types";
import { createRoom, getBuiltInPacks, getLibrary } from "./api";
import {
  InlineError,
  LIBRARY_KEY_STORAGE,
  Mascots,
  PageHeader,
  RoleTiles,
  errorText,
  hostTokenKey,
  navigate,
  seatTokenKey,
} from "./ui";

export interface SetupDraft {
  targetPlayers: number;
  packIds: string[];
  customIds: string[];
}

export function settingsFrom(draft: SetupDraft, library: WordPack[]): RoomSettings {
  return {
    targetPlayers: draft.targetPlayers,
    packIds: draft.packIds,
    customPacks: library.filter((pack) => draft.customIds.includes(pack.id)),
  };
}

/** Built-in packs plus the custom library saved in this browser, if any. */
export function usePackChoices() {
  const [packs, setPacks] = useState<PackSummary[] | null>(null);
  const [library, setLibrary] = useState<WordPack[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getBuiltInPacks().then(setPacks).catch((caught) => setError(errorText(caught, "Word packs could not load.")));
    const key = localStorage.getItem(LIBRARY_KEY_STORAGE);
    if (key) {
      void getLibrary(key)
        .then((next) => setLibrary(next.packs.filter((pack) => pack.pairs.length > 0)))
        .catch(() => localStorage.removeItem(LIBRARY_KEY_STORAGE));
    }
  }, []);

  return { packs, library, error };
}

export function PlayerCountPicker({ value, min = MIN_PLAYERS, onChange }: { value: number; min?: number; onChange: (value: number) => void }) {
  const counts = roleDistribution(value);
  return (
    <div className="count-picker">
      <label className="count-picker__value" htmlFor="player-count">
        <strong>{value}</strong>
        <span>players at the table</span>
      </label>
      <input
        id="player-count"
        type="range"
        min={min}
        max={MAX_PLAYERS}
        step={1}
        value={value}
        style={{ "--fill": `${((value - min) / Math.max(1, MAX_PLAYERS - min)) * 100}%` } as React.CSSProperties}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="count-picker__scale" aria-hidden="true"><span>{min}</span><span>{MAX_PLAYERS}</span></div>
      <RoleTiles counts={counts} caption={`Who gets what with ${value}`} />
      <p className="helper helper--left">
        {isOfficialSize(value)
          ? "Official ratio. Kittens never know if they are Good or Confused."
          : "House ratio for big tables: extra Confused Kittens keep it tricky."}
      </p>
    </div>
  );
}

export function PackPicker({
  packs,
  library,
  draft,
  onChange,
}: {
  packs: PackSummary[] | null;
  library: WordPack[];
  draft: SetupDraft;
  onChange: (draft: SetupDraft) => void;
}) {
  if (!packs) return <p className="helper helper--left">Loading word packs…</p>;
  const toggle = (list: string[], id: string) => list.includes(id) ? list.filter((value) => value !== id) : [...list, id];
  const allSelected = draft.packIds.length === packs.length;
  const pairCount = packs.filter((pack) => draft.packIds.includes(pack.id)).reduce((sum, pack) => sum + pack.pairCount, 0)
    + library.filter((pack) => draft.customIds.includes(pack.id)).reduce((sum, pack) => sum + pack.pairs.length, 0);
  return (
    <div className="pack-picker">
      <div className="pack-picker__head">
        <span className="field-label">{pairCount} word pairs selected</span>
        <button type="button" className="text-button" onClick={() => onChange({ ...draft, packIds: allSelected ? [] : packs.map((pack) => pack.id) })}>
          {allSelected ? "Clear all" : "Select all"}
        </button>
      </div>
      <div className="chip-grid">
        {packs.map((pack) => (
          <label key={pack.id} className={draft.packIds.includes(pack.id) ? "chip chip--selected" : "chip"}>
            <input type="checkbox" checked={draft.packIds.includes(pack.id)} onChange={() => onChange({ ...draft, packIds: toggle(draft.packIds, pack.id) })} />
            <span><b>{pack.name}</b><small>{pack.description}</small></span>
          </label>
        ))}
      </div>
      {library.length > 0 && (
        <>
          <div className="field-label field-label--spaced">My custom packs</div>
          <div className="chip-grid">
            {library.map((pack) => (
              <label key={pack.id} className={draft.customIds.includes(pack.id) ? "chip chip--selected chip--custom" : "chip chip--custom"}>
                <input type="checkbox" checked={draft.customIds.includes(pack.id)} onChange={() => onChange({ ...draft, customIds: toggle(draft.customIds, pack.id) })} />
                <span><b>{pack.name}</b><small>{pack.pairs.length} pairs you wrote</small></span>
              </label>
            ))}
          </div>
          <p className="helper helper--left">Playing too? You wrote these, so you will know the words. Built-in packs keep it a surprise.</p>
        </>
      )}
    </div>
  );
}

const STEPS = ["Players", "Words", "Host"] as const;

export function SetupWizard() {
  const { packs, library, error: loadError } = usePackChoices();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<SetupDraft>({ targetPlayers: 6, packIds: [], customIds: [] });
  const [playing, setPlaying] = useState(true);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (packs) setDraft((current) => current.packIds.length ? current : { ...current, packIds: packs.map((pack) => pack.id) });
  }, [packs]);

  const hasWords = draft.packIds.length > 0 || draft.customIds.length > 0;
  const canContinue = step === 0 || (step === 1 && hasWords) || (step === 2 && (!playing || !!name.trim()));

  async function openRoom(event: FormEvent) {
    event.preventDefault();
    if (step < STEPS.length - 1) {
      if (canContinue) setStep(step + 1);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const room = await createRoom({ ...settingsFrom(draft, library), hostName: playing ? name : undefined });
      localStorage.setItem(hostTokenKey(room.code), room.hostToken);
      if (room.seatToken) localStorage.setItem(seatTokenKey(room.code), room.seatToken);
      navigate(room.seatToken ? `/room/${room.code}` : `/host/${room.code}`);
    } catch (caught) {
      setError(errorText(caught, "The room could not be created."));
      setBusy(false);
    }
  }

  return (
    <main className="app-shell">
      <PageHeader action={<a className="text-link" href="/">Cancel</a>} />
      <form className="wizard panel" onSubmit={openRoom}>
        <ol className="wizard__steps" aria-label="Setup steps">
          {STEPS.map((label, index) => (
            <li key={label} className={index === step ? "is-current" : index < step ? "is-done" : ""} aria-current={index === step ? "step" : undefined}>
              <span>{index < step ? "✓" : index + 1}</span>{label}
            </li>
          ))}
        </ol>

        {step === 0 && (
          <section className="wizard__body">
            <h1>How many are playing?</h1>
            <p className="wizard__lede">Count everyone at the table{playing ? ", including you" : ""}. The roles below update as you slide.</p>
            <PlayerCountPicker value={draft.targetPlayers} onChange={(targetPlayers) => setDraft({ ...draft, targetPlayers })} />
          </section>
        )}

        {step === 1 && (
          <section className="wizard__body">
            <h1>Pick the words</h1>
            <p className="wizard__lede">Each round deals one pair from these packs: the real word and a close cousin.</p>
            <PackPicker packs={packs} library={library} draft={draft} onChange={setDraft} />
            <a className="text-link manage-link" href="/library">{library.length ? "Edit my word library" : "Write your own word pairs"}</a>
          </section>
        )}

        {step === 2 && (
          <section className="wizard__body">
            <h1>Are you playing too?</h1>
            <p className="wizard__lede">Host from your phone and play on it at the same time. Your controls never show the words or anyone’s role until the round ends.</p>
            <div className="host-choice" role="radiogroup" aria-label="Host mode">
              <label className={playing ? "selected" : ""}>
                <input type="radio" name="host-mode" checked={playing} onChange={() => setPlaying(true)} />
                <Mascots focus="kitten" />
                <span><strong>I’m playing on this phone</strong><small>Your card and the host controls share one screen.</small></span>
              </label>
              <label className={!playing ? "selected" : ""}>
                <input type="radio" name="host-mode" checked={!playing} onChange={() => setPlaying(false)} />
                <Mascots focus="pup" />
                <span><strong>This screen only hosts</strong><small>Put it on a TV or laptop for the QR code. Everyone plays on their own phone.</small></span>
              </label>
            </div>
            {playing && (
              <div className="name-field">
                <label htmlFor="host-name">Your player name</label>
                <input id="host-name" autoComplete="nickname" maxLength={24} placeholder="Jordan" value={name} onChange={(event) => setName(event.target.value)} />
              </div>
            )}
          </section>
        )}

        <InlineError message={error ?? loadError} />
        <div className="wizard__nav">
          {step > 0 && <button type="button" className="button button--secondary" onClick={() => setStep(step - 1)} disabled={busy}>Back</button>}
          <button type="submit" className="button button--primary button--large" disabled={!canContinue || busy}>
            {step < STEPS.length - 1 ? "Next" : busy ? "Opening room…" : "Open the room"}
          </button>
        </div>
      </form>
    </main>
  );
}
