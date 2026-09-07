import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  answerFor,
  COLS,
  dayNumber,
  isValidEquation,
  mergeKeyboard,
  ROWS,
  score,
  shareGrid,
  type Mark,
  type Tile,
} from './game';

type Status = 'playing' | 'won' | 'lost';

interface Saved {
  day: number;
  guesses: string[];
  status: Status;
}

interface Stats {
  played: number;
  wins: number;
  streak: number;
  maxStreak: number;
  dist: number[]; // index 0..5 = solved in n+1
  lastDay: number;
}

const STATS_KEY = 'daily-equation.stats';
const gameKey = (d: number) => `daily-equation.game.${d}`;

const emptyStats: Stats = {
  played: 0,
  wins: 0,
  streak: 0,
  maxStreak: 0,
  dist: [0, 0, 0, 0, 0, 0],
  lastDay: 0,
};

function loadStats(): Stats {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (raw) return { ...emptyStats, ...JSON.parse(raw) };
  } catch {
    /* ignore */
  }
  return { ...emptyStats };
}

function loadGame(day: number): Saved {
  try {
    const raw = localStorage.getItem(gameKey(day));
    if (raw) {
      const s = JSON.parse(raw) as Saved;
      if (s.day === day && Array.isArray(s.guesses)) return s;
    }
  } catch {
    /* ignore */
  }
  return { day, guesses: [], status: 'playing' };
}

const KEY_ROWS: Tile[][] = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
  ['+', '-', '*', '/', '='],
];

export default function App() {
  const day = useMemo(() => dayNumber(), []);
  const answer = useMemo(() => answerFor(day), [day]);

  const [saved, setSaved] = useState<Saved>(() => loadGame(day));
  const [current, setCurrent] = useState('');
  const [stats, setStats] = useState<Stats>(loadStats);
  const [message, setMessage] = useState('');
  const [shake, setShake] = useState(false);
  const [revealRow, setRevealRow] = useState<number | null>(null);
  const [showStats, setShowStats] = useState(false);
  const [copied, setCopied] = useState(false);
  const msgTimer = useRef<number | undefined>(undefined);

  const status = saved.status;
  const guesses = saved.guesses;

  const marksFor = useCallback((g: string) => score(g, answer), [answer]);

  const keyboard = useMemo(() => {
    let kb: Record<string, Mark> = {};
    for (const g of guesses) kb = mergeKeyboard(kb, g, marksFor(g));
    return kb;
  }, [guesses, marksFor]);

  const flash = useCallback((text: string) => {
    setMessage(text);
    window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setMessage(''), 1800);
  }, []);

  const persist = useCallback((next: Saved) => {
    setSaved(next);
    try {
      localStorage.setItem(gameKey(next.day), JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }, []);

  const finish = useCallback(
    (won: boolean, rowCount: number) => {
      setStats((prev) => {
        // guard against double-counting the same day
        if (prev.lastDay === day) return prev;
        const contiguous = prev.lastDay === day - 1;
        const streak = won ? (contiguous ? prev.streak + 1 : 1) : 0;
        const dist = [...prev.dist];
        if (won) dist[rowCount - 1] += 1;
        const next: Stats = {
          played: prev.played + 1,
          wins: prev.wins + (won ? 1 : 0),
          streak,
          maxStreak: Math.max(prev.maxStreak, streak),
          dist,
          lastDay: day,
        };
        try {
          localStorage.setItem(STATS_KEY, JSON.stringify(next));
        } catch {
          /* ignore */
        }
        return next;
      });
      window.setTimeout(() => setShowStats(true), 1200);
    },
    [day],
  );

  const submit = useCallback(() => {
    if (status !== 'playing') return;
    if (current.length !== COLS) {
      setShake(true);
      flash(`Fill all ${COLS} tiles`);
      return;
    }
    const check = isValidEquation(current);
    if (!check.ok) {
      setShake(true);
      flash(check.reason || 'Not a valid equation');
      return;
    }
    const nextGuesses = [...guesses, current];
    const won = current === answer;
    const lost = !won && nextGuesses.length >= ROWS;
    const nextStatus: Status = won ? 'won' : lost ? 'lost' : 'playing';
    persist({ day, guesses: nextGuesses, status: nextStatus });
    setCurrent('');
    setRevealRow(nextGuesses.length - 1);
    window.setTimeout(() => setRevealRow(null), COLS * 220 + 400);
    if (won) {
      window.setTimeout(() => flash(['Genius!', 'Sharp!', 'Nice!', 'Solid.', 'Phew.', 'Got there!'][nextGuesses.length - 1]), COLS * 220);
      finish(true, nextGuesses.length);
    } else if (lost) {
      window.setTimeout(() => flash(answer), COLS * 220);
      finish(false, nextGuesses.length);
    }
  }, [answer, current, day, finish, flash, guesses, persist, status]);

  const onKey = useCallback(
    (k: string) => {
      if (status !== 'playing') return;
      if (k === 'Enter') {
        submit();
        return;
      }
      if (k === 'Backspace') {
        setCurrent((c) => c.slice(0, -1));
        return;
      }
      if ('0123456789+-*/='.includes(k) && k.length === 1) {
        setCurrent((c) => (c.length < COLS ? c + k : c));
      }
    },
    [status, submit],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace') {
        e.preventDefault();
        onKey(e.key);
      } else if (e.key.length === 1) {
        onKey(e.key);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onKey]);

  useEffect(() => {
    if (!shake) return;
    const t = window.setTimeout(() => setShake(false), 420);
    return () => window.clearTimeout(t);
  }, [shake]);

  // show stats automatically if the day is already done
  useEffect(() => {
    if (status !== 'playing' && guesses.length > 0) {
      const t = window.setTimeout(() => setShowStats(true), 400);
      return () => window.clearTimeout(t);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const doShare = async () => {
    const rows = guesses.map((g) => marksFor(g));
    const text = shareGrid(rows, day, status === 'won');
    try {
      if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1600);
      } catch {
        flash('Could not copy');
      }
    }
  };

  const winRate = stats.played ? Math.round((stats.wins / stats.played) * 100) : 0;
  const maxDist = Math.max(1, ...stats.dist);

  return (
    <div className="app">
      <header className="bar">
        <h1>Daily Equation</h1>
        <button className="icon" onClick={() => setShowStats(true)} aria-label="Statistics">
          📊
        </button>
      </header>
      <p className="sub">
        Puzzle #{day} · Guess the hidden equation in {ROWS} tries
      </p>

      <div className={`grid${shake ? ' shake' : ''}`} role="grid" aria-label="Guess grid">
        {Array.from({ length: ROWS }).map((_, r) => {
          const committed = guesses[r];
          const marks = committed ? marksFor(committed) : null;
          const text = committed ?? (r === guesses.length ? current : '');
          const isRevealing = revealRow === r;
          return (
            <div className="row" role="row" key={r}>
              {Array.from({ length: COLS }).map((_, c) => {
                const ch = text[c] ?? '';
                const mark = marks ? marks[c] : null;
                const cls = [
                  'cell',
                  ch ? 'filled' : '',
                  mark ? `m-${mark}` : '',
                  isRevealing ? 'reveal' : '',
                ]
                  .filter(Boolean)
                  .join(' ');
                return (
                  <div
                    className={cls}
                    style={isRevealing ? { animationDelay: `${c * 220}ms` } : undefined}
                    role="gridcell"
                    key={c}
                  >
                    {ch}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      <div className="msg" aria-live="polite">
        {message}
      </div>

      <div className="keyboard">
        {KEY_ROWS.map((kr, i) => (
          <div className="krow" key={i}>
            {i === 1 && (
              <button className="key wide" onClick={() => onKey('Enter')} aria-label="Enter">
                enter
              </button>
            )}
            {kr.map((k) => (
              <button
                key={k}
                className={`key${keyboard[k] ? ` m-${keyboard[k]}` : ''}`}
                onClick={() => onKey(k)}
              >
                {k === '*' ? '×' : k === '/' ? '÷' : k}
              </button>
            ))}
            {i === 1 && (
              <button className="key wide" onClick={() => onKey('Backspace')} aria-label="Delete">
                ⌫
              </button>
            )}
          </div>
        ))}
      </div>

      {showStats && (
        <div className="overlay" onClick={() => setShowStats(false)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button className="close" onClick={() => setShowStats(false)} aria-label="Close">
              ✕
            </button>
            <h2>Statistics</h2>
            <div className="numbers">
              <div>
                <strong>{stats.played}</strong>
                <span>Played</span>
              </div>
              <div>
                <strong>{winRate}</strong>
                <span>Win %</span>
              </div>
              <div>
                <strong>{stats.streak}</strong>
                <span>Streak</span>
              </div>
              <div>
                <strong>{stats.maxStreak}</strong>
                <span>Max streak</span>
              </div>
            </div>

            <h3>Guess distribution</h3>
            <div className="dist">
              {stats.dist.map((n, i) => {
                const isLast =
                  status === 'won' && guesses.length === i + 1 && stats.lastDay === day;
                return (
                  <div className="distrow" key={i}>
                    <span className="dn">{i + 1}</span>
                    <span
                      className={`dbar${isLast ? ' hot' : ''}`}
                      style={{ width: `${(n / maxDist) * 100}%` }}
                    >
                      {n}
                    </span>
                  </div>
                );
              })}
            </div>

            {status !== 'playing' && (
              <button className="share" onClick={doShare}>
                {copied ? 'Copied!' : status === 'won' ? 'Share result' : 'Share'}
              </button>
            )}
            <p className="next">A new equation drops at midnight.</p>
          </div>
        </div>
      )}

      <section className="explainer">
        <h2>How to play</h2>
        <p>
          Every day there is one hidden calculation — eight tiles made of the digits{' '}
          <code>0–9</code> and the symbols <code>+ − × ÷ =</code>. You have six guesses. Each guess
          has to be a calculation that is actually true, for example <code>12+34=46</code>.
        </p>
        <p>After each guess the tiles are coloured:</p>
        <ul>
          <li>
            <b>Green</b> — right symbol, right position.
          </li>
          <li>
            <b>Purple</b> — that symbol is in the equation, but somewhere else.
          </li>
          <li>
            <b>Dark</b> — that symbol is not in the equation at all.
          </li>
        </ul>
        <p>
          Standard order of operations applies: <code>×</code> and <code>÷</code> are worked out
          before <code>+</code> and <code>−</code>. Division is always exact (no remainders and no
          fractions), and there are no negative numbers. The number to the right of <code>=</code> is
          just the answer.
        </p>
        <h3>Tips</h3>
        <ul>
          <li>
            Open with a guess that uses several different symbols — something like{' '}
            <code>56-34=22</code> tests four digits, a minus and the equals in one go.
          </li>
          <li>Once you know where the = sign sits, the length of the answer is fixed.</li>
          <li>
            A purple <code>×</code> or <code>÷</code> is a strong clue — there are only a few places
            an operator can legally go.
          </li>
        </ul>
        <h3>Is it the same puzzle for everyone?</h3>
        <p>
          Yes. Everyone in the world gets the same equation on the same calendar day, so your score
          is comparable with friends. Puzzles are generated from the date and run entirely in your
          browser — nothing is uploaded, and your streak is stored only on this device.
        </p>
        <footer>Made in Australia · new puzzle daily · no sign-up, no tracking</footer>
      </section>
    </div>
  );
}
