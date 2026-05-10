"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Person, Job } from "@/lib/types";
import { ADULT_AGE } from "@/lib/game";

const W = 600;
const H = 320;
const CAMP = { x: 300, y: 170 };
const WALL_R = 110;

type Zone = { x: number; y: number; r: number };
const ZONES: Record<Exclude<Job, "build" | "guard">, Zone> = {
  hunt:   { x: 510, y: 60,  r: 50 },
  gather: { x: 90,  y: 250, r: 40 },
  rest:   { x: CAMP.x, y: CAMP.y, r: 22 },
  idle:   { x: CAMP.x, y: CAMP.y, r: 70 },
};

type Actor = {
  x: number;
  y: number;
  tx: number;
  ty: number;
  pauseUntil: number;
  bob: number; // for the work animation
  workingFlash: number; // small icon flash time when "doing work"
  speed: number;
};

function pointInZone(z: Zone) {
  const a = Math.random() * Math.PI * 2;
  const r = Math.sqrt(Math.random()) * z.r;
  return { x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r };
}

function pointOnWall(angle: number) {
  return {
    x: CAMP.x + Math.cos(angle) * WALL_R,
    y: CAMP.y + Math.sin(angle) * WALL_R,
  };
}

function targetFor(job: Job, prevAngle: number): { x: number; y: number; angle?: number } {
  if (job === "build") {
    const a = Math.random() * Math.PI * 2;
    return { ...pointOnWall(a), angle: a };
  }
  if (job === "guard") {
    const a = prevAngle + (0.6 + Math.random() * 0.4) * (Math.random() < 0.5 ? 1 : -1);
    return { ...pointOnWall(a), angle: a };
  }
  return pointInZone(ZONES[(job in ZONES ? job : "idle") as keyof typeof ZONES]);
}

const TREES = [
  [445, 30], [475, 55], [500, 25], [535, 50], [560, 30], [475, 95], [515, 90], [545, 75],
] as const;
const BUSHES = [
  [40, 240], [60, 270], [85, 230], [110, 260], [130, 240], [150, 275], [85, 280],
] as const;

const HUTS = [
  { x: 270, y: 168, w: 30, h: 22 },
  { x: 308, y: 158, w: 32, h: 24 },
  { x: 282, y: 188, w: 28, h: 20 },
] as const;

export function VillageMap({
  people,
  wallHp,
  wallMax,
  season,
}: {
  people: Person[];
  wallHp: number;
  wallMax: number;
  season: "spring" | "summer" | "autumn" | "winter";
}) {
  const actors = useRef<Map<string, Actor>>(new Map());
  const angles = useRef<Map<string, number>>(new Map());
  const [, force] = useState(0);
  const lastT = useRef<number>(0);
  const lastFrame = useRef<number>(0);

  // Sync actor map with people
  useEffect(() => {
    const map = actors.current;
    for (const p of people) {
      if (!map.has(p.id)) {
        const start = pointInZone(ZONES.idle);
        map.set(p.id, {
          x: start.x,
          y: start.y,
          tx: start.x,
          ty: start.y,
          pauseUntil: 0,
          bob: Math.random() * Math.PI * 2,
          workingFlash: 0,
          speed: 25 + p.stats.agility * 0.35,
        });
      } else {
        const a = map.get(p.id)!;
        a.speed = 25 + p.stats.agility * 0.35;
      }
    }
    for (const id of Array.from(map.keys())) {
      if (!people.find((p) => p.id === id)) {
        map.delete(id);
        angles.current.delete(id);
      }
    }
  }, [people]);

  // Animation loop (~30fps cap)
  useEffect(() => {
    let raf = 0;
    const step = (t: number) => {
      if (!lastT.current) lastT.current = t;
      const dt = Math.min(0.08, (t - lastT.current) / 1000);
      lastT.current = t;

      for (const p of people) {
        const a = actors.current.get(p.id);
        if (!a) continue;
        a.bob += dt * 4;
        if (a.workingFlash > 0) a.workingFlash = Math.max(0, a.workingFlash - dt);
        if (t < a.pauseUntil) continue;

        const dx = a.tx - a.x;
        const dy = a.ty - a.y;
        const d = Math.hypot(dx, dy);
        if (d < 2) {
          // Arrived. For working jobs, pause briefly to "work".
          const job = p.age < ADULT_AGE ? "idle" : p.job;
          const isWorking = job === "hunt" || job === "gather" || job === "build" || job === "rest";
          if (isWorking) {
            a.pauseUntil = t + 700 + Math.random() * 1200;
            a.workingFlash = 0.9;
          }
          const prev = angles.current.get(p.id) ?? Math.atan2(a.y - CAMP.y, a.x - CAMP.x);
          const next = targetFor(job, prev);
          a.tx = next.x;
          a.ty = next.y;
          if (next.angle != null) angles.current.set(p.id, next.angle);
        } else {
          const v = a.speed * dt;
          if (v >= d) {
            a.x = a.tx;
            a.y = a.ty;
          } else {
            a.x += (dx / d) * v;
            a.y += (dy / d) * v;
          }
        }
      }

      // throttle re-renders to ~30fps
      if (t - lastFrame.current > 33) {
        lastFrame.current = t;
        force((x) => (x + 1) & 0xffff);
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [people]);

  const wallFraction = wallMax > 0 ? Math.min(1, wallHp / wallMax) : 0;
  const wallArcCmd = useMemo(() => describeArc(CAMP.x, CAMP.y, WALL_R, -Math.PI / 2, -Math.PI / 2 + wallFraction * Math.PI * 2), [wallFraction]);

  const groundColor = season === "winter" ? "#cdd1c8" : season === "autumn" ? "#dac6a3" : season === "summer" ? "#dcd3a8" : "#d3d8b3";
  const treeColor = season === "winter" ? "#5b6655" : season === "autumn" ? "#8a4f2a" : "#3f5a2c";

  return (
    <div className="parchment rounded-md p-2 overflow-hidden">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto block" role="img" aria-label="Village map">
        <defs>
          <radialGradient id="ground" cx="50%" cy="50%" r="60%">
            <stop offset="0%" stopColor={groundColor} />
            <stop offset="100%" stopColor="#9d8e6b" />
          </radialGradient>
          <pattern id="dots" width="6" height="6" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="rgba(60,40,20,0.18)" />
          </pattern>
        </defs>

        {/* Ground */}
        <rect x="0" y="0" width={W} height={H} fill="url(#ground)" />
        <rect x="0" y="0" width={W} height={H} fill="url(#dots)" />

        {/* River decoration along bottom */}
        <path
          d={`M 0 ${H - 8} Q 80 ${H - 18} 160 ${H - 8} T 320 ${H - 8} T 480 ${H - 8} T ${W} ${H - 8} L ${W} ${H} L 0 ${H} Z`}
          fill="#5b7d8a"
          opacity={0.7}
        />

        {/* Forest (hunting) */}
        {TREES.map(([x, y], i) => (
          <g key={`t${i}`} transform={`translate(${x},${y})`}>
            <ellipse cx="0" cy="6" rx="9" ry="3" fill="rgba(0,0,0,0.18)" />
            <polygon points="0,-14 -10,8 10,8" fill={treeColor} />
            <rect x="-1.5" y="6" width="3" height="6" fill="#5a3a20" />
          </g>
        ))}
        <text x="540" y="120" fontSize="9" textAnchor="middle" fill="#3b2d1a" opacity={0.6}>forest</text>

        {/* Berry/gather zone */}
        {BUSHES.map(([x, y], i) => (
          <g key={`b${i}`}>
            <circle cx={x} cy={y} r="6" fill="#4f5b3a" />
            <circle cx={x - 2} cy={y - 1} r="1.4" fill="#9c2a4a" />
            <circle cx={x + 2} cy={y + 1} r="1.4" fill="#9c2a4a" />
          </g>
        ))}
        <text x="90" y="215" fontSize="9" textAnchor="middle" fill="#3b2d1a" opacity={0.6}>foraging</text>

        {/* Wall ring */}
        <circle cx={CAMP.x} cy={CAMP.y} r={WALL_R} fill="none" stroke="rgba(60,40,20,0.18)" strokeWidth="2" strokeDasharray="3 3" />
        {wallFraction > 0 && (
          <path d={wallArcCmd} fill="none" stroke="#6b3a1b" strokeWidth="4" strokeLinecap="round" />
        )}

        {/* Huts */}
        {HUTS.map((h, i) => (
          <g key={`h${i}`}>
            <rect x={h.x} y={h.y} width={h.w} height={h.h} fill="#7a5530" stroke="#3a2614" strokeWidth="1" />
            <polygon
              points={`${h.x - 2},${h.y} ${h.x + h.w + 2},${h.y} ${h.x + h.w / 2},${h.y - 12}`}
              fill="#5a3a20"
              stroke="#3a2614"
              strokeWidth="1"
            />
            <rect x={h.x + h.w / 2 - 3} y={h.y + h.h - 8} width="6" height="8" fill="#2a1e10" />
          </g>
        ))}
        {/* Smoke */}
        <g opacity="0.4">
          <circle cx={310} cy={140} r="3" fill="#efe7d7" />
          <circle cx={313} cy={132} r="4" fill="#efe7d7" />
          <circle cx={316} cy={122} r="5" fill="#efe7d7" />
        </g>

        {/* Actors */}
        {people.map((p) => {
          const a = actors.current.get(p.id);
          if (!a) return null;
          const child = p.age < ADULT_AGE;
          const r = child ? 3.2 : 4.4;
          const fill =
            p.health < 30
              ? "#6b6253"
              : p.sex === "M"
              ? "#4a6e9c"
              : "#b56676";
          const stroke = p.pregnantUntilDay ? "#c97a3c" : "#1a1208";
          const bobY = a.pauseUntil > performance.now() ? Math.sin(a.bob * 2) * 0.8 : 0;
          const initial = p.name.charAt(0);
          const moving = a.pauseUntil <= performance.now();
          return (
            <g key={p.id} transform={`translate(${a.x.toFixed(2)},${(a.y + bobY).toFixed(2)})`}>
              <ellipse cx="0" cy={r + 1.5} rx={r * 0.9} ry={r * 0.35} fill="rgba(0,0,0,0.25)" />
              <circle cx="0" cy="0" r={r} fill={fill} stroke={stroke} strokeWidth="0.8" />
              <text
                x="0"
                y={-r - 2.5}
                fontSize="6"
                fontWeight="700"
                textAnchor="middle"
                fill="#2a1e10"
                style={{ paintOrder: "stroke", stroke: "#efe7d7", strokeWidth: 2 }}
              >
                {initial}
              </text>
              {/* working icon */}
              {a.workingFlash > 0 && !moving && (
                <text
                  x={r + 2}
                  y={-r}
                  fontSize="8"
                  fill="#3a2614"
                  opacity={a.workingFlash}
                >
                  {p.job === "hunt" ? "✶" : p.job === "gather" ? "❀" : p.job === "build" ? "▣" : p.job === "rest" ? "z" : ""}
                </text>
              )}
            </g>
          );
        })}

        {/* Legend */}
        <g transform={`translate(${W - 110}, ${H - 56})`} opacity={0.85}>
          <rect x="0" y="0" width="100" height="48" rx="3" fill="#efe7d7" stroke="#8c7553" />
          <circle cx="10" cy="12" r="3.5" fill="#4a6e9c" />
          <text x="18" y="15" fontSize="8" fill="#2a1e10">man</text>
          <circle cx="55" cy="12" r="3.5" fill="#b56676" />
          <text x="63" y="15" fontSize="8" fill="#2a1e10">woman</text>
          <circle cx="10" cy="26" r="2.5" fill="#4a6e9c" />
          <text x="18" y="29" fontSize="8" fill="#2a1e10">child</text>
          <circle cx="55" cy="26" r="3.5" fill="#b56676" stroke="#c97a3c" strokeWidth="1" />
          <text x="63" y="29" fontSize="8" fill="#2a1e10">expecting</text>
          <text x="6" y="42" fontSize="7" fill="#3a2614">villagers move to their job</text>
        </g>
      </svg>
    </div>
  );
}

function polarToCartesian(cx: number, cy: number, r: number, a: number) {
  return { x: cx + Math.cos(a) * r, y: cy + Math.sin(a) * r };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const sweep = endAngle - startAngle;
  const largeArc = Math.abs(sweep) > Math.PI ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
