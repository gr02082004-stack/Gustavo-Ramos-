import { useEffect, useState } from "react";
import { GATES } from "@/lib/system/content";
import { formatRemain, gateUnlocked } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import { rankLabel } from "@/lib/system/types";
import { Btn, Frame, Sigil } from "@/components/system/ui";

export function GatesView({ onEnter }: { onEnter: (id: string) => void }) {
  const save = useGame();
  const [warn, setWarn] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-xs tracking-widest text-primary">PORTÕES</p>
        <h1 className="font-display text-3xl">Fendas</h1>
        <p className="mt-1 text-sm text-muted">
          Dois lacaios e um chefe. A primeira vitória deixa a sombra disponível para extração.
        </p>
      </header>
      <div className="rift" aria-hidden>
        <div className="rift-core" />
      </div>
      <ul className="flex flex-col gap-3">
        {GATES.map((gate) => {
          const open = gateUnlocked(save, gate.id);
          const state = save.gates[gate.id];
          const wait = (state?.nextAt ?? 0) - now;
          const owned = save.shadows.some((s) => s.id === gate.id);
          const low = save.level < gate.minLevel;
          return (
            <li key={gate.id}>
              <Frame>
                <div className="flex gap-3">
                  <div className="h-20 w-20 shrink-0">
                    <Sigil seed={gate.boss} gold={gate.rank === "MONARCH" || gate.rank === "SSS"} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs tracking-wide text-accent uppercase">
                      Rank {rankLabel(gate.rank)} · nível {gate.minLevel}
                    </p>
                    <h2 className="font-display text-xl">{gate.name}</h2>
                    <p className="text-sm text-muted">{gate.place}</p>
                    <p className="mt-1 text-sm">
                      Chefe: {gate.boss}, {gate.title}
                    </p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-muted">{gate.line}</p>
                <p className="mt-2 text-xs text-muted tabular-nums">
                  Primeira clara {gate.xp} XP · {gate.gold} ouro. Repetição {gate.replayXp} XP · espera {gate.cooldownH}h.
                  {owned ? " Sombra extraída." : state?.cleared ? " Sombra ainda espera." : ""}
                </p>
                {!open ? (
                  <p className="mt-3 text-sm text-accent">Feche o portão anterior para a fenda abrir.</p>
                ) : wait > 0 ? (
                  <p className="mt-3 text-sm text-muted">Fechado por {formatRemain(wait)}.</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Btn
                      onClick={() => {
                        if (low) setWarn(gate.id);
                        else onEnter(gate.id);
                      }}
                    >
                      Invadir
                    </Btn>
                    {state?.cleared && !owned ? (
                      <Extract id={gate.id} name={gate.boss} />
                    ) : null}
                  </div>
                )}
                {warn === gate.id ? (
                  <div className="mt-3 border border-border p-3">
                    <p className="text-sm">
                      Seu nível está abaixo do recomendado. O chefe pode expulsar você.
                    </p>
                    <div className="mt-2 flex gap-2">
                      <Btn onClick={() => { setWarn(null); onEnter(gate.id); }}>Entrar mesmo assim</Btn>
                      <Btn variant="ghost" onClick={() => setWarn(null)}>Cancelar</Btn>
                    </div>
                  </div>
                ) : null}
              </Frame>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Extract({ id, name }: { id: string; name: string }) {
  const extractShadow = useGame((s) => s.extractShadow);
  return (
    <Btn variant="accent" onClick={() => extractShadow(id)}>
      Extrair {name}
    </Btn>
  );
}
