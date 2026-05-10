// Small evocative name pool for tribe members.
const MALE = [
  "Bren", "Kael", "Ros", "Tarn", "Odd", "Vek", "Hask", "Mir", "Drev", "Olm",
  "Gar", "Yorn", "Sten", "Runa", "Korg", "Falk", "Eron", "Thal", "Bask", "Vorn",
];
const FEMALE = [
  "Ila", "Mara", "Nyx", "Sela", "Ona", "Tamsi", "Bryn", "Lira", "Vela", "Esra",
  "Ket", "Yara", "Solke", "Wren", "Alka", "Jorah", "Nima", "Vayla", "Riska", "Tova",
];
const SURNAME = [
  "Ash", "Stonehand", "Moss", "Rookspeak", "Thornroot", "Coldwater", "Pinebough",
  "Hollowfen", "Ironvein", "Brackleaf", "Fellbrook", "Greyhart",
];

export function pickName(sex: "M" | "F", rand: () => number): string {
  const first = sex === "M" ? MALE[Math.floor(rand() * MALE.length)] : FEMALE[Math.floor(rand() * FEMALE.length)];
  const last = SURNAME[Math.floor(rand() * SURNAME.length)];
  return `${first} ${last}`;
}
