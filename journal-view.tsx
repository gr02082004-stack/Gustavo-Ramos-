import { useRef, useState } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { derive, formatWhen, systemDay } from "@/lib/system/formulas";
import { downloadSave, useGame } from "@/lib/system/store";
import { Btn, Field, Frame, fieldClass } from "@/components/system/ui";

export function JournalView() {
  const save = useGame();
  const toggleMute = useGame((s) => s.toggleMute);
  const importSave = useGame((s) => s.importSave);
  const resetAll = useGame((s) => s.resetAll);
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const profile = derive(save);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-xs tracking-widest text-primary">REGISTRO</p>
        <h1 className="font-display text-3xl">Diário</h1>
        <p className="mt-1 text-sm text-muted">
          Dia {systemDay(save.createdAt)} · {save.totalQuests} missões entregues · poder {profile.power}
        </p>
      </header>

      <Frame>
        <h2 className="font-display text-xl">Poder</h2>
        {save.history.length < 2 ? (
          <p className="mt-2 text-sm text-muted">O gráfico nasce no segundo dia, quando houver com o que comparar.</p>
        ) : (
          <div className="mt-3 h-40">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={save.history}>
                <XAxis dataKey="d" hide />
                <Tooltip
                  contentStyle={{
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-border)",
                    color: "var(--color-fg)",
                  }}
                  formatter={(value) => [String(value), "Poder"]}
                  labelFormatter={(label) => String(label)}
                />
                <Area dataKey="pw" stroke="var(--color-primary)" fill="var(--color-primary)" fillOpacity={0.2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Frame>

      <Frame>
        <h2 className="font-display text-xl">Como o Sistema funciona</h2>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted">
          <li>Cinco missões de corpo renovam à meia-noite. Completar as cinco mantém a sequência.</li>
          <li>Falhar um dia zera a sequência e reduz a experiência do dia seguinte em 10%.</li>
          <li>Cada nível dá 3 pontos. Eles não voltam atrás.</li>
          <li>A cada sequência do mesmo treino, o atributo daquele protocolo sobe 1.</li>
          <li>Portões têm dois lacaios e um chefe. A primeira vitória libera a sombra.</li>
          <li>O rank sobe por prova real e duelo, não só por nível.</li>
          <li>Tudo fica neste aparelho. Exporte um backup de vez em quando.</li>
        </ul>
      </Frame>

      <Frame>
        <h2 className="font-display text-xl">Backup</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <Btn onClick={() => downloadSave(save)}>Exportar</Btn>
          <Btn variant="ghost" onClick={() => fileRef.current?.click()}>Importar</Btn>
          <Btn variant="ghost" onClick={toggleMute}>{save.muted ? "Som off" : "Som on"}</Btn>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) return;
            const text = await file.text();
            setError(importSave(text));
          }}
        />
        {error ? <p className="mt-2 text-sm text-accent">{error}</p> : null}
      </Frame>

      <Frame>
        <h2 className="font-display text-xl">Recomeçar</h2>
        <p className="mt-1 text-sm text-muted">Apaga nível, sombras, ouro e missões deste aparelho.</p>
        <form
          className="mt-3 flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (confirm.trim() === save.name) resetAll();
          }}
        >
          <Field label={`Digite ${save.name} para confirmar`}>
            <input className={fieldClass} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </Field>
          <Btn type="submit" variant="ghost" disabled={confirm.trim() !== save.name}>
            Apagar progresso
          </Btn>
        </form>
      </Frame>

      <Frame>
        <h2 className="font-display text-xl">Linha do tempo</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {save.log.length === 0 ? <li className="text-sm text-muted">Nada ainda.</li> : null}
          {save.log.map((entry) => (
            <li key={entry.id} className="border-b border-border pb-2 last:border-0">
              <p className="text-sm">{entry.text}</p>
              <p className="text-xs text-muted">{formatWhen(entry.at)}</p>
            </li>
          ))}
        </ul>
      </Frame>
    </div>
  );
}
