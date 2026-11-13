export interface Actor {
  name: string;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  agi: number;
  crit: number;
  dodge: number;
  guard: boolean;
}

export interface Line {
  text: string;
  tone: "you" | "foe" | "heal" | "sys";
}

export interface Float {
  text: string;
  tone: "dmg" | "heal" | "crit";
}

export interface Step {
  player: Actor;
  foe: Actor;
  lines: Line[];
  floats: Float[];
  foeDead: boolean;
  playerDead: boolean;
}

export type SkillId = "strike" | "impact" | "flurry" | "arcane" | "breath" | "guard" | "shadow" | "potion";

function clone(actor: Actor): Actor {
  return { ...actor };
}

function hit(atk: number, def: number, critChance: number, mult = 1, ignore = 0) {
  const base = Math.max(1, atk * mult - def * (1 - ignore) * 0.42);
  const crit = Math.random() < critChance;
  const variance = 0.92 + Math.random() * 0.16;
  const d = Math.max(1, Math.round(base * (crit ? 1.7 : 1) * variance));
  return { d, crit };
}

function done(player: Actor, foe: Actor, lines: Line[], floats: Float[]): Step {
  return {
    player,
    foe,
    lines,
    floats,
    foeDead: foe.hp <= 0,
    playerDead: player.hp <= 0,
  };
}

export function playerAct(
  playerIn: Actor,
  foeIn: Actor,
  skill: SkillId,
  extras: { shadowPower: number; potion: number },
): Step {
  const player = clone(playerIn);
  const foe = clone(foeIn);
  const lines: Line[] = [];
  const floats: Float[] = [];

  const pay = (cost: number) => {
    if (player.mp < cost) {
      lines.push({ text: "Mana insuficiente.", tone: "sys" });
      return false;
    }
    player.mp -= cost;
    return true;
  };

  const strike = (mult: number, ignore = 0, label = "Golpe") => {
    const blow = hit(player.atk, foe.def, player.crit, mult, ignore);
    foe.hp = Math.max(0, foe.hp - blow.d);
    floats.push({ text: String(blow.d), tone: blow.crit ? "crit" : "dmg" });
    lines.push({
      text: blow.crit ? `${label} crítico. ${blow.d}.` : `${label}. ${blow.d}.`,
      tone: "you",
    });
  };

  if (skill === "guard") {
    player.guard = true;
    lines.push({ text: "Você fecha a guarda.", tone: "sys" });
    return done(player, foe, lines, floats);
  }

  if (skill === "breath") {
    if (!pay(8)) return done(player, foe, lines, floats);
    const heal = Math.round(player.maxHp * 0.28);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    floats.push({ text: `+${heal}`, tone: "heal" });
    lines.push({ text: `Segundo fôlego. +${heal} de vida.`, tone: "heal" });
    return done(player, foe, lines, floats);
  }

  if (skill === "potion") {
    if (extras.potion <= 0) {
      lines.push({ text: "Sem frascos.", tone: "sys" });
      return done(player, foe, lines, floats);
    }
    player.hp = Math.min(player.maxHp, player.hp + extras.potion);
    floats.push({ text: `+${extras.potion}`, tone: "heal" });
    lines.push({ text: `Frasco. +${extras.potion} de vida.`, tone: "heal" });
    return done(player, foe, lines, floats);
  }

  if (skill === "impact") {
    if (!pay(7)) return done(player, foe, lines, floats);
    strike(1.55, 0, "Impacto");
    return done(player, foe, lines, floats);
  }

  if (skill === "flurry") {
    if (!pay(8)) return done(player, foe, lines, floats);
    let total = 0;
    let crits = 0;
    for (let i = 0; i < 3; i += 1) {
      const blow = hit(player.atk, foe.def, player.crit, 0.48);
      total += blow.d;
      if (blow.crit) crits += 1;
      foe.hp = Math.max(0, foe.hp - blow.d);
      if (foe.hp <= 0) break;
    }
    floats.push({ text: String(total), tone: crits ? "crit" : "dmg" });
    lines.push({ text: `Lâmina veloz. ${total}.`, tone: "you" });
    return done(player, foe, lines, floats);
  }

  if (skill === "arcane") {
    if (!pay(10)) return done(player, foe, lines, floats);
    strike(1.35, 0.35, "Corte arcano");
    return done(player, foe, lines, floats);
  }

  if (skill === "shadow") {
    if (!pay(12)) return done(player, foe, lines, floats);
    const blow = hit(player.atk + extras.shadowPower * 0.45, foe.def, player.crit, 1.1);
    foe.hp = Math.max(0, foe.hp - blow.d);
    const heal = Math.round(player.maxHp * 0.08);
    player.hp = Math.min(player.maxHp, player.hp + heal);
    floats.push({ text: String(blow.d), tone: blow.crit ? "crit" : "dmg" });
    lines.push({ text: `A sombra ataca. ${blow.d}. +${heal} de vida.`, tone: "you" });
    return done(player, foe, lines, floats);
  }

  strike(1, 0, "Ataque");
  return done(player, foe, lines, floats);
}

export function foeAct(playerIn: Actor, foeIn: Actor): Step {
  const player = clone(playerIn);
  const foe = clone(foeIn);
  const lines: Line[] = [];
  const floats: Float[] = [];
  if (foe.hp <= 0 || player.hp <= 0) return done(player, foe, lines, floats);
  if (Math.random() < player.dodge) {
    lines.push({ text: `${foe.name} erra.`, tone: "sys" });
    return done(player, foe, lines, floats);
  }
  let blow = hit(foe.atk, player.def, foe.crit);
  if (player.guard) {
    blow = { d: Math.max(1, Math.round(blow.d * 0.5)), crit: blow.crit };
    player.guard = false;
    lines.push({ text: `A guarda absorve parte do golpe. ${blow.d}.`, tone: "foe" });
  } else {
    lines.push({
      text: blow.crit ? `${foe.name} acerta em cheio. ${blow.d}.` : `${foe.name} atinge você. ${blow.d}.`,
      tone: "foe",
    });
  }
  player.hp = Math.max(0, player.hp - blow.d);
  floats.push({ text: String(blow.d), tone: blow.crit ? "crit" : "dmg" });
  return done(player, foe, lines, floats);
}

export function playerFirst(player: Actor, foe: Actor) {
  return player.agi >= foe.agi;
}
