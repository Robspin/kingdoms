"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  makeInitialState,
  tickDay,
  setJob,
  pair,
  unpair,
} from "@/lib/game";
import type { GameState, Job } from "@/lib/types";
import { PersonCard } from "@/components/PersonCard";
import { VillageMap } from "@/components/VillageMap";

const SAVE_KEY = "kingdoms.save.v1";

export default function Page() {
  const [state, setState] = useState<GameState | null>(null);
  const [pairCand, setPairCand] = useState<string | null>(null);
  const [auto, setAuto] = useState(false);
  const [speedMs, setSpeedMs] = useState(1500);
  const tickRef = useRef<number | null>(null);

  // load
  useEffect(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        setState(JSON.parse(raw));
        return;
      }
    } catch {}
    setState(makeInitialState());
  }, []);

  // persist
  useEffect(() => {
    if (!state) return;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    } catch {}
  }, [state]);

  // auto-tick
  useEffect(() => {
    if (!auto || !state || state.gameOver) return;
    tickRef.current = window.setInterval(() => {
      setState((s) => (s ? tickDay(s) : s));
    }, speedMs);
    return () => {
      if (tickRef.current) window.clearInterval(tickRef.current);
    };
  }, [auto, state?.gameOver, speedMs, state]);

  const handleJob = useCallback((id: string, job: Job) => {
    setState((s) => (s ? setJob(s, id, job) : s));
  }, []);

  const handlePair = useCallback(
    (id: string) => {
      if (!state) return;
      const me = state.people.find((p) => p.id === id);
      if (!me) return;
      if (me.partnerId) {
        // unpair when clicking an already-paired person
        setState(unpair(state, id));
        setPairCand(null);
        return;
      }
      if (!pairCand) {
        setPairCand(id);
        return;
      }
      if (pairCand === id) {
        setPairCand(null);
        return;
      }
      setState(pair(state, pairCand, id));
      setPairCand(null);
    },
    [state, pairCand],
  );

  const handleReset = () => {
    if (!confirm("Start a new tribe? Current run will be lost.")) return;
    const fresh = makeInitialState();
    setState(fresh);
    setPairCand(null);
    setAuto(false);
  };

  const stats = useMemo(() => {
    if (!state) return null;
    const adults = state.people.filter((p) => p.age >= 14).length;
    const children = state.people.length - adults;
    return { adults, children };
  }, [state]);

  if (!state) return <div className="p-6">…</div>;

  const partnerName = (id: string | null) =>
    state.people.find((p) => p.id === id)?.name?.split(" ")[0];

  const seasonGlyph = { spring: "✿", summer: "☀", autumn: "✦", winter: "❄" }[state.season];

  return (
    <main className="min-h-screen px-4 py-5 max-w-[1400px] mx-auto">
      <header className="flex items-baseline justify-between gap-4 mb-4 border-b border-bone/15 pb-3">
        <div>
          <h1 className="font-display text-2xl tracking-wide flame text-ember">Kingdoms</h1>
          <p className="text-xs text-bone/60">A small tribe sim · proof of concept</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span className="tabular-nums">Day <b>{state.day}</b></span>
          <span className="capitalize">{seasonGlyph} {state.season}</span>
          <button
            className="btn btn-idle"
            onClick={() => setState(tickDay(state))}
            disabled={state.gameOver}
          >
            Advance day
          </button>
          <button
            className={`btn ${auto ? "btn-active" : "btn-idle"}`}
            onClick={() => setAuto((v) => !v)}
            disabled={state.gameOver}
          >
            {auto ? "Pause" : "Auto"}
          </button>
          <select
            className="bg-[#2a221a] border border-bone/20 rounded text-xs px-1 py-1"
            value={speedMs}
            onChange={(e) => setSpeedMs(Number(e.target.value))}
          >
            <option value={2500}>slow</option>
            <option value={1500}>normal</option>
            <option value={700}>fast</option>
            <option value={250}>frantic</option>
          </select>
          <button className="btn btn-idle" onClick={handleReset}>Reset</button>
        </div>
      </header>

      {/* Resource strip */}
      <section className="grid grid-cols-2 md:grid-cols-5 gap-2 mb-4">
        <ResourceTile label="Food" value={state.resources.food} hint="2/adult/day" />
        <ResourceTile label="Wood" value={state.resources.wood} hint="2 hp wall / wood" />
        <ResourceTile
          label="Walls"
          value={`${state.defenses.wallHp}/${state.defenses.wallMax}`}
          hint="defends raids"
        />
        <ResourceTile
          label="Adults"
          value={`${stats?.adults ?? 0}`}
          hint={`${stats?.children ?? 0} children`}
        />
        <ResourceTile
          label="Pairs"
          value={`${state.people.filter((p) => p.partnerId && p.sex === "F").length}`}
          hint="bear children"
        />
      </section>

      <section className="mb-4">
        <VillageMap
          people={state.people}
          wallHp={state.defenses.wallHp}
          wallMax={state.defenses.wallMax}
          season={state.season}
        />
      </section>

      {state.gameOver && (
        <div className="parchment rounded p-4 text-center mb-4">
          <div className="font-display text-xl">Your tribe has fallen.</div>
          <div className="text-sm text-ink/70">It survived {state.day} days.</div>
          <button className="btn btn-active mt-2" onClick={handleReset}>Begin again</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* People */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-display text-lg">The people</h2>
            {pairCand && (
              <span className="text-xs text-ember">
                Selected for pairing — click another tribesperson of the opposite sex.
                <button
                  className="ml-2 underline text-bone/60"
                  onClick={() => setPairCand(null)}
                >
                  cancel
                </button>
              </span>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {state.people.map((p) => (
              <PersonCard
                key={p.id}
                person={p}
                partnerName={p.partnerId ? partnerName(p.partnerId) : undefined}
                onJob={handleJob}
                onSelectForPair={handlePair}
                pairCandidate={pairCand}
              />
            ))}
          </div>
        </section>

        {/* Log */}
        <aside className="lg:sticky lg:top-4 self-start">
          <h2 className="font-display text-lg mb-2">Chronicle</h2>
          <ol className="space-y-1 text-xs max-h-[70vh] overflow-y-auto pr-1">
            {state.log.map((e, i) => (
              <li
                key={i}
                className={
                  "flex gap-2 leading-snug " +
                  (e.kind === "good"
                    ? "text-[#a8c98a]"
                    : e.kind === "bad"
                    ? "text-[#d68b6f]"
                    : e.kind === "event"
                    ? "text-ember"
                    : "text-bone/80")
                }
              >
                <span className="w-9 shrink-0 tabular-nums text-bone/50">d{e.day}</span>
                <span>{e.text}</span>
              </li>
            ))}
          </ol>
        </aside>
      </div>

      <footer className="mt-8 text-[11px] text-bone/40 text-center">
        Hunting needs STR+AGI · Gathering needs END+INT · Building needs STR+INT · Guarding STR+AGI.
        Children inherit a blend of parents' stats with random variance.
      </footer>
    </main>
  );
}

function ResourceTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: number | string;
  hint?: string;
}) {
  return (
    <div className="parchment rounded px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-ink/70">{label}</div>
      <div className="font-display text-xl tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-ink/60">{hint}</div>}
    </div>
  );
}
