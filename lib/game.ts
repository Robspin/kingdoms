import type {
  GameState,
  Person,
  Stats,
  Job,
  LogEntry,
  Sex,
} from "./types";
import { pickName } from "./names";

// ---------- RNG ----------
// Deterministic-ish PRNG so saved seed produces reproducible ticks if desired.
// Mulberry32.
export function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const randInt = (rand: () => number, lo: number, hi: number) =>
  Math.floor(rand() * (hi - lo + 1)) + lo;

// ---------- People ----------

export const ADULT_AGE = 14;
export const ELDER_AGE = 55;
export const DEATH_AGE = 70;
export const DAYS_PER_YEAR = 24; // compressed: 24 game-days = 1 year of aging
export const PREGNANCY_DAYS = 18;
export const MAX_TRIBE = 16;

let _idc = 0;
const newId = () => `p${Date.now().toString(36)}_${(_idc++).toString(36)}`;

function rollStat(rand: () => number): number {
  // bell-ish via 3d40 → 3..120, clamped
  return clamp(randInt(rand, 1, 40) + randInt(rand, 1, 40) + randInt(rand, 1, 40), 10, 95);
}

function newAdult(rand: () => number, sex?: Sex): Person {
  const s: Sex = sex ?? (rand() < 0.5 ? "M" : "F");
  return {
    id: newId(),
    name: pickName(s, rand),
    sex: s,
    age: randInt(rand, 18, 30),
    health: 100,
    hunger: 30,
    energy: 80,
    job: "idle",
    stats: {
      strength: rollStat(rand),
      endurance: rollStat(rand),
      agility: rollStat(rand),
      intellect: rollStat(rand),
      charisma: rollStat(rand),
    },
    parents: null,
    partnerId: null,
  };
}

// ---------- Inheritance ----------

export function inheritStats(a: Stats, b: Stats, rand: () => number): Stats {
  const mix = (x: number, y: number) => {
    const avg = (x + y) / 2;
    // ±15 variance, occasional ±25 mutation
    const wobble = (rand() - 0.5) * 30;
    const mutation = rand() < 0.07 ? (rand() - 0.5) * 50 : 0;
    return clamp(Math.round(avg + wobble + mutation), 5, 99);
  };
  return {
    strength: mix(a.strength, b.strength),
    endurance: mix(a.endurance, b.endurance),
    agility: mix(a.agility, b.agility),
    intellect: mix(a.intellect, b.intellect),
    charisma: mix(a.charisma, b.charisma),
  };
}

function makeChild(
  mother: Person,
  father: Person,
  rand: () => number,
): Person {
  const sex: Sex = rand() < 0.5 ? "M" : "F";
  return {
    id: newId(),
    name: pickName(sex, rand),
    sex,
    age: 0,
    health: 100,
    hunger: 20,
    energy: 80,
    job: "rest",
    stats: inheritStats(mother.stats, father.stats, rand),
    parents: [mother.id, father.id],
    partnerId: null,
  };
}

// ---------- Initial state ----------

export function makeInitialState(seed = Date.now() & 0xffff): GameState {
  const rand = makeRng(seed);
  const founders: Person[] = [
    newAdult(rand, "M"),
    newAdult(rand, "F"),
    newAdult(rand, "M"),
    newAdult(rand, "F"),
  ];
  // pair the first two
  founders[0].partnerId = founders[1].id;
  founders[1].partnerId = founders[0].id;

  return {
    day: 1,
    season: "spring",
    people: founders,
    resources: { food: 30, wood: 12 },
    defenses: { wallHp: 0, wallMax: 0 },
    log: [
      { day: 1, kind: "info", text: "Your small band makes camp at the river bend." },
    ],
    rng: seed,
    gameOver: false,
  };
}

// ---------- Tick ----------

export function tickDay(state: GameState): GameState {
  if (state.gameOver) return state;
  const rand = makeRng((state.rng * 1103515245 + 12345) >>> 0);
  const next: GameState = JSON.parse(JSON.stringify(state));
  next.rng = (state.rng * 1103515245 + 12345) >>> 0;
  next.day = state.day + 1;
  next.season = seasonFor(next.day);
  const log: LogEntry[] = [];

  // Per-person work
  let foodGained = 0;
  let woodGained = 0;
  let buildPoints = 0;
  let guardPower = 0;

  for (const p of next.people) {
    if (p.health <= 0) continue;

    // Children (under ADULT_AGE) cannot work
    const isAdult = p.age >= ADULT_AGE;
    const fatigueFactor = clamp(p.energy / 100, 0.3, 1);
    const healthFactor = clamp(p.health / 100, 0.2, 1);
    const eff = fatigueFactor * healthFactor;

    if (!isAdult || p.job === "rest" || p.job === "idle") {
      p.energy = clamp(p.energy + (p.job === "rest" ? 28 : 14), 0, 100);
    } else if (p.job === "hunt") {
      const skill = (p.stats.strength * 0.6 + p.stats.agility * 0.4) / 100;
      const yieldF = (4 + skill * 14) * eff * (0.7 + rand() * 0.6);
      // hunger seasonality
      const winter = next.season === "winter" ? 0.5 : 1;
      const got = Math.round(yieldF * winter);
      foodGained += got;
      p.energy = clamp(p.energy - 18, 0, 100);
      if (rand() < 0.04 + (1 - p.stats.agility / 100) * 0.05) {
        // hunting injury
        const dmg = randInt(rand, 5, 18);
        p.health = clamp(p.health - dmg, 0, 100);
        log.push({
          day: next.day,
          kind: "bad",
          text: `${p.name} was injured on the hunt (-${dmg} hp).`,
        });
      }
    } else if (p.job === "gather") {
      const skill = (p.stats.endurance * 0.7 + p.stats.intellect * 0.3) / 100;
      const food = Math.round((2 + skill * 6) * eff * (0.7 + rand() * 0.5));
      const wood = Math.round((1 + skill * 4) * eff * (0.6 + rand() * 0.6));
      foodGained += food;
      woodGained += wood;
      p.energy = clamp(p.energy - 12, 0, 100);
    } else if (p.job === "build") {
      const skill = (p.stats.strength * 0.5 + p.stats.intellect * 0.5) / 100;
      buildPoints += (2 + skill * 8) * eff;
      p.energy = clamp(p.energy - 14, 0, 100);
    } else if (p.job === "guard") {
      guardPower += (p.stats.strength * 0.6 + p.stats.agility * 0.4) * eff;
      p.energy = clamp(p.energy - 8, 0, 100);
    }

    // Hunger
    p.hunger = clamp(p.hunger + (isAdult ? 12 : 9), 0, 100);
  }

  // Apply food / build
  next.resources.food += foodGained;
  next.resources.wood += woodGained;
  if (buildPoints > 0) {
    // each point of build = 1 wall HP, but consumes wood (1 wood / 2 hp)
    let bp = Math.floor(buildPoints);
    const woodNeeded = Math.ceil(bp / 2);
    const woodSpent = Math.min(woodNeeded, next.resources.wood);
    bp = woodSpent * 2;
    next.resources.wood -= woodSpent;
    next.defenses.wallMax += bp;
    next.defenses.wallHp = Math.min(next.defenses.wallMax, next.defenses.wallHp + bp);
    if (bp > 0) {
      log.push({
        day: next.day,
        kind: "good",
        text: `Defenses raised by ${bp} (wall ${next.defenses.wallHp}/${next.defenses.wallMax}).`,
      });
    } else if (woodNeeded > 0) {
      log.push({
        day: next.day,
        kind: "bad",
        text: "Builders idled — out of wood.",
      });
    }
  }

  // Eat
  for (const p of next.people) {
    if (p.health <= 0) continue;
    const need = p.age >= ADULT_AGE ? 2 : 1;
    if (next.resources.food >= need) {
      next.resources.food -= need;
      p.hunger = clamp(p.hunger - 30, 0, 100);
    } else {
      p.hunger = clamp(p.hunger + 10, 0, 100);
    }
    if (p.hunger > 80) {
      const dmg = randInt(rand, 4, 10);
      p.health = clamp(p.health - dmg, 0, 100);
    } else if (p.hunger < 40 && p.energy > 50 && p.health < 100) {
      p.health = clamp(p.health + 2, 0, 100);
    }
  }

  // Aging — every DAYS_PER_YEAR days, +1 year for everyone
  if (next.day % DAYS_PER_YEAR === 0) {
    for (const p of next.people) {
      if (p.health <= 0) continue;
      p.age += 1;
      if (p.age >= DEATH_AGE) {
        // chance to die of old age, increases each year past
        const chance = 0.15 + (p.age - DEATH_AGE) * 0.08;
        if (rand() < chance) {
          p.health = 0;
          log.push({
            day: next.day,
            kind: "bad",
            text: `${p.name} died of old age (${p.age}).`,
          });
        }
      }
    }
  }

  // Births (mothers reaching term)
  for (const mom of next.people) {
    if (mom.pregnantUntilDay && next.day >= mom.pregnantUntilDay) {
      const dad = next.people.find((x) => x.id === mom.fatherIdOfChild);
      if (dad && next.people.length < MAX_TRIBE + 8) {
        // child survival linked to mother health & food
        const survivalRoll = rand();
        const survivalChance = 0.7 + (mom.health / 100) * 0.2 + (mom.stats.endurance / 200);
        if (survivalRoll < survivalChance) {
          const baby = makeChild(mom, dad, rand);
          next.people.push(baby);
          log.push({
            day: next.day,
            kind: "good",
            text: `${mom.name} bore a child: ${baby.name} (${baby.sex}).`,
          });
        } else {
          log.push({
            day: next.day,
            kind: "bad",
            text: `${mom.name} lost the child in birth.`,
          });
          mom.health = clamp(mom.health - 15, 0, 100);
        }
      }
      mom.pregnantUntilDay = undefined;
      mom.fatherIdOfChild = undefined;
    }
  }

  // Auto-conception for paired adults living together (low rate)
  for (const w of next.people) {
    if (w.sex !== "F" || !w.partnerId || w.pregnantUntilDay) continue;
    if (w.age < ADULT_AGE || w.age > 45 || w.health < 60) continue;
    const dad = next.people.find((x) => x.id === w.partnerId);
    if (!dad || dad.health < 50 || dad.age < ADULT_AGE) continue;
    if (rand() < 0.04) {
      w.pregnantUntilDay = next.day + PREGNANCY_DAYS;
      w.fatherIdOfChild = dad.id;
      log.push({
        day: next.day,
        kind: "info",
        text: `${w.name} is with child.`,
      });
    }
  }

  // Random events
  rollEvents(next, rand, log, guardPower);

  // Cull deceased into the log; keep them in the array but flagged dead so UI can show?
  // Simpler: remove dead, add log already noted.
  next.people = next.people.filter((p) => p.health > 0);

  // Game over check
  const adults = next.people.filter((p) => p.age >= ADULT_AGE);
  if (adults.length === 0) {
    next.gameOver = true;
    log.push({ day: next.day, kind: "bad", text: "The tribe has perished." });
  }

  next.log = [...log.reverse(), ...state.log].slice(0, 80);
  return next;
}

function seasonFor(day: number): GameState["season"] {
  const m = Math.floor(((day - 1) % DAYS_PER_YEAR) / 6);
  return (["spring", "summer", "autumn", "winter"] as const)[m] ?? "spring";
}

function rollEvents(
  state: GameState,
  rand: () => number,
  log: LogEntry[],
  guardPower: number,
) {
  // 1) Bountiful day
  if (rand() < 0.06) {
    const bonus = randInt(rand, 6, 18);
    state.resources.food += bonus;
    log.push({
      day: state.day,
      kind: "good",
      text: `A bountiful day — found ${bonus} extra food.`,
    });
  }
  // 2) Storm
  if (rand() < 0.05) {
    const wreck = randInt(rand, 3, 12);
    if (state.defenses.wallHp > 0) {
      state.defenses.wallHp = Math.max(0, state.defenses.wallHp - wreck);
      log.push({
        day: state.day,
        kind: "bad",
        text: `Storm battered the walls (-${wreck} hp).`,
      });
    }
  }
  // 3) Illness
  if (rand() < 0.07) {
    const victim = state.people[randInt(rand, 0, state.people.length - 1)];
    if (victim) {
      const dmg = randInt(rand, 6, 18);
      victim.health = clamp(victim.health - dmg, 0, 100);
      log.push({
        day: state.day,
        kind: "bad",
        text: `${victim.name} fell ill (-${dmg} hp).`,
      });
    }
  }
  // 4) Raider party — risk grows with food stockpile
  const wealth = state.resources.food + state.resources.wood;
  const raidChance = Math.min(0.18, 0.02 + wealth / 1500);
  if (state.day > 5 && rand() < raidChance) {
    const raiderPower = randInt(rand, 30, 80) + Math.floor(state.day / 30) * 10;
    const wallContribution = state.defenses.wallHp * 1.2;
    const defense = guardPower + wallContribution;
    log.push({
      day: state.day,
      kind: "event",
      text: `Raiders strike! (their power ~${raiderPower}, your defense ~${Math.round(defense)})`,
    });
    if (defense >= raiderPower) {
      state.defenses.wallHp = Math.max(0, state.defenses.wallHp - randInt(rand, 4, 14));
      log.push({
        day: state.day,
        kind: "good",
        text: "Raiders driven off.",
      });
    } else {
      const lost = Math.min(state.resources.food, randInt(rand, 8, 25));
      state.resources.food -= lost;
      // possibly wound someone
      const adults = state.people.filter((p) => p.age >= 14);
      if (adults.length) {
        const v = adults[randInt(rand, 0, adults.length - 1)];
        const dmg = randInt(rand, 15, 40);
        v.health = clamp(v.health - dmg, 0, 100);
        log.push({
          day: state.day,
          kind: "bad",
          text: `Raiders took ${lost} food and wounded ${v.name} (-${dmg} hp).`,
        });
      } else {
        log.push({
          day: state.day,
          kind: "bad",
          text: `Raiders took ${lost} food.`,
        });
      }
      state.defenses.wallHp = Math.max(0, state.defenses.wallHp - randInt(rand, 8, 25));
    }
  }
}

// ---------- UI helpers ----------

export function setJob(state: GameState, id: string, job: Job): GameState {
  return {
    ...state,
    people: state.people.map((p) => (p.id === id ? { ...p, job } : p)),
  };
}

export function pair(state: GameState, aId: string, bId: string): GameState {
  if (aId === bId) return state;
  const a = state.people.find((p) => p.id === aId);
  const b = state.people.find((p) => p.id === bId);
  if (!a || !b) return state;
  if (a.sex === b.sex) return state;
  const next = state.people.map((p) => {
    if (p.id === aId) return { ...p, partnerId: bId };
    if (p.id === bId) return { ...p, partnerId: aId };
    if (p.partnerId === aId || p.partnerId === bId) return { ...p, partnerId: null };
    return p;
  });
  const entry: LogEntry = {
    day: state.day,
    kind: "info",
    text: `${a.name} and ${b.name} pair off.`,
  };
  return {
    ...state,
    people: next,
    log: [entry, ...state.log].slice(0, 80),
  };
}

export function unpair(state: GameState, id: string): GameState {
  const me = state.people.find((p) => p.id === id);
  if (!me?.partnerId) return state;
  const partnerId = me.partnerId;
  return {
    ...state,
    people: state.people.map((p) =>
      p.id === id || p.id === partnerId ? { ...p, partnerId: null } : p,
    ),
  };
}

export function statSummary(s: Stats) {
  return (s.strength + s.endurance + s.agility + s.intellect + s.charisma) / 5;
}
