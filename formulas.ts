import { GATES, itemById, shadowById } from "@/lib/system/content";
import {
  ATTRS,
  MAX_LEVEL,
  emptyBonus,
  type AttrKey,
  type Bonus,
  type SaveData,
} from "@/lib/system/types";

export function xpToNext(level: number) {
  if (level >= MAX_LEVEL) return 0;
  return Math.round(22 + Math.pow(level, 1.38) * 4.2);
}

export function todayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string) {
  const da = new Date(`${a}T00:00:00`);
  const db = new Date(`${b}T00:00:00`);
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}

export function systemDay(createdAt: number) {
  if (!createdAt) return 1;
  const start = new Date(createdAt);
  start.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.max(1, Math.round((now.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function formatRemain(ms: number) {
  if (ms <= 0) return "aberto";
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 48) return `${Math.ceil(h / 24)} dias`;
  if (h > 0) return `${h}h ${m}m`;
  return `${Math.max(1, m)} min`;
}

export function formatWhen(at: number) {
  const diff = Date.now() - at;
  if (diff < 60_000) return "agora";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} h`;
  return new Date(at).toLocaleDateString("pt-BR");
}

export function formationCap(level: number) {
  if (level >= 160) return 6;
  if (level >= 120) return 5;
  if (level >= 80) return 4;
  if (level >= 45) return 3;
  if (level >= 20) return 2;
  return 1;
}

export function stageOf(level: number): "recruit" | "awakened" | "commander" | "monarch" {
  if (level >= 140) return "monarch";
  if (level >= 80) return "commander";
  if (level >= 25) return "awakened";
  return "recruit";
}

export function portraitOf(level: number) {
  return stageOf(level) === "recruit" ? "/art/hunter-1.jpg" : "/art/hunter-2.jpg";
}

export function stageLine(level: number) {
  const stage = stageOf(level);
  if (stage === "monarch") return "Presença de monarca";
  if (stage === "commander") return "Comandante de sombras";
  if (stage === "awakened") return "O Sistema reconhece você";
  return "Ainda no começo";
}

export function shadowNeed(level: number) {
  return 60 + level * 40;
}

export function gateUnlocked(save: SaveData, id: string) {
  const index = GATES.findIndex((g) => g.id === id);
  if (index <= 0) return true;
  return Boolean(save.gates[GATES[index - 1].id]?.cleared);
}

function addPartial(bonus: Bonus, partial: Partial<Bonus>, scale = 1) {
  for (const key of Object.keys(partial) as (keyof Bonus)[]) {
    bonus[key] += Math.round((partial[key] ?? 0) * scale);
  }
}

export interface Derived {
  stats: Record<AttrKey, number>;
  bonus: Bonus;
  maxHp: number;
  atk: number;
  def: number;
  crit: number;
  dodge: number;
  maxMp: number;
  power: number;
}

export function derive(save: SaveData): Derived {
  const bonus = emptyBonus();
  for (const id of Object.values(save.equipment)) {
    if (!id) continue;
    const item = itemById(id);
    if (item) addPartial(bonus, item.bonus);
  }
  for (const id of save.formation) {
    const owned = save.shadows.find((s) => s.id === id);
    const def = shadowById(id);
    if (!owned || !def) continue;
    const scale = 1 + (owned.level - 1) * 0.06;
    addPartial(bonus, def.bonus, scale);
    bonus.atk += Math.round(def.atk * scale);
  }
  const stats = {
    str: save.stats.str + bonus.str,
    agi: save.stats.agi + bonus.agi,
    vit: save.stats.vit + bonus.vit,
    int: save.stats.int + bonus.int,
    sen: save.stats.sen + bonus.sen,
  };
  const maxHp = 48 + stats.vit * 5 + save.level * 3 + bonus.hp;
  const atk = Math.round(6 + stats.str * 1.25 + stats.agi * 0.12 + bonus.atk);
  const def = Math.round(2 + stats.vit * 0.55 + bonus.def);
  const crit = Math.min(0.4, 0.05 + stats.agi * 0.0032 + stats.sen * 0.0022);
  const dodge = Math.min(0.2, stats.agi * 0.0022 + stats.sen * 0.0012);
  const maxMp = 14 + stats.int * 2;
  const sum = stats.str + stats.agi + stats.vit + stats.int + stats.sen;
  const power = Math.round(save.level * 12 + sum * 2 + atk + def);
  return { stats, bonus, maxHp, atk, def, crit, dodge, maxMp, power };
}

export function shadowPower(save: SaveData) {
  let total = 0;
  for (const id of save.formation) {
    const owned = save.shadows.find((s) => s.id === id);
    const def = shadowById(id);
    if (!owned || !def) continue;
    total += Math.round((def.atk + 4) * (1 + (owned.level - 1) * 0.08));
  }
  return total;
}

export function forecast(save: SaveData) {
  const days = Object.entries(save.xpLog)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-7);
  if (days.length < 2) return null;
  const avg = days.reduce((sum, [, value]) => sum + value, 0) / days.length;
  if (avg <= 1) return null;
  const need = xpToNext(save.level);
  const toNext = save.level >= MAX_LEVEL ? 0 : Math.max(1, Math.ceil((need - save.xp) / avg));
  let xp = save.xp;
  let level = save.level;
  let spent = 0;
  const goal = Math.min(MAX_LEVEL, level + 10);
  let guard = 0;
  while (level < goal && guard < 8000) {
    const stepNeed = xpToNext(level) - xp;
    const daysNeeded = Math.max(1, Math.ceil(stepNeed / avg));
    spent += daysNeeded;
    xp = xp + daysNeeded * avg - xpToNext(level);
    level += 1;
    guard += 1;
  }
  return { avg: Math.round(avg), toNext, toGoal: spent, goal };
}

export function skillLocks(stats: Record<AttrKey, number>, shadows: number) {
  return {
    impact: stats.str >= 16,
    flurry: stats.agi >= 16,
    arcane: stats.int >= 16,
    breath: stats.vit >= 14,
    shadow: shadows > 0,
  };
}

export function attrLabel(key: AttrKey) {
  return ATTRS.find((a) => a.key === key)?.label ?? key;
}
