# daily-equation

Daily Equation — a maths guessing game. Guess the hidden 8-tile arithmetic equation
(for example `12+34=46`) in six tries. One puzzle per day, the same for everyone,
generated from the calendar date. Client-side only, no sign-up, streak stored in
`localStorage`.

**Live:** https://daily-equation.correia95.workers.dev/

## Stack

- React 18 + TypeScript + Vite, no runtime deps beyond React
- Static-assets Cloudflare Worker

## Engine

[`src/game.ts`](src/game.ts):

- `dayNumber()` — days since the 2026-09-07 epoch (puzzle #1).
- `answerFor(day)` — deterministic equation from a seeded mulberry32 RNG: builds a
  one- or two-operator left-hand side, evaluates it with correct precedence
  (`evalExpr`), and keeps the first candidate that is exactly 8 tiles, non-negative,
  integer-only and free of trivial pieces (`+0`, `×1`, …). Hard-coded fallback list
  if generation somehow fails.
- `isValidEquation(guess)` — a guess must be 8 tiles, contain exactly one `=`, have a
  plain number on the right, and be arithmetically true.
- `score(guess, answer)` — Wordle-style two-pass marking with duplicate handling
  (`correct` / `present` / `absent`).

Verified in Node: 500 consecutive days all produce valid 8-tile equations, 473
distinct.

## Develop / deploy

```bash
npm install
npm run dev
npm run deploy
```
