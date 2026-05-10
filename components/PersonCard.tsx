"use client";

import type { Job, Person } from "@/lib/types";
import { ADULT_AGE } from "@/lib/game";
import { StatBar } from "./StatBar";

type Props = {
  person: Person;
  partnerName?: string;
  onJob: (id: string, job: Job) => void;
  onSelectForPair: (id: string) => void;
  pairCandidate?: string | null;
};

const JOBS: { key: Job; label: string }[] = [
  { key: "hunt", label: "Hunt" },
  { key: "gather", label: "Gather" },
  { key: "build", label: "Build" },
  { key: "guard", label: "Guard" },
  { key: "rest", label: "Rest" },
  { key: "idle", label: "Idle" },
];

export function PersonCard({
  person,
  partnerName,
  onJob,
  onSelectForPair,
  pairCandidate,
}: Props) {
  const child = person.age < ADULT_AGE;
  const pregnant = !!person.pregnantUntilDay;
  return (
    <div className="parchment rounded-md p-3 flex flex-col gap-2 relative">
      {pairCandidate === person.id && (
        <div className="absolute inset-0 ring-2 ring-ember rounded-md pointer-events-none" />
      )}
      <div className="flex items-baseline justify-between gap-2">
        <div>
          <div className="font-display text-base leading-tight">
            {person.name}
            {pregnant && <span className="ml-1 text-rust" title="pregnant">◐</span>}
            {child && <span className="ml-1 text-xs text-rust">(child)</span>}
          </div>
          <div className="text-[10px] uppercase tracking-wider text-ink/70">
            {person.sex === "M" ? "♂" : "♀"} · age {person.age}
            {partnerName && <> · ♥ {partnerName}</>}
          </div>
        </div>
        <button
          className="text-[10px] underline text-ink/70 hover:text-rust"
          onClick={() => onSelectForPair(person.id)}
        >
          {pairCandidate === person.id ? "selected" : "pair"}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-1">
        <StatBar label="Health" value={person.health} color="#9c4a2a" />
        <StatBar label="Hunger" value={person.hunger} color="#7d5a2a" />
        <StatBar label="Energy" value={person.energy} color="#4f5b3a" />
      </div>

      <details className="text-[11px]">
        <summary className="cursor-pointer text-ink/70">stats</summary>
        <div className="mt-1 grid grid-cols-1 gap-1">
          <StatBar label="STR" value={person.stats.strength} />
          <StatBar label="END" value={person.stats.endurance} />
          <StatBar label="AGI" value={person.stats.agility} />
          <StatBar label="INT" value={person.stats.intellect} />
          <StatBar label="CHA" value={person.stats.charisma} />
        </div>
      </details>

      <div className="flex flex-wrap gap-1 pt-1 border-t border-ink/20">
        {JOBS.map((j) => {
          const active = person.job === j.key;
          const disabled = child && j.key !== "rest" && j.key !== "idle";
          return (
            <button
              key={j.key}
              disabled={disabled}
              onClick={() => onJob(person.id, j.key)}
              className={`btn ${active ? "btn-active" : "btn-idle"} ${
                disabled ? "opacity-30 cursor-not-allowed" : ""
              }`}
            >
              {j.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
