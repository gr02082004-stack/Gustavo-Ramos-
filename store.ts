import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DAILIES, STREAK_REWARDS, gateById, itemById, trialFor } from "@/lib/system/content";
import { daysBetween, derive, todayKey, xpToNext } from "@/lib/system/formulas";
import {
  MAX_LEVEL,
  SAVE_VERSION,
  type AttrKey,
  type CustomMission,
  type ItemSlot,
  type RankId,
  type SaveData,
} from "@/lib/system/types";

export interface Banner {
  id: string;
  text: string;
  tone: "info" | "good" | "warn";
}

interface GameStore extends SaveData {
  banner: Banner | null;
  pendingLevel: number;
  awaken: (name: string) => void;
  tickDay: () => void;
  dismissBanner: () => void;
  dismissLevel: () => void;
  setName: (name: string) => void;
  addStat: (key: AttrKey) => void;
  logDaily: (id: string, amount: number) => void;
  completeDaily: (id: string) => void;
  addCustom: (input: { title: string; detail: string; xp: number; attr: AttrKey | null; repeat: "diaria" | "unica" }) => void;
  logCustom: (id: string) => void;
  removeCustom: (id: string) => void;
  buy: (itemId: string) => void;
  buyPotion: () => void;
  consumePotion: () => number;
  equip: (itemId: string) => void;
  unequip: (slot: ItemSlot) => void;
  toggleFormation: (id: string) => void;
  finishGate: (id: string, victory: boolean) => { xp: number; gold: number; first: boolean };
  extractShadow: (id: string) => void;
  logProof: (rank: RankId, amount: number) => void;
  winRank: (rank: RankId) => void;
  toggleMute: () => void;
  importSave: (raw: string) => string | null;
  resetAll: () => void;
}

const memory = new Map<string, string>();

const safeStorage = {
  getItem: (key: string) => {
    if (typeof window === "undefined") return memory.get(key) ?? null;
    try {
      return window.localStorage.getItem(key);
    } catch {
      return memory.get(key) ?? null;
    }
  },
  setItem: (key: string, value: string) => {
    memory.set(key, value);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, value);
    } catch {
      /* quota or private mode */
    }
  },
  removeItem: (key: string) => {
    memory.delete(key);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

export function freshSave(): SaveData {
  return {
    version: SAVE_VERSION,
    awakened: false,
    name: "",
    createdAt: 0,
    level: 1,
    xp: 0,
    gold: 0,
    points: 0,
    stats: { str: 10, agi: 10, vit: 10, int: 10, sen: 10 },
    rank: "E",
    proofs: {},
    equipment: {},
    inventory: [],
    shadows: [],
    formation: [],
    potions: 0,
    dailiesDate: "",
    dailies: {},
    streak: 0,
    lastStreakDate: "",
    fatigueDate: "",
    train: {},
    customs: [],
    customDoneToday: 0,
    gates: {},
    log: [],
    xpLog: {},
    history: [],
    muted: false,
    totalQuests: 0,
  };
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function pushLog(d: SaveData, kind: SaveData["log"][number]["kind"], text: string) {
  d.log.unshift({ id: uid(), at: Date.now(), kind, text });
  d.log = d.log.slice(0, 80);
}

function noteXp(d: SaveData, amount: number) {
  if (amount <= 0) return;
  const day = todayKey();
  d.xpLog[day] = (d.xpLog[day] ?? 0) + amount;
  const keys = Object.keys(d.xpLog).sort();
  for (const key of keys.slice(0, Math.max(0, keys.length - 28))) delete d.xpLog[key];
}

function remember(d: SaveData) {
  const day = todayKey();
  const power = derive(d).power;
  const last = d.history[d.history.length - 1];
  if (last && last.d === day) {
    last.lv = d.level;
    last.pw = power;
  } else {
    d.history.push({ d: day, lv: d.level, pw: power });
  }
  if (d.history.length > 420) d.history.splice(0, d.history.length - 420);
}

export function grantXp(d: SaveData, raw: number) {
  const amount = Math.max(0, Math.round(raw * (d.fatigueDate === todayKey() ? 0.9 : 1)));
  noteXp(d, amount);
  d.xp += amount;
  let gained = 0;
  while (d.level < MAX_LEVEL && d.xp >= xpToNext(d.level)) {
    d.xp -= xpToNext(d.level);
    d.level += 1;
    d.points += 3;
    gained += 1;
  }
  if (d.level >= MAX_LEVEL) d.xp = 0;
  if (gained > 0) {
    pushLog(
      d,
      "level",
      gained === 1
        ? `Nível ${d.level}. Três pontos aguardam.`
        : `Ascendeu ${gained} níveis. Agora é nível ${d.level}.`,
    );
  }
  remember(d);
  return { amount, gained };
}

function growShadow(d: SaveData, id: string, amount: number) {
  const shadow = d.shadows.find((s) => s.id === id);
  if (!shadow) return;
  shadow.xp += amount;
  let guard = 0;
  while (shadow.level < 20 && shadow.xp >= 60 + shadow.level * 40 && guard < 20) {
    shadow.xp -= 60 + shadow.level * 40;
    shadow.level += 1;
    guard += 1;
    pushLog(d, "shadow", `${id === shadow.id ? shadowName(id) : shadow.id} chegou ao nível ${shadow.level}.`);
  }
}

function shadowName(id: string) {
  return (
    {
      e: "Vermesang",
      d: "Veyr",
      c: "Calder",
      b: "Vespera",
      a: "Kaelth",
      s: "Ashvyr",
      ss: "Mordane",
      sss: "Vaelgor",
      monarch: "Aezrel",
    } as Record<string, string>
  )[id] ?? "Sombra";
}

function allDailiesDone(d: SaveData) {
  return DAILIES.every((mission) => d.dailies[mission.id]?.done);
}

function markStreak(d: SaveData) {
  if (!allDailiesDone(d)) return;
  const today = todayKey();
  if (d.lastStreakDate === today) return;
  d.streak += 1;
  d.lastStreakDate = today;
  const reward = STREAK_REWARDS[d.streak];
  if (reward) {
    d.gold += reward.gold;
    d.points += reward.points;
    pushLog(
      d,
      "system",
      `Sequência de ${d.streak} dias. ${reward.gold} ouro${reward.points ? ` e ${reward.points} ponto` : ""}.`,
    );
  } else {
    pushLog(d, "quest", `Sequência de ${d.streak} dias. O Sistema registra a disciplina.`);
  }
}

function banner(text: string, tone: Banner["tone"]): Banner {
  return { id: uid(), text, tone };
}

function toSave(s: SaveData): SaveData {
  return {
    version: s.version,
    awakened: s.awakened,
    name: s.name,
    createdAt: s.createdAt,
    level: s.level,
    xp: s.xp,
    gold: s.gold,
    points: s.points,
    stats: { ...s.stats },
    rank: s.rank,
    proofs: structuredClone(s.proofs),
    equipment: { ...s.equipment },
    inventory: [...s.inventory],
    shadows: s.shadows.map((sh) => ({ ...sh })),
    formation: [...s.formation],
    potions: s.potions,
    dailiesDate: s.dailiesDate,
    dailies: structuredClone(s.dailies),
    streak: s.streak,
    lastStreakDate: s.lastStreakDate,
    fatigueDate: s.fatigueDate,
    train: { ...s.train },
    customs: s.customs.map((c) => ({ ...c, doneDates: [...c.doneDates] })),
    customDoneToday: s.customDoneToday,
    gates: structuredClone(s.gates),
    log: s.log.map((entry) => ({ ...entry })),
    xpLog: { ...s.xpLog },
    history: s.history.map((point) => ({ ...point })),
    muted: s.muted,
    totalQuests: s.totalQuests,
  };
}

function patch(
  s: GameStore,
  fn: (d: SaveData) => void,
  extra: Partial<Pick<GameStore, "banner" | "pendingLevel">> = {},
) {
  const d = toSave(s);
  fn(d);
  return {
    ...d,
    banner: extra.banner === undefined ? s.banner : extra.banner,
    pendingLevel: extra.pendingLevel === undefined ? s.pendingLevel : extra.pendingLevel,
  };
}

function num(value: unknown, min: number, max: number, fallback: number) {
  const n = typeof value === "number" && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.min(max, Math.max(min, n));
}

export function sanitize(input: unknown): SaveData {
  const base = freshSave();
  if (!input || typeof input !== "object") return base;
  const raw = input as Partial<SaveData>;
  const stats = { ...base.stats };
  if (raw.stats && typeof raw.stats === "object") {
    for (const key of ["str", "agi", "vit", "int", "sen"] as const) {
      stats[key] = num(raw.stats[key], 1, 999, 10);
    }
  }
  const ranks = ["E", "D", "C", "B", "A", "S", "SS", "SSS", "MONARCH"] as const;
  const rank = ranks.includes(raw.rank as RankId) ? (raw.rank as RankId) : "E";
  const inventory = Array.isArray(raw.inventory)
    ? raw.inventory.filter((id) => typeof id === "string" && itemById(id))
    : [];
  const shadows = Array.isArray(raw.shadows)
    ? raw.shadows
        .filter((s) => s && typeof s.id === "string" && gateById(s.id))
        .map((s) => ({
          id: s.id,
          level: num(s.level, 1, 20, 1),
          xp: num(s.xp, 0, 100000, 0),
          at: num(s.at, 0, Date.now() + 86_400_000, Date.now()),
        }))
    : [];
  const known = new Set(shadows.map((s) => s.id));
  const formation = Array.isArray(raw.formation)
    ? raw.formation.filter((id) => typeof id === "string" && known.has(id)).slice(0, 6)
    : [];
  const customs: CustomMission[] = Array.isArray(raw.customs)
    ? raw.customs
        .filter((c) => c && typeof c.title === "string")
        .slice(0, 24)
        .map((c) => ({
          id: typeof c.id === "string" ? c.id : uid(),
          title: c.title.slice(0, 48),
          detail: typeof c.detail === "string" ? c.detail.slice(0, 160) : "",
          xp: num(c.xp, 15, 80, 30),
          attr: (["str", "agi", "vit", "int", "sen"] as const).includes(c.attr as AttrKey)
            ? (c.attr as AttrKey)
            : null,
          repeat: c.repeat === "unica" ? "unica" : "diaria",
          createdAt: num(c.createdAt, 0, Date.now() + 86_400_000, Date.now()),
          doneDates: Array.isArray(c.doneDates) ? c.doneDates.filter((x) => typeof x === "string").slice(-40) : [],
        }))
    : [];
  return {
    ...base,
    version: SAVE_VERSION,
    awakened: Boolean(raw.awakened),
    name: typeof raw.name === "string" ? raw.name.slice(0, 18) : "",
    createdAt: num(raw.createdAt, 0, Date.now() + 86_400_000, 0),
    level: num(raw.level, 1, MAX_LEVEL, 1),
    xp: num(raw.xp, 0, 10_000_000, 0),
    gold: num(raw.gold, 0, 9_999_999, 0),
    points: num(raw.points, 0, 5000, 0),
    stats,
    rank,
    proofs: raw.proofs && typeof raw.proofs === "object" ? structuredClone(raw.proofs) : {},
    equipment: raw.equipment && typeof raw.equipment === "object" ? { ...raw.equipment } : {},
    inventory: [...new Set(inventory)],
    shadows,
    formation,
    potions: num(raw.potions, 0, 99, 0),
    dailiesDate: typeof raw.dailiesDate === "string" ? raw.dailiesDate : "",
    dailies: raw.dailies && typeof raw.dailies === "object" ? structuredClone(raw.dailies) : {},
    streak: num(raw.streak, 0, 10000, 0),
    lastStreakDate: typeof raw.lastStreakDate === "string" ? raw.lastStreakDate : "",
    fatigueDate: typeof raw.fatigueDate === "string" ? raw.fatigueDate : "",
    train: raw.train && typeof raw.train === "object" ? { ...raw.train } : {},
    customs,
    customDoneToday: num(raw.customDoneToday, 0, 4, 0),
    gates: raw.gates && typeof raw.gates === "object" ? structuredClone(raw.gates) : {},
    log: Array.isArray(raw.log) ? raw.log.filter((e) => e && typeof e.text === "string").slice(0, 80) : [],
    xpLog: raw.xpLog && typeof raw.xpLog === "object" ? { ...raw.xpLog } : {},
    history: Array.isArray(raw.history) ? raw.history.filter((h) => h && typeof h.d === "string").slice(-420) : [],
    muted: Boolean(raw.muted),
    totalQuests: num(raw.totalQuests, 0, 1_000_000, 0),
  };
}

export const useGame = create<GameStore>()(
  persist(
    (set, get) => ({
      ...freshSave(),
      banner: null as Banner | null,
      pendingLevel: 0,
      dismissBanner: () => set({ banner: null }),
      dismissLevel: () => set({ pendingLevel: 0 }),
      awaken: (name) =>
        set((s) =>
          patch(
            s,
            (d) => {
              const clean = name.trim().slice(0, 18);
              d.awakened = true;
              d.name = clean || "Caçador";
              d.createdAt = Date.now();
              d.dailiesDate = todayKey();
              d.potions = 1;
              d.stats = { str: 10, agi: 10, vit: 10, int: 10, sen: 10 };
              pushLog(d, "system", `${d.name} aceitou o Sistema. Nível 1, rank E.`);
              pushLog(d, "quest", "Missões diárias de fortalecimento atribuídas. Elas não são opcionais.");
              remember(d);
            },
            { banner: banner("Um frasco de vitalidade foi concedido.", "good"), pendingLevel: 0 },
          ),
        ),
      tickDay: () =>
        set((s) => {
          if (!s.awakened) return s;
          const today = todayKey();
          if (s.dailiesDate === today) return s;
          return patch(s, (d) => {
            const missed =
              Boolean(d.dailiesDate) &&
              (daysBetween(d.dailiesDate, today) > 1 || !allDailiesDone(d));
            if (missed) {
              const broke = d.streak > 0;
              d.streak = 0;
              d.fatigueDate = today;
              pushLog(
                d,
                "system",
                broke
                  ? "A sequência quebrou. Experiência reduzida em 10% hoje."
                  : "O dia anterior ficou incompleto. Experiência reduzida em 10% hoje.",
              );
            }
            d.dailiesDate = today;
            d.dailies = {};
            d.customDoneToday = 0;
            remember(d);
          }, missedBanner(s, today));
        }),
      setName: (name) =>
        set((s) =>
          patch(s, (d) => {
            const clean = name.trim().slice(0, 18);
            if (clean) d.name = clean;
          }),
        ),
      addStat: (key) =>
        set((s) =>
          patch(s, (d) => {
            if (d.points <= 0 || d.stats[key] >= 400) return;
            d.stats[key] += 1;
            d.points -= 1;
            remember(d);
          }),
        ),
      logDaily: (id, amount) =>
        set((s) =>
          patch(s, (d) => {
            const def = DAILIES.find((m) => m.id === id);
            if (!def || amount === 0) return;
            const row = d.dailies[id] ?? { current: 0, done: false };
            if (row.done) return;
            const cap = def.mode === "time" ? def.target * 60 + 90 : def.target + 30;
            row.current = Math.max(0, Math.min(cap, row.current + amount));
            d.dailies[id] = row;
          }),
        ),
      completeDaily: (id) =>
        set((s) => {
          const def = DAILIES.find((m) => m.id === id);
          if (!def) return s;
          const row = s.dailies[id];
          const need = def.mode === "time" ? def.target * 60 : def.target;
          if (!row || row.done || row.current < need) return s;
          let gained = 0;
          const next = patch(
            s,
            (d) => {
              d.dailies[id] = { current: row.current, done: true };
              d.train[id] = (d.train[id] ?? 0) + 1;
              d.totalQuests += 1;
              const result = grantXp(d, def.xp);
              gained = result.gained;
              if (d.train[id] % def.every === 0) {
                d.stats[def.attr] += 1;
                pushLog(d, "system", `O treino repetido elevou um atributo.`);
              }
              pushLog(d, "quest", `${def.name} concluída. +${result.amount} XP.`);
              markStreak(d);
              remember(d);
            },
            { pendingLevel: s.pendingLevel },
          );
          return {
            ...next,
            pendingLevel: s.pendingLevel + gained,
            banner: banner(`${def.name} entregue.`, "good"),
          };
        }),
      addCustom: (input) =>
        set((s) =>
          patch(
            s,
            (d) => {
              if (d.customs.length >= 24) return;
              const title = input.title.trim().slice(0, 48);
              if (title.length < 2) return;
              d.customs.unshift({
                id: uid(),
                title,
                detail: input.detail.trim().slice(0, 160),
                xp: Math.min(80, Math.max(15, Math.round(input.xp))),
                attr: input.attr,
                repeat: input.repeat,
                createdAt: Date.now(),
                doneDates: [],
              });
            },
            { banner: banner("Missão pessoal registrada.", "info") },
          ),
        ),
      logCustom: (id) =>
        set((s) => {
          const mission = s.customs.find((c) => c.id === id);
          if (!mission) return s;
          const today = todayKey();
          if (mission.repeat === "diaria" && mission.doneDates.includes(today)) return s;
          if (mission.repeat === "unica" && mission.doneDates.length > 0) return s;
          if (mission.repeat === "diaria" && s.customDoneToday >= 4) {
            return { ...s, banner: banner("Limite de 4 missões pessoais hoje.", "warn") };
          }
          let gained = 0;
          const next = patch(s, (d) => {
            const row = d.customs.find((c) => c.id === id);
            if (!row) return;
            row.doneDates = [...row.doneDates, mission.repeat === "diaria" ? today : "once"];
            if (mission.repeat === "diaria") d.customDoneToday += 1;
            d.totalQuests += 1;
            const result = grantXp(d, row.xp);
            gained = result.gained;
            pushLog(d, "quest", `${row.title} concluída. +${result.amount} XP.`);
          });
          return { ...next, pendingLevel: s.pendingLevel + gained, banner: banner("Missão pessoal entregue.", "good") };
        }),
      removeCustom: (id) =>
        set((s) =>
          patch(s, (d) => {
            d.customs = d.customs.filter((c) => c.id !== id);
          }),
        ),
      buy: (itemId) =>
        set((s) => {
          const item = itemById(itemId);
          if (!item) return s;
          if (s.inventory.includes(item.id)) return { ...s, banner: banner("Você já possui isto.", "warn") };
          if (s.level < item.minLevel) return { ...s, banner: banner(`Exige nível ${item.minLevel}.`, "warn") };
          if (s.gold < item.price) return { ...s, banner: banner("Ouro insuficiente.", "warn") };
          return patch(
            s,
            (d) => {
              d.gold -= item.price;
              d.inventory.push(item.id);
              if (!d.equipment[item.slot]) d.equipment[item.slot] = item.id;
              pushLog(d, "item", `${item.name} adquirido.`);
              remember(d);
            },
            { banner: banner(`${item.name} agora é seu.`, "good") },
          );
        }),
      buyPotion: () =>
        set((s) => {
          if (s.gold < 36) return { ...s, banner: banner("Ouro insuficiente.", "warn") };
          if (s.potions >= 99) return s;
          return patch(
            s,
            (d) => {
              d.gold -= 36;
              d.potions += 1;
            },
            { banner: banner("Frasco guardado.", "good") },
          );
        }),
      consumePotion: () => {
        const snap = get();
        if (snap.potions <= 0) return 0;
        const heal = Math.round(derive(snap).maxHp * 0.34);
        set((s) =>
          patch(s, (d) => {
            d.potions = Math.max(0, d.potions - 1);
          }),
        );
        return heal;
      },
      equip: (itemId) =>
        set((s) => {
          const item = itemById(itemId);
          if (!item || !s.inventory.includes(itemId)) return s;
          return patch(s, (d) => {
            d.equipment[item.slot] = item.id;
            remember(d);
          });
        }),
      unequip: (slot) =>
        set((s) =>
          patch(s, (d) => {
            delete d.equipment[slot];
            remember(d);
          }),
        ),
      toggleFormation: (id) =>
        set((s) => {
          if (!s.shadows.some((sh) => sh.id === id)) return s;
          if (s.formation.includes(id)) {
            return patch(s, (d) => {
              d.formation = d.formation.filter((x) => x !== id);
              remember(d);
            });
          }
          const cap = s.level >= 160 ? 6 : s.level >= 120 ? 5 : s.level >= 80 ? 4 : s.level >= 45 ? 3 : s.level >= 20 ? 2 : 1;
          if (s.formation.length >= cap) {
            return { ...s, banner: banner("A formação está cheia.", "warn") };
          }
          return patch(
            s,
            (d) => {
              d.formation = [...d.formation, id];
              remember(d);
            },
            { banner: banner("Sombra chamada à formação.", "good") },
          );
        }),
      finishGate: (id, victory) => {
        const gate = gateById(id);
        if (!gate) return { xp: 0, gold: 0, first: false };
        if (!victory) {
          set((s) =>
            patch(s, (d) => {
              pushLog(d, "gate", `Você saiu de ${gate.name} sem recompensa.`);
            }, { banner: banner("O portão se fecha. Sem recompensa.", "warn") }),
          );
          return { xp: 0, gold: 0, first: false };
        }
        const current = get();
        const state = current.gates[id];
        if (state && state.nextAt > Date.now()) return { xp: 0, gold: 0, first: false };
        const first = !state?.cleared;
        let gained = 0;
        let paidXp = 0;
        let paidGold = 0;
        set((s) =>
          patch(s, (d) => {
            const result = grantXp(d, first ? gate.xp : gate.replayXp);
            gained = result.gained;
            paidXp = result.amount;
            paidGold = first ? gate.gold : gate.replayGold;
            d.gold += paidGold;
            d.gates[id] = {
              cleared: true,
              runs: (d.gates[id]?.runs ?? 0) + 1,
              nextAt: Date.now() + gate.cooldownH * 3_600_000,
            };
            for (const sid of d.formation) growShadow(d, sid, 36);
            pushLog(d, "gate", `${gate.name} concluído. +${paidXp} XP, +${paidGold} ouro.`);
          }),
        );
        set((s) => ({ ...s, pendingLevel: s.pendingLevel + gained }));
        return { xp: paidXp, gold: paidGold, first };
      },
      extractShadow: (id) =>
        set((s) => {
          const gate = gateById(id);
          if (!gate || !s.gates[id]?.cleared || s.shadows.some((sh) => sh.id === id)) return s;
          return patch(
            s,
            (d) => {
              d.shadows.push({ id, level: 1, xp: 0, at: Date.now() });
              const cap = d.level >= 160 ? 6 : d.level >= 120 ? 5 : d.level >= 80 ? 4 : d.level >= 45 ? 3 : d.level >= 20 ? 2 : 1;
              if (d.formation.length < cap) d.formation.push(id);
              pushLog(d, "shadow", `${gate.boss} foi extraído. A sombra obedece.`);
              remember(d);
            },
            { banner: banner(`${gate.boss} agora é uma sombra sua.`, "good") },
          );
        }),
      logProof: (rank, amount) =>
        set((s) =>
          patch(s, (d) => {
            const trial = trialFor(rank);
            if (!trial || amount === 0) return;
            const proof = d.proofs[rank] ?? { progress: 0, taskDone: false };
            if (proof.taskDone) return;
            const cap = trial.mode === "time" ? trial.target * 60 : trial.target;
            proof.progress = Math.max(0, Math.min(cap, proof.progress + amount));
            if (proof.progress >= cap) proof.taskDone = true;
            d.proofs[rank] = proof;
          }),
        ),
      winRank: (rank) =>
        set((s) => {
          const trial = trialFor(rank);
          if (!trial || s.rank !== trial.from) return s;
          if (!s.proofs[rank]?.taskDone) return s;
          let gained = 0;
          const next = patch(s, (d) => {
            d.rank = rank;
            const result = grantXp(d, trial.xp);
            gained = result.gained;
            d.gold += trial.gold;
            pushLog(d, "rank", `Rank ${rank === "MONARCH" ? "Monarca" : rank} reconhecido.`);
            remember(d);
          });
          return {
            ...next,
            pendingLevel: s.pendingLevel + gained,
            banner: banner(`Rank ${rank === "MONARCH" ? "Monarca" : rank}.`, "good"),
          };
        }),
      toggleMute: () => set((s) => patch(s, (d) => { d.muted = !d.muted; })),
      importSave: (raw) => {
        try {
          const parsed = JSON.parse(raw) as unknown;
          const save = sanitize(parsed);
          if (!save.awakened || !save.name) return "Arquivo sem um caçador válido.";
          set({ ...save, banner: banner("Progresso restaurado.", "good"), pendingLevel: 0 });
          return null;
        } catch {
          return "Não foi possível ler este arquivo.";
        }
      },
      resetAll: () => set({ ...freshSave(), banner: banner("O Sistema recomeçou.", "warn"), pendingLevel: 0 }),
    }),
    {
      name: "umbra-save-v1",
      storage: createJSONStorage(() => safeStorage),
      partialize: (s) => toSave(s),
      merge: (persisted, current) => {
        const save = sanitize(persisted);
        return { ...current, ...save, banner: null, pendingLevel: 0 };
      },
    },
  ),
);

function missedBanner(s: GameStore, today: string): Partial<Pick<GameStore, "banner">> {
  if (!s.dailiesDate || s.dailiesDate >= today) return {};
  const missed = daysBetween(s.dailiesDate, today) > 1 || !allDailiesDone(s);
  if (!missed) return {};
  return { banner: banner("Fadiga do Sistema. Experiência −10% hoje.", "warn") };
}

export function chime(muted: boolean) {
  if (muted || typeof window === "undefined") return;
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(392, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(784, ctx.currentTime + 0.18);
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.46);
    osc.onended = () => void ctx.close();
  } catch {
    /* autoplay or missing audio */
  }
}

export function downloadSave(data: SaveData) {
  const blob = new Blob([JSON.stringify(toSave({ ...data, version: SAVE_VERSION } as SaveData), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `umbra-${(data.name || "cacador").toLowerCase()}-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}
