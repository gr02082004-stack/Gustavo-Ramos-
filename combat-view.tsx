import { useMemo, useRef, useState } from "react";
import { gateById, trialFor } from "@/lib/system/content";
import { foeAct, playerAct, type Actor, type Float, type Line, type SkillId } from "@/lib/system/combat";
import { derive, shadowPower, skillLocks } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import type { FoeStat, RankId } from "@/lib/system/types";
import { rankLabel } from "@/lib/system/types";
import { Bar, Btn, Sigil } from "@/components/system/ui";

export type Run =
  | { kind: "gate"; id: string }
  | { kind: "guardian"; rank: RankId };

interface FoeSeed {
  name: string;
  stat: FoeStat;
  boss: boolean;
}

export function CombatView({ run, onClose }: { run: Run; onClose: () => void }) {
  const save = useGame();
  const finishGate = useGame((s) => s.finishGate);
  const extractShadow = useGame((s) => s.extractShadow);
  const winRank = useGame((s) => s.winRank);
  const consumePotion = useGame((s) => s.consumePotion);
  const profile = derive(save);
  const locks = skillLocks(profile.stats, save.formation.length);
  const foes = useMemo(() => buildFoes(run), [run]);
  const [index, setIndex] = useState(0);
  const [player, setPlayer] = useState<Actor>(() => ({
    name: save.name,
    hp: profile.maxHp,
    maxHp: profile.maxHp,
    mp: profile.maxMp,
    maxMp: profile.maxMp,
    atk: profile.atk,
    def: profile.def,
    agi: profile.stats.agi,
    crit: profile.crit,
    dodge: profile.dodge,
    guard: false,
  }));
  const [foe, setFoe] = useState<Actor>(() => toActor(foes[0]));
  const [lines, setLines] = useState<Line[]>([{ text: `${foes[0].name} bloqueia o caminho.`, tone: "sys" }]);
  const [floats, setFloats] = useState<Float[]>([]);
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState<"you" | "foe" | null>(null);
  const [over, setOver] = useState<"win" | "lose" | null>(null);
  const [reward, setReward] = useState<{ xp: number; gold: number; first: boolean } | null>(null);
  const [extracted, setExtracted] = useState(false);
  const paid = useRef(false);
  const playerRef = useRef(player);
  const foeRef = useRef(foe);
  const foeSeed = foes[index];

  function sync(nextPlayer: Actor, nextFoe: Actor) {
    playerRef.current = nextPlayer;
    foeRef.current = nextFoe;
    setPlayer(nextPlayer);
    setFoe(nextFoe);
  }

  function pushLines(extra: Line[]) {
    setLines((prev) => [...extra, ...prev].slice(0, 6));
  }

  function flash(kind: "you" | "foe", next: Float[]) {
    setFloats(next);
    setShake(kind);
    window.setTimeout(() => setShake(null), 280);
    window.setTimeout(() => setFloats([]), 700);
  }

  function conclude(victory: boolean) {
    if (paid.current) return;
    paid.current = true;
    if (!victory) {
      if (run.kind === "gate") finishGate(run.id, false);
      setOver("lose");
      return;
    }
    if (run.kind === "gate") setReward(finishGate(run.id, true));
    else {
      winRank(run.rank);
      const trial = trialFor(run.rank);
      setReward({ xp: trial?.xp ?? 0, gold: trial?.gold ?? 0, first: false });
    }
    setOver("win");
  }

  function advance(from: number) {
    const next = from + 1;
    if (next >= foes.length) {
      conclude(true);
      return;
    }
    window.setTimeout(() => {
      const born = toActor(foes[next]);
      setIndex(next);
      sync(playerRef.current, born);
      pushLines([{ text: foes[next].boss ? `${foes[next].name} entra.` : `${foes[next].name} avança.`, tone: "sys" }]);
      setBusy(false);
    }, 550);
  }

  function enemyResponse() {
    window.setTimeout(() => {
      const step = foeAct(playerRef.current, foeRef.current);
      sync(step.player, step.foe);
      pushLines(step.lines);
      if (step.floats.length) flash("you", step.floats);
      setBusy(false);
      if (step.playerDead) conclude(false);
    }, 460);
  }

  function act(skill: SkillId) {
    if (busy || over) return;
    const potion = skill === "potion" ? consumePotion() : 0;
    if (skill === "potion" && potion <= 0) {
      pushLines([{ text: "Sem frascos.", tone: "sys" }]);
      return;
    }
    const step = playerAct(playerRef.current, foeRef.current, skill, {
      shadowPower: shadowPower(save),
      potion,
    });
    sync(step.player, step.foe);
    pushLines(step.lines);
    if (step.floats.length) flash("foe", step.floats);
    if (step.playerDead) {
      conclude(false);
      return;
    }
    if (step.foeDead) {
      setBusy(true);
      advance(index);
      return;
    }
    if (step.lines.some((line) => line.text === "Mana insuficiente." || line.text === "Sem frascos.")) return;
    setBusy(true);
    enemyResponse();
  }

  const title = run.kind === "gate" ? gateById(run.id)?.name ?? "Portão" : `Prova ${rankLabel(run.rank)}`;
  const owned = run.kind === "gate" && save.shadows.some((s) => s.id === run.id);

  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-bg">
      <div className={`mx-auto flex h-full w-full max-w-lg flex-col gap-4 overflow-y-auto px-4 py-4 ${shake === "you" ? "hit-flash" : ""}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-display text-xs tracking-widest text-primary">{title}</p>
            <h2 className="font-display text-2xl">{foeSeed?.boss ? "Chefe" : `Lacaio ${index + 1}`}</h2>
          </div>
          <Btn variant="quiet" onClick={() => { if (!over) conclude(false); onClose(); }}>
            Recuar
          </Btn>
        </div>

        <div className={`relative mx-auto h-52 w-52 ${shake === "foe" ? "hit-flash" : ""}`}>
          <Sigil seed={foe.name} gold={Boolean(foeSeed?.boss)} />
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center">
            {floats.map((item, i) => (
              <span key={`${item.text}-${i}`} className={item.tone === "heal" ? "font-display text-2xl text-primary" : "font-display text-3xl text-accent"}>
                {item.tone === "crit" ? `CRÍT ${item.text}` : item.text}
              </span>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>{foe.name}</span>
            <span className="tabular-nums">{foe.hp} / {foe.maxHp}</span>
          </div>
          <Bar value={foe.hp} max={foe.maxHp} tone="accent" />
        </div>
        <div>
          <div className="mb-1 flex justify-between text-sm">
            <span>{player.name}</span>
            <span className="tabular-nums">Vida {player.hp} · Mana {player.mp}</span>
          </div>
          <Bar value={player.hp} max={player.maxHp} />
          <div className="mt-2">
            <Bar value={player.mp} max={player.maxMp} tone="accent" />
          </div>
        </div>

        <ul className="flex min-h-16 flex-col gap-1">
          {lines.map((line, i) => (
            <li key={`${line.text}-${i}`} className={line.tone === "foe" ? "text-sm text-accent" : line.tone === "heal" ? "text-sm text-primary" : "text-sm text-muted"}>
              {line.text}
            </li>
          ))}
        </ul>

        {over === null ? (
          <div className="mt-auto grid grid-cols-2 gap-2 pb-2">
            <Btn onClick={() => act("strike")}>Atacar</Btn>
            <Btn variant="ghost" onClick={() => act("guard")}>Postura</Btn>
            <Btn variant="ghost" disabled={!locks.impact || player.mp < 7} onClick={() => act("impact")}>
              {locks.impact ? "Impacto" : "Impacto · Força 16"}
            </Btn>
            <Btn variant="ghost" disabled={!locks.flurry || player.mp < 8} onClick={() => act("flurry")}>
              {locks.flurry ? "Lâmina veloz" : "Lâmina · Agilidade 16"}
            </Btn>
            <Btn variant="ghost" disabled={!locks.arcane || player.mp < 10} onClick={() => act("arcane")}>
              {locks.arcane ? "Corte arcano" : "Arcano · Inteligência 16"}
            </Btn>
            <Btn variant="ghost" disabled={!locks.breath || player.mp < 8} onClick={() => act("breath")}>
              {locks.breath ? "Segundo fôlego" : "Fôlego · Vitalidade 14"}
            </Btn>
            <Btn variant="ghost" disabled={!locks.shadow || player.mp < 12} onClick={() => act("shadow")}>
              {locks.shadow ? "Comando: sombra" : "Sombra · formação"}
            </Btn>
            <Btn variant="accent" disabled={save.potions <= 0} onClick={() => act("potion")}>
              Frasco ({save.potions})
            </Btn>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-3 pb-4">
            <FrameLike over={over} reward={reward} />
            {over === "win" && run.kind === "gate" && reward?.first && !owned && !extracted ? (
              <Btn
                variant="accent"
                onClick={() => {
                  extractShadow(run.id);
                  setExtracted(true);
                }}
              >
                Extrair sombra de {gateById(run.id)?.boss}
              </Btn>
            ) : null}
            {extracted ? <p className="text-sm text-primary">A sombra obedece.</p> : null}
            <Btn onClick={onClose}>{over === "win" ? "Voltar" : "Levantar"}</Btn>
          </div>
        )}
      </div>
    </div>
  );
}

function FrameLike({
  over,
  reward,
}: {
  over: "win" | "lose";
  reward: { xp: number; gold: number; first: boolean } | null;
}) {
  if (over === "lose") {
    return (
      <div>
        <h3 className="font-display text-2xl">O portão expele você</h3>
        <p className="text-sm text-muted">Sem experiência. Treine, equipe e volte.</p>
      </div>
    );
  }
  return (
    <div>
      <h3 className="font-display text-2xl">Portão concluído</h3>
      <p className="text-sm text-muted tabular-nums">
        +{reward?.xp ?? 0} XP · +{reward?.gold ?? 0} ouro
        {reward?.first ? " · primeira clara" : ""}
      </p>
    </div>
  );
}

function buildFoes(run: Run): FoeSeed[] {
  if (run.kind === "guardian") {
    const trial = trialFor(run.rank);
    return [{ name: trial?.guardian ?? "Sentinela", stat: trial?.foe ?? { hp: 80, atk: 12, def: 3, agi: 6 }, boss: true }];
  }
  const gate = gateById(run.id);
  if (!gate) return [{ name: "Eco", stat: { hp: 40, atk: 8, def: 1, agi: 4 }, boss: false }];
  return [
    { name: gate.minions[0], stat: gate.minion, boss: false },
    { name: gate.minions[1], stat: gate.elite, boss: false },
    { name: gate.boss, stat: gate.bossStat, boss: true },
  ];
}

function toActor(seed: FoeSeed): Actor {
  return {
    name: seed.name,
    hp: seed.stat.hp,
    maxHp: seed.stat.hp,
    mp: 0,
    maxMp: 0,
    atk: seed.stat.atk,
    def: seed.stat.def,
    agi: seed.stat.agi,
    crit: seed.boss ? 0.1 : 0.04,
    dodge: 0.02,
    guard: false,
  };
}
