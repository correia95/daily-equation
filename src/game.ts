// Daily equation guessing game — engine.
// Guess a hidden 8-tile arithmetic equation (e.g. 12+34=46) in 6 tries.

export const COLS = 8;
export const ROWS = 6;
export const EPOCH = '2026-09-07'; // puzzle #1

export type Tile = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '+' | '-' | '*' | '/' | '=';
export type Mark = 'correct' | 'present' | 'absent';

export const DIGITS: Tile[] = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
export const OPS: Tile[] = ['+', '-', '*', '/'];

// ---------- daily puzzle number ----------

export function dayNumber(today: Date = new Date()): number {
  const start = Date.UTC(2026, 8, 7); // 2026-09-07
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.floor((now - start) / 86400000) + 1;
}

// ---------- seeded RNG (mulberry32) ----------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const randInt = (rng: () => number, lo: number, hi: number) =>
  lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

// ---------- equation evaluation & validation ----------

// Evaluate a left-hand expression of positive integers with + - * / and
// standard precedence. Returns null if it is not a well-formed, non-negative,
// integer-only expression (Nerdle rules: no negative results at any step,
// division must be exact).
export function evalExpr(expr: string): number | null {
  if (!/^[0-9]+([+\-*/][0-9]+)*$/.test(expr)) return null;
  const nums = expr.split(/[+\-*/]/).map((n) => n);
  for (const n of nums) {
    if (n.length > 1 && n[0] === '0') return null; // no leading zeros
    if (n === '') return null;
  }
  const tokens: (number | string)[] = [];
  let i = 0;
  const src = expr;
  while (i < src.length) {
    const c = src[i];
    if (c >= '0' && c <= '9') {
      let j = i;
      while (j < src.length && src[j] >= '0' && src[j] <= '9') j++;
      tokens.push(parseInt(src.slice(i, j), 10));
      i = j;
    } else {
      tokens.push(c);
      i++;
    }
  }
  // pass 1: * and /
  const pass1: (number | string)[] = [];
  for (let k = 0; k < tokens.length; k++) {
    const t = tokens[k];
    if (t === '*' || t === '/') {
      const prev = pass1.pop() as number;
      const next = tokens[++k] as number;
      if (t === '*') pass1.push(prev * next);
      else {
        if (next === 0 || prev % next !== 0) return null;
        pass1.push(prev / next);
      }
    } else {
      pass1.push(t);
    }
  }
  // pass 2: + and -
  let acc = pass1[0] as number;
  for (let k = 1; k < pass1.length; k += 2) {
    const op = pass1[k];
    const val = pass1[k + 1] as number;
    acc = op === '+' ? acc + val : acc - val;
    if (acc < 0) return null; // no negative intermediate/final
  }
  return acc;
}

export function isValidEquation(guess: string): { ok: boolean; reason?: string } {
  if (guess.length !== COLS) return { ok: false, reason: `Needs ${COLS} tiles` };
  const eq = guess.indexOf('=');
  if (eq === -1) return { ok: false, reason: 'Needs an = sign' };
  if (guess.indexOf('=', eq + 1) !== -1) return { ok: false, reason: 'Only one = sign' };
  const lhs = guess.slice(0, eq);
  const rhs = guess.slice(eq + 1);
  if (!/^[0-9]+$/.test(rhs)) return { ok: false, reason: 'Right of = must be a plain number' };
  if (rhs.length > 1 && rhs[0] === '0') return { ok: false, reason: 'No leading zeros' };
  const left = evalExpr(lhs);
  if (left === null) return { ok: false, reason: "That maths doesn't work" };
  if (left !== parseInt(rhs, 10)) return { ok: false, reason: "Left side doesn't equal right" };
  return { ok: true };
}

// ---------- daily answer generation ----------

function build(rng: () => number): string | null {
  const twoOps = rng() < 0.6;
  const mkNum = (maxDigits: number) => {
    const d = randInt(rng, 1, maxDigits);
    const lo = d === 1 ? 1 : Math.pow(10, d - 1);
    const hi = Math.pow(10, d) - 1;
    return randInt(rng, lo, hi);
  };

  let lhs: string;
  if (twoOps) {
    const a = mkNum(2);
    const b = mkNum(2);
    const c = mkNum(2);
    const o1 = pick(rng, OPS);
    const o2 = pick(rng, OPS);
    lhs = `${a}${o1}${b}${o2}${c}`;
  } else {
    const a = mkNum(3);
    const b = mkNum(3);
    const o1 = pick(rng, OPS);
    lhs = `${a}${o1}${b}`;
  }
  const val = evalExpr(lhs);
  if (val === null || val < 0) return null;
  const eq = `${lhs}=${val}`;
  if (eq.length !== COLS) return null;
  if (!isValidEquation(eq).ok) return null;
  // reject trivial pieces: adding/subtracting 0, or ×/÷ by 1
  const parts = lhs.split(/([+\-*/])/); // [num, op, num, op, num]
  for (let k = 1; k < parts.length; k += 2) {
    const op = parts[k];
    const l = parts[k - 1];
    const r = parts[k + 1];
    if ((op === '+' || op === '-') && (l === '0' || r === '0')) return null;
    if ((op === '*' || op === '/') && (l === '1' || r === '1' || l === '0' || r === '0')) return null;
  }
  return eq;
}

const FALLBACKS = [
  '12+34=46', '98-73=25', '64/16=4', '9+8*7=65', '48-6*7=6',
  '7*9-3=60', '13+29=42', '81/27=3', '5*5+9=34', '72-38=34',
];

export function answerFor(day: number): string {
  const rng = mulberry32(day * 2654435761 + 12345);
  for (let attempt = 0; attempt < 4000; attempt++) {
    const eq = build(rng);
    if (eq) return eq;
  }
  return FALLBACKS[((day % FALLBACKS.length) + FALLBACKS.length) % FALLBACKS.length];
}

// ---------- scoring ----------

export function score(guess: string, answer: string): Mark[] {
  const marks: Mark[] = new Array(COLS).fill('absent');
  const counts: Record<string, number> = {};
  for (const ch of answer) counts[ch] = (counts[ch] || 0) + 1;
  for (let i = 0; i < COLS; i++) {
    if (guess[i] === answer[i]) {
      marks[i] = 'correct';
      counts[guess[i]]--;
    }
  }
  for (let i = 0; i < COLS; i++) {
    if (marks[i] === 'correct') continue;
    if (counts[guess[i]] > 0) {
      marks[i] = 'present';
      counts[guess[i]]--;
    }
  }
  return marks;
}

// Aggregate the best mark seen for each tile, for keyboard colouring.
export function mergeKeyboard(
  prev: Record<string, Mark>,
  guess: string,
  marks: Mark[],
): Record<string, Mark> {
  const rank: Record<Mark, number> = { absent: 0, present: 1, correct: 2 };
  const next = { ...prev };
  for (let i = 0; i < guess.length; i++) {
    const ch = guess[i];
    const m = marks[i];
    if (!(ch in next) || rank[m] > rank[next[ch]]) next[ch] = m;
  }
  return next;
}

export function shareGrid(rows: Mark[][], day: number, won: boolean): string {
  const emoji: Record<Mark, string> = { correct: '🟩', present: '🟪', absent: '⬛' };
  const head = `Daily Equation #${day} ${won ? rows.length : 'X'}/${ROWS}`;
  const body = rows.map((r) => r.map((m) => emoji[m]).join('')).join('\n');
  return `${head}\n${body}\ndaily-equation.correia95.workers.dev`;
}
