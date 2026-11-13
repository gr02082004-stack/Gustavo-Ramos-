import { useEffect, useState } from "react";
import { CUSTOM_TEMPLATES, DAILIES } from "@/lib/system/content";
import { attrLabel, todayKey } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import type { AttrKey } from "@/lib/system/types";
import { Bar, Btn, Field, Frame, fieldClass } from "@/components/system/ui";

export function QuestsView() {
  const save = useGame();
  const logDaily = useGame((s) => s.logDaily);
  const completeDaily = useGame((s) => s.completeDaily);
  const addCustom = useGame((s) => s.addCustom);
  const logCustom = useGame((s) => s.logCustom);
  const removeCustom = useGame((s) => s.removeCustom);
  const [open, setOpen] = useState<string | null>(DAILIES[0]?.id ?? null);
  const [running, setRunning] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [xp, setXp] = useState(40);
  const [attr, setAttr] = useState<AttrKey | "">("");
  const [repeat, setRepeat] = useState<"diaria" | "unica">("diaria");
  const today = todayKey();

  useEffect(() => {
    if (!running) return;
    let last = Date.now();
    const timer = window.setInterval(() => {
      const now = Date.now();
      const delta = Math.floor((now - last) / 1000);
      last = now;
      if (delta > 0) logDaily(running, delta);
    }, 1000);
    const onHide = () => {
      if (document.visibilityState === "hidden") {
        const now = Date.now();
        const delta = Math.floor((now - last) / 1000);
        last = now;
        if (delta > 0) logDaily(running, delta);
      }
    };
    document.addEventListener("visibilitychange", onHide);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      const now = Date.now();
      const delta = Math.floor((now - last) / 1000);
      if (delta > 0) logDaily(running, delta);
    };
  }, [running, logDaily]);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-xs tracking-widest text-primary">PROTOCOLO</p>
        <h1 className="font-display text-3xl">Missões</h1>
        <p className="mt-1 text-sm text-muted">
          As cinco de corpo são obrigatórias. Pessoais rendem experiência, no máximo quatro por dia.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {DAILIES.map((mission) => {
          const row = save.dailies[mission.id];
          const current = row?.current ?? 0;
          const done = Boolean(row?.done);
          const max = mission.mode === "time" ? mission.target * 60 : mission.target;
          const shown = mission.mode === "time" ? Math.floor(current / 60) : current;
          const ready = current >= max;
          const expanded = open === mission.id;
          return (
            <Frame key={mission.id} className={done ? "opacity-80" : undefined}>
              <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={() => setOpen(expanded ? null : mission.id)}>
                <span>
                  <span className="block text-xs tracking-wide text-accent uppercase">Obrigatória · +{mission.xp} XP</span>
                  <span className="mt-1 block font-display text-xl">{mission.name}</span>
                </span>
                <span className="text-sm tabular-nums text-muted">
                  {done ? "Feita" : `${Math.min(shown, mission.target)}/${mission.target}${mission.mode === "time" ? " min" : ""}`}
                </span>
              </button>
              <div className="mt-3">
                <Bar value={Math.min(current, max)} max={max} tone={done ? "accent" : "primary"} />
              </div>
              {expanded ? (
                <div className="mt-3 flex flex-col gap-3">
                  <p className="text-sm text-muted">{mission.detail}</p>
                  {done ? (
                    <p className="text-sm text-primary">Entregue. O atributo treinado sobe a cada sequência deste protocolo.</p>
                  ) : (
                    <>
                      <div className="flex flex-wrap gap-2">
                        {mission.mode === "reps" ? (
                          <>
                            <Btn variant="ghost" onClick={() => logDaily(mission.id, -1)}>-1</Btn>
                            <Btn variant="ghost" onClick={() => logDaily(mission.id, 1)}>+1</Btn>
                            <Btn variant="ghost" onClick={() => logDaily(mission.id, 5)}>+5</Btn>
                            <Btn variant="ghost" onClick={() => logDaily(mission.id, 10)}>+10</Btn>
                          </>
                        ) : (
                          <>
                            <Btn variant={running === mission.id ? "accent" : "ghost"} onClick={() => setRunning(running === mission.id ? null : mission.id)}>
                              {running === mission.id ? "Pausar timer" : "Iniciar timer"}
                            </Btn>
                            <Btn variant="ghost" onClick={() => logDaily(mission.id, 60)}>+1 min</Btn>
                            <Btn variant="ghost" onClick={() => logDaily(mission.id, 300)}>+5 min</Btn>
                          </>
                        )}
                      </div>
                      <Btn disabled={!ready} onClick={() => completeDaily(mission.id)} data-testid={`done-${mission.id}`}>
                        Entregar missão
                      </Btn>
                    </>
                  )}
                </div>
              ) : null}
            </Frame>
          );
        })}
      </div>

      <Frame>
        <h2 className="font-display text-xl">Missão pessoal</h2>
        <p className="mt-1 text-sm text-muted">
          {save.customDoneToday}/4 concluídas hoje. A experiência é limitada para a subida continuar difícil.
        </p>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            addCustom({ title, detail, xp, attr: attr || null, repeat });
            setTitle("");
            setDetail("");
          }}
        >
          <Field label="Título">
            <input className={fieldClass} value={title} maxLength={48} onChange={(e) => setTitle(e.target.value)} required />
          </Field>
          <Field label="Detalhe">
            <input className={fieldClass} value={detail} maxLength={160} onChange={(e) => setDetail(e.target.value)} />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={`Experiência ${xp}`}>
              <input className={fieldClass} type="range" min={15} max={80} value={xp} onChange={(e) => setXp(Number(e.target.value))} />
            </Field>
            <Field label="Atributo">
              <select className={fieldClass} value={attr} onChange={(e) => setAttr(e.target.value as AttrKey | "")}>
                <option value="">Nenhum</option>
                <option value="str">Força</option>
                <option value="agi">Agilidade</option>
                <option value="vit">Vitalidade</option>
                <option value="int">Inteligência</option>
                <option value="sen">Sentido</option>
              </select>
            </Field>
            <Field label="Repetição">
              <select className={fieldClass} value={repeat} onChange={(e) => setRepeat(e.target.value as "diaria" | "unica")}>
                <option value="diaria">Diária</option>
                <option value="unica">Única</option>
              </select>
            </Field>
          </div>
          <div className="flex flex-wrap gap-2">
            {CUSTOM_TEMPLATES.map((tpl) => (
              <button
                key={tpl.title}
                type="button"
                className="min-h-11 border border-border px-3 text-xs text-muted"
                onClick={() => {
                  setTitle(tpl.title);
                  setDetail(tpl.detail);
                  setXp(tpl.xp);
                  setAttr(tpl.attr ?? "");
                }}
              >
                {tpl.title}
              </button>
            ))}
          </div>
          <Btn type="submit">Criar missão</Btn>
        </form>
      </Frame>

      <ul className="flex flex-col gap-3">
        {save.customs.map((mission) => {
          const done = mission.repeat === "diaria" ? mission.doneDates.includes(today) : mission.doneDates.length > 0;
          return (
            <li key={mission.id}>
              <Frame>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-wide text-primary uppercase">
                      {mission.repeat === "diaria" ? "Diária" : "Única"} · {mission.xp} XP
                      {mission.attr ? ` · ${attrLabel(mission.attr)}` : ""}
                    </p>
                    <h3 className="font-display text-xl">{mission.title}</h3>
                    {mission.detail ? <p className="mt-1 text-sm text-muted">{mission.detail}</p> : null}
                  </div>
                  <Btn variant="quiet" onClick={() => removeCustom(mission.id)} aria-label={`Apagar ${mission.title}`}>
                    Apagar
                  </Btn>
                </div>
                <Btn className="mt-3" disabled={done} onClick={() => logCustom(mission.id)}>
                  {done ? "Concluída" : "Concluir"}
                </Btn>
              </Frame>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
