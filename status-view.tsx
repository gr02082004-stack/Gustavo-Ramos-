import { useState } from "react";
import { DAILIES } from "@/lib/system/content";
import { derive, forecast, portraitOf, stageLine, stageOf, systemDay, xpToNext } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import { ATTRS, rankLabel, type AttrKey } from "@/lib/system/types";
import { Bar, Btn, Frame } from "@/components/system/ui";

const SHORT: Record<AttrKey, string> = {
  str: "FOR",
  agi: "AGI",
  vit: "VIT",
  int: "INT",
  sen: "SEN",
};

export function StatusView() {
  const save = useGame();
  const addStat = useGame((s) => s.addStat);
  const setName = useGame((s) => s.setName);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(save.name);
  const profile = derive(save);
  const need = xpToNext(save.level);
  const pace = forecast(save);
  const stage = stageOf(save.level);
  const pending = DAILIES.filter((d) => !save.dailies[d.id]?.done).length;
  const src = portraitOf(save.level);

  return (
    <div className="flex flex-col gap-4">
      <Frame>
        <div className="grid gap-4 sm:grid-cols-[12rem_1fr]">
          <div className="relative mx-auto w-44 sm:w-full">
            {stage === "commander" || stage === "monarch" ? (
              <img
                src={src}
                alt=""
                className="portrait-frame absolute inset-0 w-full -translate-x-2 translate-y-1 object-cover opacity-30 blur-sm"
              />
            ) : null}
            <img src={src} alt={`Retrato de ${save.name}`} className="portrait-frame relative z-10 w-full object-cover" />
          </div>
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-display text-xs tracking-widest text-primary">CAÇADOR</p>
                {editing ? (
                  <form
                    className="mt-1 flex gap-2"
                    onSubmit={(event) => {
                      event.preventDefault();
                      setName(draft);
                      setEditing(false);
                    }}
                  >
                    <input
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      maxLength={18}
                      className="min-h-11 w-full border border-border bg-bg px-3 text-fg"
                      aria-label="Nome do caçador"
                    />
                    <Btn type="submit">Salvar</Btn>
                  </form>
                ) : (
                  <button type="button" className="mt-1 text-left" onClick={() => setEditing(true)}>
                    <h1 className="font-display text-3xl">{save.name}</h1>
                  </button>
                )}
                <p className="mt-1 text-sm text-muted">{stageLine(save.level)}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xs tracking-widest text-accent">RANK</p>
                <p className="font-display text-2xl text-accent">{rankLabel(save.rank)}</p>
                <p className="text-xs text-muted tabular-nums">Dia {systemDay(save.createdAt)}</p>
              </div>
            </div>
            <div>
              <div className="mb-1 flex items-end justify-between gap-2">
                <p className="font-display text-lg">Nível {save.level}</p>
                <p className="text-xs text-muted tabular-nums">
                  {save.level >= 200 ? "Teto" : `${save.xp} / ${need} XP`}
                </p>
              </div>
              <Bar value={save.level >= 200 ? 1 : save.xp} max={save.level >= 200 ? 1 : need} />
            </div>
            <dl className="grid grid-cols-4 gap-2 text-center">
              <Mini k="Poder" v={profile.power} />
              <Mini k="Ataque" v={profile.atk} />
              <Mini k="Defesa" v={profile.def} />
              <Mini k="Vida" v={profile.maxHp} />
            </dl>
          </div>
        </div>
      </Frame>

      {pending > 0 ? (
        <p className="border border-border bg-surface px-3 py-3 text-sm text-accent">
          {pending === 1 ? "1 missão diária pendente." : `${pending} missões diárias pendentes.`} O Sistema está observando.
        </p>
      ) : (
        <p className="border border-border bg-surface px-3 py-3 text-sm text-primary">
          Protocolo de hoje completo. Sequência de {save.streak} {save.streak === 1 ? "dia" : "dias"}.
        </p>
      )}

      <Frame>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg">Atributos</h2>
          <p className="text-sm text-accent tabular-nums">
            {save.points > 0 ? `${save.points} pontos livres` : "Sem pontos livres"}
          </p>
        </div>
        <ul className="flex flex-col">
          {ATTRS.map((attr) => {
            const extra = profile.bonus[attr.key];
            return (
              <li key={attr.key} className="flex items-center gap-3 border-b border-border py-2 last:border-0">
                <span className="w-10 font-display text-xs text-primary">{SHORT[attr.key]}</span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm">{attr.label}</span>
                  <span className="block text-xs text-muted">{attr.hint}</span>
                </span>
                <span className="text-lg tabular-nums">
                  {profile.stats[attr.key]}
                  {extra > 0 ? <span className="ml-1 text-xs text-primary">+{extra}</span> : null}
                </span>
                <Btn
                  variant="ghost"
                  className="w-11 px-0"
                  disabled={save.points <= 0}
                  onClick={() => addStat(attr.key)}
                  aria-label={`Aumentar ${attr.label}`}
                >
                  +
                </Btn>
              </li>
            );
          })}
        </ul>
      </Frame>

      {pace ? (
        <Frame>
          <h2 className="font-display text-lg">Ritmo</h2>
          <p className="mt-2 text-sm text-muted">
            Média de {pace.avg} XP por dia. Próximo nível em cerca de {pace.toNext}{" "}
            {pace.toNext === 1 ? "dia" : "dias"}.
            {pace.goal > save.level
              ? ` Nível ${pace.goal} em cerca de ${pace.toGoal} dias, se o ritmo segurar.`
              : ""}
          </p>
        </Frame>
      ) : (
        <p className="text-sm text-muted">O ritmo aparece depois de dois dias com experiência registrada.</p>
      )}
    </div>
  );
}

function Mini({ k, v }: { k: string; v: number }) {
  return (
    <div className="bg-surface-2 px-1 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm font-semibold tabular-nums">{v}</dd>
    </div>
  );
}
