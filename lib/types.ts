export type Sex = "M" | "F";

export type Job = "idle" | "hunt" | "gather" | "build" | "guard" | "rest";

export type Stats = {
  strength: number;     // hunting yield, building speed, combat
  endurance: number;    // resists hunger/illness, gather yield
  agility: number;      // hunt success, dodge in combat
  intellect: number;    // crafting/building bonus, child survival
  charisma: number;     // pairing, future trade
};

export type Person = {
  id: string;
  name: string;
  sex: Sex;
  age: number;             // years
  health: number;          // 0..100
  hunger: number;          // 0..100, higher = hungrier
  energy: number;          // 0..100
  job: Job;
  stats: Stats;
  parents: [string, string] | null;
  partnerId: string | null;
  pregnantUntilDay?: number; // mother only; day when child is born
  fatherIdOfChild?: string;
};

export type Resources = {
  food: number;
  wood: number;
};

export type Defenses = {
  wallHp: number;     // current
  wallMax: number;    // capacity, grows with builds
};

export type LogEntry = {
  day: number;
  text: string;
  kind: "info" | "good" | "bad" | "event";
};

export type GameState = {
  day: number;
  season: "spring" | "summer" | "autumn" | "winter";
  people: Person[];
  resources: Resources;
  defenses: Defenses;
  log: LogEntry[];
  rng: number; // seed-ish, advances each tick
  gameOver: boolean;
};
