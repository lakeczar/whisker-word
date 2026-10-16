import { FormEvent, useEffect, useMemo, useState } from "react";
import type { WordPack } from "../shared/types";
import { createLibrary, deleteLibrary, getLibrary, saveLibrary } from "./api";
import { InlineError, LIBRARY_KEY_STORAGE, Mascots, PageHeader } from "./ui";

export function LibraryPage() {
  const [key, setKey] = useState<string | null>(() => localStorage.getItem(LIBRARY_KEY_STORAGE));
  const [recoveryInput, setRecoveryInput] = useState("");
  const [packs, setPacks] = useState<WordPack[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const totalPairs = useMemo(() => packs?.reduce((sum, pack) => sum + pack.pairs.length, 0) ?? 0, [packs]);

  useEffect(() => {
    if (!key) return;
    void getLibrary(key).then((library) => setPacks(library.packs)).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Library could not be opened.");
      setPacks(null);
    });
  }, [key]);

  async function makeLibrary() {
    setBusy(true); setError(null);
    try {
      const result = await createLibrary();
      localStorage.setItem(LIBRARY_KEY_STORAGE, result.recoveryKey);
      setKey(result.recoveryKey);
      setPacks(result.library.packs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Library could not be created.");
    } finally { setBusy(false); }
  }

  async function recoverLibrary(event: FormEvent) {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const library = await getLibrary(recoveryInput.trim());
      localStorage.setItem(LIBRARY_KEY_STORAGE, recoveryInput.trim());
      setKey(recoveryInput.trim());
      setPacks(library.packs);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "That recovery key did not work.");
    } finally { setBusy(false); }
  }

  function updatePack(packId: string, updater: (pack: WordPack) => WordPack) {
    setPacks((current) => current?.map((pack) => pack.id === packId ? updater(pack) : pack) ?? []);
    setSaved(false);
  }

  async function persist() {
    if (!key || !packs) return;
    setBusy(true); setError(null);
    try {
      const result = await saveLibrary(key, packs);
      setPacks(result.packs);
      setSaved(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Library could not be saved.");
    } finally { setBusy(false); }
  }

  async function removeLibrary() {
    if (!key || !window.confirm("Permanently delete this custom word library? The recovery key will stop working.")) return;
    setBusy(true);
    try {
      await deleteLibrary(key);
      localStorage.removeItem(LIBRARY_KEY_STORAGE);
      setKey(null); setPacks(null);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Library could not be deleted."); }
    finally { setBusy(false); }
  }

  if (!key || packs === null) {
    return (
      <main className="app-shell library-shell">
        <PageHeader action={<a className="text-link" href="/">Back to game</a>} />
        <section className="library-welcome">
          <Mascots focus="kitten" />
          <div className="eyebrow">Private cloud library</div>
          <h1>Your words, ready for game night.</h1>
          <p>Create custom Good and Confused password pairs. No account or email needed.</p>
          <button className="button button--primary button--large" onClick={makeLibrary} disabled={busy}>{busy ? "Opening…" : "Create my library"}</button>
          <div className="divider"><span>or restore one</span></div>
          <form className="recovery-form" onSubmit={recoverLibrary}><label htmlFor="recovery-key">Private recovery key</label><div><input id="recovery-key" value={recoveryInput} onChange={(event) => setRecoveryInput(event.target.value)} placeholder="Paste your saved key" /><button className="button button--dark" disabled={busy || recoveryInput.length < 32}>Restore</button></div></form>
          <InlineError message={error} />
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell library-shell">
      <PageHeader action={<a className="text-link" href="/">Back to game</a>} />
      <section className="library-editor">
        <div className="library-title"><div><div className="eyebrow">My custom library</div><h1>Word packs</h1><p>{packs.length} {packs.length === 1 ? "pack" : "packs"} · {totalPairs} of 500 pairs</p></div><div className="library-actions"><button className="button button--secondary" onClick={() => navigator.clipboard.writeText(key)}>Copy recovery key</button><button className="button button--primary" disabled={busy} onClick={persist}>{busy ? "Saving…" : saved ? "Saved ✓" : "Save library"}</button></div></div>
        <div className="key-warning"><strong>Keep your recovery key private.</strong><span>It is the only way to open this library on another computer.</span></div>
        <div className="pack-editor-list">
          {packs.map((pack) => (
            <article className="pack-editor" key={pack.id}>
              <div className="pack-editor__head"><input aria-label="Pack name" value={pack.name} onChange={(event) => updatePack(pack.id, (current) => ({ ...current, name: event.target.value }))} /><button className="icon-button" aria-label={`Delete ${pack.name}`} onClick={() => setPacks((current) => current?.filter((candidate) => candidate.id !== pack.id) ?? [])}>×</button></div>
              <div className="pair-labels"><span>Good password</span><span>Confused password</span><span /></div>
              {pack.pairs.map((pair, pairIndex) => (
                <div className="pair-row" key={`${pack.id}-${pairIndex}`}>
                  <input aria-label="Good password" placeholder="Good password" value={pair.goodWord} onChange={(event) => updatePack(pack.id, (current) => ({ ...current, pairs: current.pairs.map((candidate, index) => index === pairIndex ? { ...candidate, goodWord: event.target.value } : candidate) }))} />
                  <input aria-label="Confused password" placeholder="Confused password" value={pair.confusedWord} onChange={(event) => updatePack(pack.id, (current) => ({ ...current, pairs: current.pairs.map((candidate, index) => index === pairIndex ? { ...candidate, confusedWord: event.target.value } : candidate) }))} />
                  <button className="icon-button" aria-label="Delete pair" onClick={() => updatePack(pack.id, (current) => ({ ...current, pairs: current.pairs.filter((_, index) => index !== pairIndex) }))}>×</button>
                </div>
              ))}
              <button className="text-button add-pair" disabled={totalPairs >= 500} onClick={() => updatePack(pack.id, (current) => ({ ...current, pairs: [...current.pairs, { goodWord: "", confusedWord: "" }] }))}>+ Add a password pair</button>
            </article>
          ))}
          {packs.length === 0 && <div className="empty-library"><Mascots focus="kitten" /><h2>No custom packs yet</h2><p>Start with a name, then add closely related password pairs.</p></div>}
        </div>
        <button className="button button--dark add-pack-button" disabled={packs.length >= 20} onClick={() => { setPacks((current) => [...(current ?? []), { id: `custom-${crypto.randomUUID()}`, name: `New pack ${(current?.length ?? 0) + 1}`, pairs: [{ goodWord: "", confusedWord: "" }] }]); setSaved(false); }}>+ Add another pack</button>
        <InlineError message={error} />
        <button className="text-button danger-text delete-library" disabled={busy} onClick={removeLibrary}>Delete this entire library</button>
      </section>
    </main>
  );
}
