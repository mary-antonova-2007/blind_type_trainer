import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

type LayoutId = "en-US" | "ru-RU";
type GameMode = "campaign" | "practice" | "sprint" | "accuracy" | "challenge" | "endless";
type FingerId =
  | "service"
  | "left-pinky"
  | "left-ring"
  | "left-middle"
  | "left-index"
  | "thumbs"
  | "right-index"
  | "right-middle"
  | "right-ring"
  | "right-pinky";
type KeyRow = "number" | "top" | "home" | "bottom" | "space";
type GameStatus = "idle" | "running" | "paused" | "won" | "lost";
type PulseKind = "success" | "fail";
type ChallengeViewMode = "stream" | "line";

type KeyDefinition = {
  code: string;
  en: string;
  ru: string;
  enShift?: string;
  ruShift?: string;
  row: KeyRow;
  finger: FingerId;
  home?: boolean;
  label?: string;
  side?: "left" | "right";
};

type LevelConfig = {
  id: number;
  label: string;
  keySet: string[];
  speed: number;
  errorLimit: number;
  waveLength: number;
  lessonLineCount?: number;
};

type SessionStats = {
  score: number;
  typed: number;
  correct: number;
  errors: number;
  streak: number;
  bestStreak: number;
  startedAt: number;
  endedAt?: number;
  completed: boolean;
};

type ChallengeLine = {
  text: string;
  start: number;
};

type ChallengeError = {
  index: number;
  word: string;
  expected: string;
  typed: string;
};

type ChallengeErrorDrill = {
  id: string;
  wordLines: string[];
  symbolLine: string;
  words: string[];
  expected: string;
  typed: string;
  count: number;
};

type SavedProgress = {
  layout: LayoutId;
  mode: GameMode;
  speedLevel: number;
  unlocked: Record<LayoutId, number>;
  best: Record<string, number>;
  history: Array<{ date: string; layout: LayoutId; mode: GameMode; level: number; score: number; accuracy: number; wpm: number }>;
};

const STORAGE_KEY = "typing-arcade-progress-v1";
const ENDLESS_START_X = 260;
const ENDLESS_SYMBOL_STEP = 72;
const ENDLESS_PIXEL_SPEED = 24;
const ENDLESS_CATCHUP_LIMIT = 2.4;

const fingerLabels: Record<FingerId, string> = {
  service: "Служебная клавиша",
  "left-pinky": "Левый мизинец",
  "left-ring": "Левый безымянный",
  "left-middle": "Левый средний",
  "left-index": "Левый указательный",
  thumbs: "Большие пальцы",
  "right-index": "Правый указательный",
  "right-middle": "Правый средний",
  "right-ring": "Правый безымянный",
  "right-pinky": "Правый мизинец",
};

const fingerColors: Record<FingerId, string> = {
  service: "#9aa8ad",
  "left-pinky": "#e8557d",
  "left-ring": "#f08a45",
  "left-middle": "#e2b84d",
  "left-index": "#84b94e",
  thumbs: "#36b7a7",
  "right-index": "#3ca8dc",
  "right-middle": "#6f8ff0",
  "right-ring": "#a579e8",
  "right-pinky": "#d968bf",
};

const keyboardRows: KeyDefinition[][] = [
  [
    { code: "Backquote", en: "`", enShift: "~", ru: "ё", ruShift: "Ё", row: "number", finger: "left-pinky" },
    { code: "Digit1", en: "1", enShift: "!", ru: "1", ruShift: "!", row: "number", finger: "left-pinky" },
    { code: "Digit2", en: "2", enShift: "@", ru: "2", ruShift: '"', row: "number", finger: "left-ring" },
    { code: "Digit3", en: "3", enShift: "#", ru: "3", ruShift: "№", row: "number", finger: "left-middle" },
    { code: "Digit4", en: "4", enShift: "$", ru: "4", ruShift: ";", row: "number", finger: "left-index" },
    { code: "Digit5", en: "5", enShift: "%", ru: "5", ruShift: "%", row: "number", finger: "left-index" },
    { code: "Digit6", en: "6", enShift: "^", ru: "6", ruShift: ":", row: "number", finger: "right-index" },
    { code: "Digit7", en: "7", enShift: "&", ru: "7", ruShift: "?", row: "number", finger: "right-index" },
    { code: "Digit8", en: "8", enShift: "*", ru: "8", ruShift: "*", row: "number", finger: "right-middle" },
    { code: "Digit9", en: "9", enShift: "(", ru: "9", ruShift: "(", row: "number", finger: "right-ring" },
    { code: "Digit0", en: "0", enShift: ")", ru: "0", ruShift: ")", row: "number", finger: "right-pinky" },
    { code: "Minus", en: "-", enShift: "_", ru: "-", ruShift: "_", row: "number", finger: "right-pinky" },
    { code: "Equal", en: "=", enShift: "+", ru: "=", ruShift: "+", row: "number", finger: "right-pinky" },
  ],
  [
    { code: "KeyQ", en: "q", enShift: "Q", ru: "й", ruShift: "Й", row: "top", finger: "left-pinky" },
    { code: "KeyW", en: "w", enShift: "W", ru: "ц", ruShift: "Ц", row: "top", finger: "left-ring" },
    { code: "KeyE", en: "e", enShift: "E", ru: "у", ruShift: "У", row: "top", finger: "left-middle" },
    { code: "KeyR", en: "r", enShift: "R", ru: "к", ruShift: "К", row: "top", finger: "left-index" },
    { code: "KeyT", en: "t", enShift: "T", ru: "е", ruShift: "Е", row: "top", finger: "left-index" },
    { code: "KeyY", en: "y", enShift: "Y", ru: "н", ruShift: "Н", row: "top", finger: "right-index" },
    { code: "KeyU", en: "u", enShift: "U", ru: "г", ruShift: "Г", row: "top", finger: "right-index" },
    { code: "KeyI", en: "i", enShift: "I", ru: "ш", ruShift: "Ш", row: "top", finger: "right-middle" },
    { code: "KeyO", en: "o", enShift: "O", ru: "щ", ruShift: "Щ", row: "top", finger: "right-ring" },
    { code: "KeyP", en: "p", enShift: "P", ru: "з", ruShift: "З", row: "top", finger: "right-pinky" },
    { code: "BracketLeft", en: "[", enShift: "{", ru: "х", ruShift: "Х", row: "top", finger: "right-pinky" },
    { code: "BracketRight", en: "]", enShift: "}", ru: "ъ", ruShift: "Ъ", row: "top", finger: "right-pinky" },
    { code: "Enter", en: "\n", ru: "\n", row: "top", finger: "service", label: "Enter" },
  ],
  [
    { code: "KeyA", en: "a", enShift: "A", ru: "ф", ruShift: "Ф", row: "home", finger: "left-pinky", home: true },
    { code: "KeyS", en: "s", enShift: "S", ru: "ы", ruShift: "Ы", row: "home", finger: "left-ring", home: true },
    { code: "KeyD", en: "d", enShift: "D", ru: "в", ruShift: "В", row: "home", finger: "left-middle", home: true },
    { code: "KeyF", en: "f", enShift: "F", ru: "а", ruShift: "А", row: "home", finger: "left-index", home: true },
    { code: "KeyG", en: "g", enShift: "G", ru: "п", ruShift: "П", row: "home", finger: "left-index" },
    { code: "KeyH", en: "h", enShift: "H", ru: "р", ruShift: "Р", row: "home", finger: "right-index" },
    { code: "KeyJ", en: "j", enShift: "J", ru: "о", ruShift: "О", row: "home", finger: "right-index", home: true },
    { code: "KeyK", en: "k", enShift: "K", ru: "л", ruShift: "Л", row: "home", finger: "right-middle", home: true },
    { code: "KeyL", en: "l", enShift: "L", ru: "д", ruShift: "Д", row: "home", finger: "right-ring", home: true },
    { code: "Semicolon", en: ";", enShift: ":", ru: "ж", ruShift: "Ж", row: "home", finger: "right-pinky", home: true },
    { code: "Quote", en: "'", enShift: '"', ru: "э", ruShift: "Э", row: "home", finger: "right-pinky" },
  ],
  [
    { code: "ShiftLeft", en: "", ru: "", row: "bottom", finger: "service", label: "Shift", side: "left" },
    { code: "KeyZ", en: "z", enShift: "Z", ru: "я", ruShift: "Я", row: "bottom", finger: "left-pinky" },
    { code: "KeyX", en: "x", enShift: "X", ru: "ч", ruShift: "Ч", row: "bottom", finger: "left-ring" },
    { code: "KeyC", en: "c", enShift: "C", ru: "с", ruShift: "С", row: "bottom", finger: "left-middle" },
    { code: "KeyV", en: "v", enShift: "V", ru: "м", ruShift: "М", row: "bottom", finger: "left-index" },
    { code: "KeyB", en: "b", enShift: "B", ru: "и", ruShift: "И", row: "bottom", finger: "left-index" },
    { code: "KeyN", en: "n", enShift: "N", ru: "т", ruShift: "Т", row: "bottom", finger: "right-index" },
    { code: "KeyM", en: "m", enShift: "M", ru: "ь", ruShift: "Ь", row: "bottom", finger: "right-index" },
    { code: "Comma", en: ",", enShift: "<", ru: "б", ruShift: "Б", row: "bottom", finger: "right-middle" },
    { code: "Period", en: ".", enShift: ">", ru: "ю", ruShift: "Ю", row: "bottom", finger: "right-ring" },
    { code: "Slash", en: "/", enShift: "?", ru: ".", ruShift: ",", row: "bottom", finger: "right-pinky" },
    { code: "ShiftRight", en: "", ru: "", row: "bottom", finger: "service", label: "Shift", side: "right" },
  ],
  [
    { code: "SpaceLeft", en: " ", ru: " ", row: "space", finger: "thumbs", label: "Space", side: "left", home: true },
    { code: "SpaceRight", en: " ", ru: " ", row: "space", finger: "thumbs", label: "Space", side: "right", home: true },
  ],
];

const modes: Array<{ id: GameMode; label: string; description: string }> = [
  { id: "campaign", label: "Кампания", description: "Открывай клавиши по порядку" },
  { id: "practice", label: "Практика", description: "Без строгого провала" },
  { id: "sprint", label: "Спринт", description: "60 секунд с ускорением" },
  { id: "accuracy", label: "Точность", description: "Меньше права на ошибку" },
  { id: "challenge", label: "Challenge", description: "Любой текст целиком" },
  { id: "endless", label: "Endless", description: "Фан-поток без строгого финиша" },
];

const defaultProgress: SavedProgress = {
  layout: "en-US",
  mode: "campaign",
  speedLevel: 3,
  unlocked: { "en-US": 1, "ru-RU": 1 },
  best: {},
  history: [],
};

function symbolForKey(key: KeyDefinition, layout: LayoutId) {
  return layout === "en-US" ? key.en : key.ru;
}

function shiftedSymbolForKey(key: KeyDefinition, layout: LayoutId) {
  return layout === "en-US" ? key.enShift : key.ruShift;
}

function getAllKeys() {
  return keyboardRows.flat();
}

function isServiceKey(key: KeyDefinition) {
  return key.finger === "service";
}

function handForFinger(finger: FingerId) {
  if (finger.startsWith("left")) return "left";
  if (finger.startsWith("right")) return "right";
  return undefined;
}

function keySymbols(key: KeyDefinition, layout: LayoutId) {
  return [symbolForKey(key, layout), shiftedSymbolForKey(key, layout)].filter((symbol): symbol is string => Boolean(symbol));
}

function findKeyForSymbol(symbol: string, layout: LayoutId) {
  if (symbol === " ") return getAllKeys().find((key) => key.row === "space");
  return getAllKeys().find((key) => !isServiceKey(key) && keySymbols(key, layout).some((keySymbol) => keySymbol.toLowerCase() === symbol.toLowerCase()));
}

function isShiftSymbol(symbol: string, layout: LayoutId) {
  return getAllKeys().some((key) => shiftedSymbolForKey(key, layout) === symbol);
}

function requiredShiftSide(symbol: string, layout: LayoutId) {
  if (!isShiftSymbol(symbol, layout)) return undefined;
  const key = findKeyForSymbol(symbol, layout);
  const hand = key ? handForFinger(key.finger) : undefined;
  return hand === "left" ? "right" : hand === "right" ? "left" : undefined;
}

function requiredSpaceSide(previousSymbol: string, layout: LayoutId) {
  const previousKey = findKeyForSymbol(previousSymbol, layout);
  const hand = previousKey ? handForFinger(previousKey.finger) : undefined;
  return hand === "left" ? "right" : hand === "right" ? "left" : undefined;
}

function keysByFingers(layout: LayoutId, fingers: FingerId[], rows?: KeyRow[]) {
  return getAllKeys()
    .filter((key) => !isServiceKey(key) && fingers.includes(key.finger) && (!rows || rows.includes(key.row)))
    .map((key) => symbolForKey(key, layout))
    .filter((symbol) => symbol.trim().length > 0);
}

function getHomeKeys(layout: LayoutId) {
  return getAllKeys()
    .filter((key) => !isServiceKey(key) && key.row === "home")
    .map((key) => symbolForKey(key, layout))
    .filter((symbol) => symbol !== "'");
}

function unique(values: string[]) {
  return Array.from(new Set(values));
}

const campaignRows: KeyRow[] = ["home", "top", "bottom"];
const practiceFingerGroups: Array<{ label: string; fingers: FingerId[]; onlyHome?: boolean; extras?: "index" | "index-right-pinky" | "all" }> = [
  { label: "указательные", fingers: ["left-index", "right-index"], onlyHome: true },
  { label: "средние", fingers: ["left-middle", "right-middle"], onlyHome: true },
  { label: "указательные + средние", fingers: ["left-index", "right-index", "left-middle", "right-middle"], onlyHome: true },
  { label: "безымянные", fingers: ["left-ring", "right-ring"], onlyHome: true },
  { label: "безымянные + указательные + средние", fingers: ["left-ring", "right-ring", "left-index", "right-index", "left-middle", "right-middle"], onlyHome: true },
  { label: "мизинцы", fingers: ["left-pinky", "right-pinky"], onlyHome: true },
  { label: "все пальцы", fingers: ["left-pinky", "left-ring", "left-middle", "left-index", "right-index", "right-middle", "right-ring", "right-pinky"], onlyHome: true },
  { label: "дальние для указательных", fingers: ["left-index", "right-index"], extras: "index" },
  { label: "дальние для указательных + правый мизинец", fingers: ["left-index", "right-index", "right-pinky"], extras: "index-right-pinky" },
  { label: "вся строка", fingers: ["left-pinky", "left-ring", "left-middle", "left-index", "right-index", "right-middle", "right-ring", "right-pinky"], extras: "all" },
];

function rowLabel(row: KeyRow) {
  if (row === "home") return "Средняя строка";
  if (row === "top") return "Верхняя строка";
  if (row === "bottom") return "Нижняя строка";
  return "Пробел";
}

function keysForLessonStep(layout: LayoutId, row: KeyRow, step: (typeof practiceFingerGroups)[number]) {
  const rowKeys = getAllKeys().filter((key) => !isServiceKey(key) && key.row === row && step.fingers.includes(key.finger));
  const baseKeys =
    row === "home" && step.onlyHome
      ? rowKeys.filter((key) => key.home)
      : row === "home" && step.extras === "index"
        ? rowKeys.filter((key) => key.finger === "left-index" || key.finger === "right-index").filter((key) => !key.home)
        : row === "home" && step.extras === "index-right-pinky"
          ? rowKeys.filter((key) => key.finger === "left-index" || key.finger === "right-index" || (key.finger === "right-pinky" && !key.home))
          : rowKeys;

  const symbols = unique(baseKeys.map((key) => symbolForKey(key, layout)).filter((symbol) => symbol.trim().length > 0));
  if (symbols.length > 0) return symbols;

  return unique(rowKeys.map((key) => symbolForKey(key, layout)).filter((symbol) => symbol.trim().length > 0));
}

function randomItem<T>(values: T[]) {
  return values[Math.floor(Math.random() * values.length)];
}

function shuffle<T>(values: T[]) {
  const next = [...values];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function lessonBlock(symbols: string[]) {
  const length = 1 + Math.floor(Math.random() * 4);
  const bag = symbols.length >= length ? shuffle(symbols) : Array.from({ length }, (_, index) => shuffle(symbols)[index % symbols.length]);
  return bag.slice(0, length).join("");
}

function buildLessonText(symbols: string[], lineCount: number) {
  const lines: string[] = [];

  for (let lineIndex = 0; lineIndex < lineCount; lineIndex += 1) {
    const blockCount = 8 + Math.floor(Math.random() * 4);
    const blocks = Array.from({ length: blockCount }, () => lessonBlock(symbols));
    lines.push(blocks.join(" "));
  }

  return lines.join("\n");
}

function makeCampaignLessons(layout: LayoutId) {
  const lessons = campaignRows.flatMap((row, rowIndex) => {
    const seenKeySets = new Set<string>();
    const steps = practiceFingerGroups.flatMap((step, stepIndex) => {
      const keySet = keysForLessonStep(layout, row, step);
      const signature = keySet.join("");
      if (seenKeySets.has(signature)) return [];
      seenKeySets.add(signature);
      return [
        {
          id: rowIndex * (practiceFingerGroups.length + 1) + stepIndex + 1,
          label: `${rowLabel(row)} · ${step.label}`,
          keySet,
          speed: 2.8 + rowIndex * 0.35 + stepIndex * 0.08,
          errorLimit: 2,
          waveLength: 0,
          lessonLineCount: 10,
        },
      ];
    });

    const fullRow = unique(getAllKeys().filter((key) => !isServiceKey(key) && key.row === row).map((key) => symbolForKey(key, layout)).filter((symbol) => symbol.trim().length > 0));
    return [
      ...steps,
      {
        id: rowIndex * (practiceFingerGroups.length + 1) + practiceFingerGroups.length + 1,
        label: `${rowLabel(row)} · финал без ошибок`,
        keySet: fullRow,
        speed: 3.1 + rowIndex * 0.35,
        errorLimit: 0,
        waveLength: 0,
        lessonLineCount: 20,
      },
    ];
  });

  return lessons.map((lesson, index) => ({ ...lesson, id: index + 1 }));
}

function campaignLevelCount(layout: LayoutId) {
  return makeCampaignLessons(layout).length;
}

function makeLevel(layout: LayoutId, id: number): LevelConfig {
  const campaignLesson = makeCampaignLessons(layout)[id - 1];
  if (campaignLesson) return campaignLesson;

  const stage = Math.ceil(id / 3);
  const baseHome = getHomeKeys(layout);
  const indexKeys = keysByFingers(layout, ["left-index", "right-index"]);
  const middleKeys = keysByFingers(layout, ["left-middle", "right-middle"]);
  const ringKeys = keysByFingers(layout, ["left-ring", "right-ring"]);
  const pinkyKeys = keysByFingers(layout, ["left-pinky", "right-pinky"]);
  const keySet = unique(
    stage === 1
      ? baseHome
      : stage === 2
        ? [...baseHome, ...indexKeys]
        : stage === 3
          ? [...baseHome, ...indexKeys, ...middleKeys]
          : stage === 4
            ? [...baseHome, ...indexKeys, ...middleKeys, ...ringKeys]
            : [...baseHome, ...indexKeys, ...middleKeys, ...ringKeys, ...pinkyKeys],
  );

  return {
    id,
    label: `Уровень ${id}`,
    keySet,
    speed: 3.6 + id * 0.55,
    errorLimit: Math.max(2, 9 - Math.floor(id / 2)),
    waveLength: 18 + id * 3,
  };
}

function modeLevel(base: LevelConfig, mode: GameMode): LevelConfig {
  if (mode === "practice") return { ...base, errorLimit: 999, speed: Math.max(2.4, base.speed - 1.4), waveLength: 32 };
  if (mode === "sprint") return { ...base, speed: base.speed + 2.8, waveLength: 80, errorLimit: Math.max(4, base.errorLimit) };
  if (mode === "accuracy") return { ...base, speed: Math.max(2.2, base.speed - 0.8), errorLimit: Math.max(1, Math.floor(base.errorLimit / 2)), waveLength: base.waveLength + 8 };
  if (mode === "challenge") return { ...base, label: "Challenge", errorLimit: 999, speed: Math.max(2.5, base.speed - 0.6), waveLength: 0 };
  if (mode === "endless") return { ...base, label: "Endless", errorLimit: 999, speed: base.speed + 1.4, waveLength: 140 };
  return base;
}

function makeWave(keySet: string[], length: number) {
  const wave: string[] = [];
  while (wave.length < length) {
    wave.push(...Array.from(buildLessonText(keySet, 1)), "\n");
  }
  return wave.slice(0, length);
}

function loadProgress(): SavedProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultProgress;
    return { ...defaultProgress, ...JSON.parse(raw) };
  } catch {
    return defaultProgress;
  }
}

function saveProgress(progress: SavedProgress) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
}

function formatPercent(value: number) {
  return `${Math.round(value)}%`;
}

function getAccuracy(stats: SessionStats) {
  return stats.typed === 0 ? 100 : (stats.correct / stats.typed) * 100;
}

function getWpm(stats: SessionStats, now = performance.now()) {
  const minutes = Math.max(((stats.endedAt ?? now) - stats.startedAt) / 60000, 1 / 60);
  return Math.round(stats.correct / 5 / minutes);
}

function getElapsedSeconds(stats: SessionStats, now = performance.now()) {
  return Math.max(0, ((stats.endedAt ?? now) - stats.startedAt) / 1000);
}

function getCpm(stats: SessionStats, now = performance.now()) {
  const minutes = Math.max(getElapsedSeconds(stats, now) / 60, 1 / 60);
  return Math.round(stats.correct / minutes);
}

function isWordChar(char: string) {
  return /[\p{L}\p{N}-]/u.test(char);
}

function extractWordAt(text: string, index: number) {
  if (!text[index] || !isWordChar(text[index])) return "";
  let start = index;
  let end = index + 1;
  while (start > 0 && isWordChar(text[start - 1])) start -= 1;
  while (end < text.length && isWordChar(text[end])) end += 1;
  return text.slice(start, end);
}

function formatDrillChar(char: string) {
  if (char === "") return "пропуск";
  return streamChar(char);
}

function buildWordDrillLine(words: string[]) {
  return Array.from({ length: 6 }, (_, index) => words[index % words.length]).join(" ");
}

function isSpacingChar(char: string) {
  return char === " " || char === "\n" || char === "\t";
}

function buildChallengeErrorDrills(errors: ChallengeError[]) {
  const groups = new Map<string, ChallengeErrorDrill>();

  errors.forEach((error) => {
    if (isSpacingChar(error.expected) || isSpacingChar(error.typed)) return;

    const word = error.word || formatDrillChar(error.expected);
    const id = `${error.expected}\u0000${error.typed}`;
    const current = groups.get(id);
    if (current) {
      const words = current.words.includes(word) ? current.words : [...current.words, word];
      const count = current.count + 1;
      groups.set(id, { ...current, words, count, wordLines: Array.from({ length: Math.min(count, 4) }, () => buildWordDrillLine(words)) });
      return;
    }

    const pair = error.expected === error.typed ? [formatDrillChar(error.expected)] : [formatDrillChar(error.expected), formatDrillChar(error.typed)];
    const symbolLine = Array.from({ length: 8 }, (_, index) => pair[index % pair.length]).join(" ");

    groups.set(id, {
      id,
      words: [word],
      expected: error.expected,
      typed: error.typed,
      count: 1,
      wordLines: [buildWordDrillLine([word])],
      symbolLine,
    });
  });

  return Array.from(groups.values())
    .sort((a, b) => b.count - a.count || a.words[0].localeCompare(b.words[0]))
    .slice(0, 5);
}

function buildMistakePracticeText(drills: ChallengeErrorDrill[]) {
  return drills.flatMap((drill) => [...drill.wordLines, drill.symbolLine]).join("\n");
}

function keyForSymbol(symbol: string, layout: LayoutId) {
  return findKeyForSymbol(symbol, layout);
}

function newStats(): SessionStats {
  return { score: 0, typed: 0, correct: 0, errors: 0, streak: 0, bestStreak: 0, startedAt: performance.now(), completed: false };
}

function speedMultiplier(speedLevel: number) {
  return 0.45 + speedLevel * 0.17;
}

function scoreForHit(streak: number, effectiveSpeed: number) {
  const speedBonus = 0.75 + effectiveSpeed / 10;
  const streakBonus = Math.min(20, streak) * 8;
  return Math.round((70 + streakBonus) * speedBonus);
}

function streamChar(symbol: string) {
  if (symbol === " ") return "␠";
  if (symbol === "\n") return "↵";
  if (symbol === "\t") return "⇥";
  return symbol;
}

function normalizeInputKey(key: string) {
  if (key === "Enter") return "\n";
  if (key === "Tab") return "\t";
  if (key === "Spacebar") return " ";
  return key;
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "TEXTAREA" || target.tagName === "INPUT" || target.isContentEditable;
}

function challengeCpm(speedLevel: number) {
  return 40 + speedLevel * 24;
}

function stripDiacritics(text: string) {
  return text
    .replace(/ё/g, "е")
    .replace(/Ё/g, "Е")
    .replace(/Й/g, "__RU_SHORT_I_UPPER__")
    .replace(/й/g, "__RU_SHORT_I_LOWER__")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/__RU_SHORT_I_UPPER__/g, "Й")
    .replace(/__RU_SHORT_I_LOWER__/g, "й");
}

function normalizeChallengeText(text: string, layout: LayoutId) {
  const normalized = stripDiacritics(text).replace(/[«»]/g, '"').replace(/—/g, "-");
  if (layout !== "ru-RU") return normalized;

  const allowedSymbols = new Set(getAllKeys().flatMap((key) => keySymbols(key, layout)).filter((symbol) => symbol.trim().length > 0));
  const chars: string[] = [];

  Array.from(normalized).forEach((char) => {
    const lower = char.toLowerCase();
    if (char === " " || char === "\n" || allowedSymbols.has(char) || allowedSymbols.has(lower)) {
      chars.push(char);
    }
  });

  return chars
    .join("")
    .replace(/ +/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .join("\n");
}

function formatDuration(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return minutes > 0 ? `${minutes} мин ${rest.toString().padStart(2, "0")} сек` : `${rest} сек`;
}

function buildLineChallenge(text: string, maxLineLength = 54) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const sourceLines = normalized.split("\n");
  const lines: string[] = [];

  sourceLines.forEach((sourceLine, sourceIndex) => {
    const words = sourceLine.split(" ");
    let line = "";

    words.forEach((word, wordIndex) => {
      const prefix = wordIndex === 0 ? "" : " ";
      const candidate = `${line}${prefix}${word}`;
      if (line && candidate.length > maxLineLength) {
        lines.push(line);
        line = wordIndex === 0 ? word : word.trimStart();
      } else {
        line = candidate;
      }

      while (line.length > maxLineLength) {
        lines.push(line.slice(0, maxLineLength));
        line = line.slice(maxLineLength);
      }
    });

    lines.push(line);
    if (sourceIndex < sourceLines.length - 1 && sourceLine === "") lines.push("");
  });

  const displayLines: ChallengeLine[] = [];
  const sequence: string[] = [];

  lines.forEach((line, index) => {
    displayLines.push({ text: line, start: sequence.length });
    sequence.push(...Array.from(line));
    if (index < lines.length - 1) sequence.push("\n");
  });

  return { lines: displayLines, sequence };
}

declare global {
  interface Window {
    render_game_to_text?: () => string;
    advanceTime?: (ms: number) => void;
  }
}

export function App() {
  const [progress, setProgress] = useState<SavedProgress>(() => loadProgress());
  const [layout, setLayout] = useState<LayoutId>(() => loadProgress().layout);
  const [mode, setMode] = useState<GameMode>(() => loadProgress().mode);
  const [speedLevel, setSpeedLevel] = useState(() => loadProgress().speedLevel ?? defaultProgress.speedLevel);
  const [challengeText, setChallengeText] = useState("Hello, world!\nПривет, мир!\n12345 — typing challenge.");
  const [challengeView, setChallengeView] = useState<ChallengeViewMode>("line");
  const [levelId, setLevelId] = useState(1);
  const [status, setStatus] = useState<GameStatus>("idle");
  const [stats, setStats] = useState<SessionStats>(() => newStats());
  const [queue, setQueue] = useState<string[]>([]);
  const [sessionText, setSessionText] = useState("");
  const [headX, setHeadX] = useState(0);
  const [pulse, setPulse] = useState<{ symbol: string; kind: PulseKind; id: number } | null>(null);
  const [burst, setBurst] = useState<{ symbol: string; id: number; x: number } | null>(null);
  const [lastCorrectSymbol, setLastCorrectSymbol] = useState("");
  const [message, setMessage] = useState("Выбери режим и начни волну");
  const [clockNow, setClockNow] = useState(() => performance.now());
  const [challengeErrors, setChallengeErrors] = useState<ChallengeError[]>([]);
  const statusRef = useRef(status);
  const levelRef = useRef<LevelConfig | null>(null);
  const queueRef = useRef<string[]>([]);
  const headXRef = useRef(0);
  const statsRef = useRef(stats);
  const modeRef = useRef(mode);
  const effectiveSpeedRef = useRef(0);
  const endlessCatchupRef = useRef(1);
  const challengeViewRef = useRef(challengeView);
  const challengeErrorsRef = useRef<ChallengeError[]>([]);

  const unlocked = progress.unlocked[layout] ?? 1;
  const baseLevel = useMemo(() => makeLevel(layout, levelId), [layout, levelId]);
  const activeLevel = useMemo(() => modeLevel(baseLevel, mode), [baseLevel, mode]);
  const effectiveSpeed = useMemo(() => activeLevel.speed * speedMultiplier(speedLevel), [activeLevel.speed, speedLevel]);
  const normalizedChallengeText = useMemo(() => normalizeChallengeText(challengeText, layout), [challengeText, layout]);
  const lineChallenge = useMemo(() => buildLineChallenge(normalizedChallengeText), [normalizedChallengeText]);
  const challengeQueue = useMemo(() => lineChallenge.sequence, [lineChallenge.sequence]);
  const challengeCpmValue = challengeCpm(speedLevel);
  const challengeEstimateSeconds = challengeQueue.length > 0 ? (challengeQueue.length / challengeCpmValue) * 60 : 0;
  const isChallenge = mode === "challenge";
  const isFlowMode = mode === "endless";
  const campaignLevels = useMemo(() => campaignLevelCount(layout), [layout]);
  const sessionLines = useMemo(() => buildLineChallenge(sessionText), [sessionText]);
  const keyboardSymbols = useMemo(() => new Set(Array.from(sessionText || queue.join("")).map((symbol) => symbol.toLowerCase())), [queue, sessionText]);
  const previousSymbol = sessionText[stats.correct - 1] ?? lastCorrectSymbol;
  const target = queue[0] ?? "";
  const targetKey = target ? keyForSymbol(target, layout) : undefined;
  const bestKey = `${layout}:${mode}:${levelId}`;
  const bestScore = progress.best[bestKey] ?? 0;
  const challengeErrorDrills = useMemo(() => buildChallengeErrorDrills(challengeErrors), [challengeErrors]);

  useEffect(() => {
    statusRef.current = status;
    queueRef.current = queue;
    headXRef.current = headX;
    statsRef.current = stats;
    modeRef.current = mode;
    levelRef.current = activeLevel;
    effectiveSpeedRef.current = effectiveSpeed;
    challengeViewRef.current = challengeView;
  }, [activeLevel, challengeView, effectiveSpeed, headX, mode, queue, stats, status]);

  useEffect(() => {
    saveProgress({ ...progress, layout, mode, speedLevel });
  }, [layout, mode, progress, speedLevel]);

  const finish = useCallback(
    (result: "won" | "lost", finalStats = statsRef.current) => {
      const endedAt = performance.now();
      const completed = result === "won";
      const finishedStats = { ...finalStats, endedAt, completed };
      const accuracy = getAccuracy(finalStats);
      const wpm = getWpm(finishedStats);
      const score = finalStats.score;
      setStatus(result);
      statsRef.current = finishedStats;
      setStats(finishedStats);
      setClockNow(endedAt);
      setMessage(completed ? "Волна очищена. Отличная работа." : "Лимит ошибок исчерпан. Перезапусти волну.");
      setProgress((current) => {
        const nextUnlocked =
          completed && modeRef.current === "campaign"
            ? Math.min(campaignLevels, Math.max(current.unlocked[layout] ?? 1, levelId + 1))
            : current.unlocked[layout] ?? 1;
        const nextBest = Math.max(current.best[bestKey] ?? 0, score);
        const historyItem = { date: new Date().toISOString(), layout, mode: modeRef.current, level: levelId, score, accuracy, wpm };
        const next = {
          ...current,
          unlocked: { ...current.unlocked, [layout]: nextUnlocked },
          best: { ...current.best, [bestKey]: nextBest },
          history: [historyItem, ...current.history].slice(0, 12),
        };
        saveProgress(next);
        return next;
      });
    },
    [bestKey, campaignLevels, layout, levelId],
  );

  const step = useCallback(
    (deltaMs: number) => {
      if (statusRef.current !== "running" || !levelRef.current) return;
      if (modeRef.current !== "endless") return;
      const catchupNeed = Math.max(0, (headXRef.current - ENDLESS_START_X) / ENDLESS_SYMBOL_STEP);
      const targetCatchup = Math.min(ENDLESS_CATCHUP_LIMIT, 1 + catchupNeed * 0.55);
      endlessCatchupRef.current += (targetCatchup - endlessCatchupRef.current) * Math.min(1, deltaMs / 420);
      const nextX = headXRef.current - ((effectiveSpeedRef.current * ENDLESS_PIXEL_SPEED * endlessCatchupRef.current) * deltaMs) / 1000;
      headXRef.current = nextX;
      setHeadX(nextX);
      if (nextX < -ENDLESS_SYMBOL_STEP) {
        const current = queueRef.current[0];
        if (!current) return;
        const nextQueue = queueRef.current.slice(1);
        const nextStats = {
          ...statsRef.current,
          typed: statsRef.current.typed + 1,
          errors: statsRef.current.errors + 1,
          streak: 0,
        };
        queueRef.current = nextQueue;
        statsRef.current = nextStats;
        const recoveredX = nextX + ENDLESS_SYMBOL_STEP;
        headXRef.current = recoveredX;
        setQueue(nextQueue);
        setStats(nextStats);
        setHeadX(recoveredX);
        setPulse({ symbol: current, kind: "fail", id: Date.now() });
        if (nextStats.errors > levelRef.current.errorLimit) finish("lost", nextStats);
        else if (nextQueue.length === 0) {
          const refill = makeWave(levelRef.current.keySet, levelRef.current.waveLength);
          queueRef.current = refill;
          setQueue(refill);
        }
      }
    },
    [finish],
  );

  useEffect(() => {
    let frame = 0;
    let last = performance.now();
    const tick = (now: number) => {
      step(Math.min(now - last, 80));
      last = now;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [step]);

  useEffect(() => {
    if (status !== "running") return;
    const timer = window.setInterval(() => setClockNow(performance.now()), 500);
    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    window.advanceTime = (ms: number) => {
      const slices = Math.max(1, Math.round(ms / 16.67));
      for (let i = 0; i < slices; i += 1) step(ms / slices);
    };
    window.render_game_to_text = () =>
      JSON.stringify({
        status: statusRef.current,
        layout,
        mode: modeRef.current,
        challengeView: challengeViewRef.current,
        level: levelRef.current?.id,
        target: queueRef.current[0] ?? null,
        queueLength: queueRef.current.length,
        challengeChars: modeRef.current === "challenge" ? queueRef.current.length + statsRef.current.correct : undefined,
        headX: Math.round(headXRef.current),
        speed: Math.round(effectiveSpeedRef.current * 10) / 10,
        speedLevel,
        stats: {
          score: statsRef.current.score,
          typed: statsRef.current.typed,
          correct: statsRef.current.correct,
          errors: statsRef.current.errors,
          streak: statsRef.current.streak,
          accuracy: Math.round(getAccuracy(statsRef.current)),
          wpm: getWpm(statsRef.current),
        },
        note: "Coordinates use percent-like horizontal headX; 100 is right edge, negative values are past the left edge.",
      });
    return () => {
      delete window.advanceTime;
      delete window.render_game_to_text;
    };
  }, [layout, speedLevel, step]);

  const startLevel = useCallback(() => {
    const nextQueue =
      mode === "challenge"
        ? challengeQueue
        : mode === "campaign" && activeLevel.lessonLineCount
          ? Array.from(buildLessonText(activeLevel.keySet, activeLevel.lessonLineCount))
          : mode === "endless"
            ? makeWave(activeLevel.keySet, activeLevel.waveLength)
            : Array.from(buildLessonText(activeLevel.keySet, 10));
    if (mode === "challenge" && nextQueue.length === 0) {
      setMessage("Вставь текст для challenge");
      return;
    }
    const nextStats = newStats();
    challengeErrorsRef.current = [];
    setChallengeErrors([]);
    setClockNow(nextStats.startedAt);
    setQueue(nextQueue);
    setSessionText(nextQueue.join(""));
    setLastCorrectSymbol("");
    setStats(nextStats);
    const nextHeadX = mode === "endless" ? ENDLESS_START_X : 100;
    setHeadX(nextHeadX);
    setStatus("running");
    setMessage("Печатай текущую цель в потоке");
    queueRef.current = nextQueue;
    statsRef.current = nextStats;
    headXRef.current = nextHeadX;
    endlessCatchupRef.current = 1;
  }, [activeLevel, challengeQueue, levelId, mode]);

  const startMistakePractice = useCallback(() => {
    const mistakeText = buildMistakePracticeText(challengeErrorDrills);
    const nextQueue = buildLineChallenge(normalizeChallengeText(mistakeText, layout)).sequence;
    if (nextQueue.length === 0) return;

    const nextStats = newStats();
    setChallengeText(mistakeText);
    setChallengeView("line");
    challengeErrorsRef.current = [];
    setChallengeErrors([]);
    setClockNow(nextStats.startedAt);
    setQueue(nextQueue);
    setSessionText(mistakeText);
    setLastCorrectSymbol("");
    setStats(nextStats);
    setHeadX(0);
    setStatus("running");
    setMessage("Отрабатываем ошибки");
    queueRef.current = nextQueue;
    statsRef.current = nextStats;
    headXRef.current = 0;
    challengeViewRef.current = "line";
  }, [challengeErrorDrills, layout]);

  const handleInput = useCallback(
    (rawKey: string) => {
      if (statusRef.current !== "running") return;
      const normalized = normalizeInputKey(rawKey);
      if (normalized.length !== 1 && normalized !== " " && normalized !== "\n" && normalized !== "\t") return;
      const key = normalized.toLowerCase();
      const expectedRaw = queueRef.current[0];
      if (!expectedRaw) return;
      const isCorrect = modeRef.current === "challenge" ? normalized === expectedRaw : key === expectedRaw.toLowerCase();
      if (!isCorrect && modeRef.current === "challenge") {
        const index = challengeQueue.length - queueRef.current.length;
        const error: ChallengeError = {
          index,
          word: extractWordAt(normalizedChallengeText, index),
          expected: expectedRaw,
          typed: normalized,
        };
        const nextErrors = [...challengeErrorsRef.current, error];
        challengeErrorsRef.current = nextErrors;
        setChallengeErrors(nextErrors);
      }
      const symbol = isCorrect ? queueRef.current[0] : normalized;
      let nextQueue = isCorrect ? queueRef.current.slice(1) : queueRef.current;
      if (isCorrect && nextQueue.length === 0 && modeRef.current === "endless") {
        nextQueue = makeWave(activeLevel.keySet, activeLevel.waveLength);
      }
      const nextStreak = isCorrect ? statsRef.current.streak + 1 : 0;
      const nextStats: SessionStats = {
        ...statsRef.current,
        typed: statsRef.current.typed + 1,
        correct: statsRef.current.correct + (isCorrect ? 1 : 0),
        errors: statsRef.current.errors + (isCorrect ? 0 : 1),
        streak: nextStreak,
        bestStreak: Math.max(statsRef.current.bestStreak, nextStreak),
        score: statsRef.current.score + (isCorrect ? scoreForHit(nextStreak, effectiveSpeedRef.current) : 0),
      };
      queueRef.current = nextQueue;
      statsRef.current = nextStats;
      setQueue(nextQueue);
      setStats(nextStats);
      if (isCorrect) setLastCorrectSymbol(expectedRaw);
      if (isCorrect && modeRef.current === "endless") {
        setBurst({ symbol, id: Date.now(), x: headXRef.current });
        const recoveredX = headXRef.current + ENDLESS_SYMBOL_STEP;
        headXRef.current = recoveredX;
        setHeadX(recoveredX);
      } else if (isCorrect) {
        headXRef.current = 100;
        setHeadX(100);
      }
      setPulse({ symbol, kind: isCorrect ? "success" : "fail", id: Date.now() });
      if (!isCorrect && modeRef.current !== "challenge" && nextStats.errors > activeLevel.errorLimit) finish("lost", nextStats);
      else if (isCorrect && nextQueue.length === 0) finish("won", nextStats);
    },
    [activeLevel.errorLimit, activeLevel.keySet, activeLevel.waveLength, challengeQueue.length, finish, normalizedChallengeText],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target)) return;
      if (event.key === "Escape" && statusRef.current === "running") {
        setStatus("paused");
        setMessage("Пауза");
        return;
      }
      if (event.key === "Enter" && statusRef.current !== "running") {
        startLevel();
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === "Tab" || event.key === "Enter" || event.key === " ") event.preventDefault();
      handleInput(event.key);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleInput, startLevel]);

  const selectLayout = (nextLayout: LayoutId) => {
    setLayout(nextLayout);
    setLevelId(1);
    setStatus("idle");
    setQueue([]);
    setSessionText("");
    setLastCorrectSymbol("");
    challengeErrorsRef.current = [];
    setChallengeErrors([]);
    setMessage("Раскладка изменена");
  };

  const selectMode = (nextMode: GameMode) => {
    setMode(nextMode);
    setStatus("idle");
    setQueue([]);
    setSessionText("");
    setLastCorrectSymbol("");
    challengeErrorsRef.current = [];
    setChallengeErrors([]);
    setMessage(nextMode === "challenge" ? "Вставь текст и запускай challenge" : "Режим готов");
  };

  const selectLevel = (nextLevel: number) => {
    if (nextLevel > unlocked && mode === "campaign") return;
    setLevelId(nextLevel);
    setStatus("idle");
    setQueue([]);
    setSessionText("");
    setLastCorrectSymbol("");
    challengeErrorsRef.current = [];
    setChallengeErrors([]);
    setMessage(`Выбран уровень ${nextLevel}`);
  };

  const visibleQueue = queue.slice(0, isChallenge ? 26 : 18);
  const displayWpm = getWpm(stats, clockNow);
  const remainingErrors = Math.max(0, activeLevel.errorLimit - stats.errors);
  const canResume = status === "paused";
  const challengeProgress = isChallenge && challengeQueue.length > 0 ? Math.round((stats.correct / challengeQueue.length) * 100) : 0;
  const challengeElapsedSeconds = isChallenge && status !== "idle" ? getElapsedSeconds(stats, clockNow) : 0;
  const challengeLiveCpm = isChallenge && status !== "idle" ? getCpm(stats, clockNow) : 0;
  const challengeSummary =
    isChallenge && (status === "won" || status === "lost")
      ? `Средний темп ${challengeLiveCpm} зн/мин · время ${formatDuration(challengeElapsedSeconds)}`
      : null;
  const showChallengeErrorWork = isChallenge && (status === "won" || status === "lost") && challengeErrorDrills.length > 0;
  const currentLineIndex = sessionLines.lines.reduce((active, line, index) => (stats.correct >= line.start ? index : active), 0);
  const shellClassName = ["app-shell", !isFlowMode ? "line-challenge-shell" : ""].join(" ");

  return (
    <main className={shellClassName}>
      <section className="topbar">
        <div>
          <p className="eyebrow">Typing Arcade</p>
          <h1>Слепая печать как аркада</h1>
        </div>
        <div className="layout-switch" aria-label="Выбор раскладки">
          <button className={layout === "en-US" ? "active" : ""} onClick={() => selectLayout("en-US")}>
            EN
          </button>
          <button className={layout === "ru-RU" ? "active" : ""} onClick={() => selectLayout("ru-RU")}>
            RU
          </button>
        </div>
      </section>

      <section className="control-strip">
        <div className="mode-tabs">
          {modes.map((item) => (
            <button key={item.id} className={mode === item.id ? "active" : ""} onClick={() => selectMode(item.id)}>
              <span>{item.label}</span>
              <small>{item.description}</small>
            </button>
          ))}
        </div>
        <div className="level-picker" aria-label="Выбор уровня">
          {Array.from({ length: campaignLevels }, (_, index) => index + 1).map((id) => {
            const locked = mode === "campaign" && id > unlocked;
            return (
              <button key={id} className={id === levelId ? "active" : ""} disabled={locked} onClick={() => selectLevel(id)}>
                {id}
              </button>
            );
          })}
        </div>
      </section>

      <section className="speed-control" aria-label="Настройка скорости">
        <div>
          <strong>{isChallenge ? "Скорость challenge" : "Скорость потока"}</strong>
          <span>
            {isChallenge
              ? `${speedLevel}/10 · ${challengeCpmValue} знаков/мин · расчет ${formatDuration(challengeEstimateSeconds)}`
              : `${speedLevel}/10 · фактически ${effectiveSpeed.toFixed(1)} · очки за попадание x${(0.75 + effectiveSpeed / 10).toFixed(2)}`}
          </span>
        </div>
        <input
          aria-label="Скорость потока"
          type="range"
          min="1"
          max="10"
          value={speedLevel}
          onChange={(event) => setSpeedLevel(Number(event.currentTarget.value))}
        />
      </section>

      {isChallenge && (
        <section className="challenge-panel">
          <label>
            <strong>Текст challenge</strong>
            <textarea
              value={challengeText}
              onChange={(event) => {
                setChallengeText(event.currentTarget.value);
                setStatus("idle");
                setQueue([]);
                setSessionText("");
                setLastCorrectSymbol("");
                challengeErrorsRef.current = [];
                setChallengeErrors([]);
              }}
              placeholder="Вставь любой текст: строки, пробелы, цифры, знаки препинания..."
              rows={4}
            />
          </label>
          <div className="challenge-analysis">
            <Metric label="Символы" value={challengeQueue.length.toString()} />
            <Metric label="Темп сейчас" value={`${challengeLiveCpm} зн/мин`} />
            <Metric label="Время набора" value={formatDuration(challengeElapsedSeconds)} />
            <Metric label="Расчет" value={challengeQueue.length ? formatDuration(challengeEstimateSeconds) : "0 сек"} />
            <Metric label="Прогресс" value={`${challengeProgress}%`} />
          </div>
        </section>
      )}

      <section className="arena" aria-label="Игровое поле">
        <div className={["radar", pulse?.kind === "fail" ? "radar-fail" : ""].join(" ")}>
          <div className="scanline" />
          {!isFlowMode ? (
            <ChallengeLineReader lines={sessionLines.lines} cursor={stats.correct} currentLineIndex={currentLineIndex} />
          ) : (
            <>
              <div className="target-zone" />
              {burst && (
                <div className="symbol-burst" key={burst.id} style={{ left: `${78 + burst.x}px` }}>
                  <span>{streamChar(burst.symbol)}</span>
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              )}
              <div className="letter-stream" style={{ transform: `translateX(${headX}px)` }}>
                {visibleQueue.map((letter, index) => (
                  <span
                    key={`${letter}-${index}`}
                    className={[index === 0 ? "current-letter" : "", letter.trim() === "" ? "control-letter" : ""].join(" ")}
                  >
                    {streamChar(letter)}
                  </span>
                ))}
              </div>
            </>
          )}
          {status !== "running" && (
            <div className="arena-message">
              <strong>{status === "won" ? (isChallenge ? "Challenge завершен" : "Уровень пройден") : status === "lost" ? "Волна сорвалась" : message}</strong>
              <span>{challengeSummary ?? (status === "idle" ? "Enter запускает волну" : "Нажми старт, чтобы продолжить")}</span>
            </div>
          )}
        </div>
        <div className="stats-panel">
          <Metric label="Счет" value={stats.score.toString()} />
          <Metric label="Точность" value={formatPercent(getAccuracy(stats))} />
          <Metric label="WPM" value={displayWpm.toString()} />
          <Metric label="Комбо" value={stats.streak.toString()} />
          <Metric label="Ошибки" value={isChallenge ? stats.errors.toString() : `${stats.errors}/${activeLevel.errorLimit}`} />
          <Metric label="Лучший" value={bestScore.toString()} />
        </div>
      </section>

      <section className="action-row">
        <div>
          <strong>{activeLevel.label}</strong>
          <span>
            {isChallenge
              ? `${stats.correct}/${challengeQueue.length} символов · ${challengeLiveCpm} зн/мин · ${formatDuration(challengeElapsedSeconds)}`
              : `${activeLevel.keySet.join(" ")} · темп ${effectiveSpeed.toFixed(1)} · запас ${remainingErrors}`}
          </span>
        </div>
        <div className="actions">
          <button className="ghost" onClick={() => setStatus(status === "running" ? "paused" : status)}>
            Пауза
          </button>
          {canResume ? (
            <button className="primary" onClick={() => setStatus("running")}>
              Продолжить
            </button>
          ) : (
            <button className="primary" onClick={startLevel}>
              Старт
            </button>
          )}
        </div>
      </section>

      {showChallengeErrorWork && (
        <section className="mistake-work" aria-label="Работа над ошибками">
          <div className="mistake-work-head">
            <div>
              <strong>Работа над ошибками</strong>
              <span>
                {challengeErrors.length} {challengeErrors.length === 1 ? "ошибка" : "ошибок"} · сначала слово, потом проблемная пара
              </span>
            </div>
            <span>
              <button className="primary" type="button" onClick={startMistakePractice}>
                Отработать ошибки
              </button>
            </span>
          </div>
          <div className="mistake-drills">
            {challengeErrorDrills.map((drill) => (
              <article className="mistake-drill" key={drill.id}>
                <div>
                  <strong>{drill.words.join(", ")}</strong>
                  <span>
                    надо {formatDrillChar(drill.expected)} · нажато {formatDrillChar(drill.typed)} · {drill.count}x
                  </span>
                </div>
                {drill.wordLines.map((line, index) => (
                  <pre key={`${drill.id}-word-${index}`}>{line}</pre>
                ))}
                <pre>{drill.symbolLine}</pre>
              </article>
            ))}
          </div>
        </section>
      )}

      <Keyboard layout={layout} target={target} previousSymbol={previousSymbol} activeSymbols={keyboardSymbols} pulse={pulse} />

      <section className="finger-legend">
        {(Object.keys(fingerLabels) as FingerId[]).map((finger) => (
          <span key={finger}>
            <i style={{ background: fingerColors[finger] }} />
            {fingerLabels[finger]}
          </span>
        ))}
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function ChallengeLineReader({
  lines,
  cursor,
  currentLineIndex,
}: {
  lines: ChallengeLine[];
  cursor: number;
  currentLineIndex: number;
}) {
  return (
    <div className="line-reader">
      <div className="line-reader-track" style={{ transform: `translateY(${-currentLineIndex * 46}px)` }}>
        {lines.map((line, lineIndex) => (
          <div
            className={[
              "reader-line",
              lineIndex === currentLineIndex ? "active" : "",
              lineIndex < currentLineIndex ? "past" : "",
              lineIndex > currentLineIndex ? "future" : "",
            ].join(" ")}
            key={`${line.start}-${lineIndex}`}
          >
            {Array.from(line.text).map((char, charIndex) => {
              const absoluteIndex = line.start + charIndex;
              const isTyped = absoluteIndex < cursor;
              const isCurrent = absoluteIndex === cursor;
              return (
                <span
                  className={[isTyped ? "typed" : "", isCurrent ? "cursor-char" : "", char === " " ? "line-space" : ""].join(" ")}
                  key={`${absoluteIndex}-${charIndex}`}
                >
                  {char === " " ? "\u00a0" : char}
                </span>
              );
            })}
            {lineIndex < lines.length - 1 && (
              <span className={[cursor > line.start + line.text.length ? "typed" : "", cursor === line.start + line.text.length ? "cursor-char enter-mark" : "enter-mark"].join(" ")}>
                ↵
              </span>
            )}
            {line.text.length === 0 && <span className="cursor-char empty-line">↵</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

function Keyboard({
  layout,
  target,
  previousSymbol,
  activeSymbols,
  pulse,
}: {
  layout: LayoutId;
  target: string;
  previousSymbol: string;
  activeSymbols: Set<string>;
  pulse: { symbol: string; kind: PulseKind; id: number } | null;
}) {
  const targetLower = target.toLowerCase();
  const shiftSide = requiredShiftSide(target, layout);
  const spaceSide = target === " " ? requiredSpaceSide(previousSymbol, layout) : undefined;
  return (
    <section className="keyboard" aria-label="Экранная клавиатура">
      {keyboardRows.map((row, rowIndex) => (
        <div className={`key-row row-${rowIndex}`} key={rowIndex}>
          {row.map((key) => {
            const symbol = symbolForKey(key, layout);
            const symbols = keySymbols(key, layout);
            const isShiftKey = key.code === "ShiftLeft" || key.code === "ShiftRight";
            const isSpaceKey = key.row === "space";
            const isEnterKey = key.code === "Enter";
            const isTarget =
              (!isServiceKey(key) && !isSpaceKey && symbols.some((keySymbol) => keySymbol.toLowerCase() === targetLower)) ||
              (isShiftKey && key.side === shiftSide) ||
              (isSpaceKey && target === " " && (!spaceSide || key.side === spaceSide)) ||
              (isEnterKey && target === "\n");
            const isUsed = isServiceKey(key) || isSpaceKey ? isTarget : symbols.some((keySymbol) => activeSymbols.has(keySymbol.toLowerCase()));
            const isPulse = !isServiceKey(key) && pulse ? symbols.some((keySymbol) => keySymbol.toLowerCase() === pulse.symbol.toLowerCase()) : false;
            const style = { "--finger-color": fingerColors[key.finger] } as CSSProperties;
            const label = key.label ?? symbol;
            const display = label === "\n" ? "Enter" : label === " " ? "Space" : label;
            return (
              <div
                className={[
                  "key",
                  key.row === "number" ? "number-key" : "",
                  key.row === "space" ? "space-key" : "",
                  key.side ? `${key.side}-key` : "",
                  isShiftKey ? "shift-key" : "",
                  isEnterKey ? "enter-key" : "",
                  key.home ? "home-key" : "",
                  isUsed ? "used-key" : "inactive-key",
                  isTarget ? "target-key" : "",
                  isPulse ? `pulse-${pulse?.kind}` : "",
                ].join(" ")}
                style={style}
                key={key.code}
                title={fingerLabels[key.finger]}
              >
                <span>{display}</span>
              </div>
            );
          })}
        </div>
      ))}
    </section>
  );
}
