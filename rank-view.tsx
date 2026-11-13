import { useEffect, useState } from "react";
import { TRIALS } from "@/lib/system/content";
import { derive } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import { RANK_ORDER, nextRank, rankLabel, type RankId } from "@/lib/system/types";
import { Bar, Btn, Frame } from "@/components/system/ui";

export function RankView({ onFight }: { onFight: (rank: RankId) => void }) {
  const save = useGame();
  const logProof = useGame((s) => s.logProof);
  const profile = derive(save);
  const upcoming = nextRank(save.rank);
  const trial = TRIALS.find((item) => item.rank === upcoming);
  const proof = upcoming ? save.proofs[upcoming] : undefined;
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!running || !upcoming || trial?.mode !== "time") return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - last) / 1000);
      last = now;
      if (delta > 0) logProof(upcoming, delta);
    }, 1000);
    return () => {
      window.clearInterval(timer);
      const delta = Math.floor((Date.now() - last) / 1000);
      if (delta > 0) logProof(upcoming, delta);
    };
  }, [running, upcoming, trial?.mode, logProof]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-xs tracking-widest text-primary">AVALIAÇÃO</p>
        <h1 className="font-display text-3xl">Rank {rankLabel(save.rank)}</h1>
        <p className="mt-1 text-sm text-muted">
          O rank não sobe com nível. Cada prova mistura um feito real e um duelo contra a sentinela.
        </p>
      </header>
      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {RANK_ORDER.map((rank) => {
          const reached = RANK_ORDER.indexOf(rank) <= RANK_ORDER.indexOf(save.rank);
          return (
            <li
              key={rank}
              className={reached ? "border border-primary px-2 py-3 text-center text-sm text-primary" : "border border-border px-2 py-3 text-center text-sm text-muted"}
            >
              {rankLabel(rank)}
            </li>
          );
        })}
      </ol>
      {trial && upcoming ? (
        <Frame>
          <p className="text-xs tracking-wide text-accent uppercase">Próxima prova · {rankLabel(trial.rank)}</p>
          <h2 className="font-display text-2xl">{trial.name}</h2>
          <p className="mt-1 text-sm text-muted">{trial.detail}</p>
          <ul className="mt-3 flex flex-col gap-1 text-sm">
            <li className={save.level >= trial.minLevel ? "text-primary" : "text-muted"}>
              Nível {save.level} / {trial.minLevel}
            </li>
            <li className={profile.power >= trial.minPower ? "text-primary" : "text-muted"}>
              Poder {profile.power} / {trial.minPower}
            </li>
            {trial.needsStreak ? (
              <li className={save.streak >= trial.needsStreak ? "text-primary" : "text-muted"}>
                Sequência {save.streak} / {trial.needsStreak} dias
              </li>
            ) : null}
          </ul>
          <div className="mt-3">
            <Bar
              value={proof?.progress ?? 0}
              max={trial.mode === "time" ? trial.target * 60 : trial.target}
            />
            <p className="mt-1 text-xs text-muted tabular-nums">
              {trial.mode === "time"
                ? `${Math.floor((proof?.progress ?? 0) / 60)}/${trial.target} min`
                : `${proof?.progress ?? 0}/${trial.target}`}
            </p>
          </div>
          {!proof?.taskDone ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {trial.mode === "reps" ? (
                <>
                  <Btn variant="ghost" onClick={() => logProof(upcoming, 1)}>+1</Btn>
                  <Btn variant="ghost" onClick={() => logProof(upcoming, 10)}>+10</Btn>
                  <Btn variant="ghost" onClick={() => logProof(upcoming, 25)}>+25</Btn>
                </>
              ) : (
                <>
                  <Btn variant={running ? "accent" : "ghost"} onClick={() => setRunning((v) => !v)}>
                    {running ? "Pausar" : "Iniciar timer"}
                  </Btn>
                  <Btn variant="ghost" onClick={() => logProof(upcoming, 60)}>+1 min</Btn>
                  <Btn variant="ghost" onClick={() => logProof(upcoming, 300)}>+5 min</Btn>
                </>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-primary">Feito registrado. A sentinela espera.</p>
          )}
          <Btn
            className="mt-3"
            disabled={
              !proof?.taskDone ||
              save.level < trial.minLevel ||
              profile.power < trial.minPower ||
              (trial.needsStreak ?? 0) > save.streak
            }
            onClick={() => onFight(upcoming)}
          >
            Enfrentar {trial.guardian}
          </Btn>
          <p className="mt-2 text-xs text-muted">
            Vitória: +{trial.xp} XP e {trial.gold} ouro. Se perder, o feito continua válido.
          </p>
        </Frame>
      ) : (
        <Frame>
          <h2 className="font-display text-2xl">Monarca</h2>
          <p className="mt-2 text-sm text-muted">Não há rank acima deste. O nível 200 ainda é outra montanha.</p>
        </Frame>
      )}
    </div>
  );
}
