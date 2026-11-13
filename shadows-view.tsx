import { SHADOWS } from "@/lib/system/content";
import { formationCap, shadowNeed } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import { rankLabel } from "@/lib/system/types";
import { Btn, Frame, Sigil } from "@/components/system/ui";

export function ShadowsView() {
  const save = useGame();
  const toggle = useGame((s) => s.toggleFormation);
  const cap = formationCap(save.level);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-xs tracking-widest text-primary">EXÉRCITO</p>
        <h1 className="font-display text-3xl">Sombras</h1>
        <p className="mt-1 text-sm text-muted">
          Formação {save.formation.length}/{cap}. Sombras em formação somam atributos e podem ser chamadas no combate.
        </p>
      </header>
      <ul className="grid gap-3 sm:grid-cols-2">
        {SHADOWS.map((shadow) => {
          const owned = save.shadows.find((s) => s.id === shadow.id);
          const active = save.formation.includes(shadow.id);
          return (
            <li key={shadow.id}>
              <Frame className={owned ? undefined : "opacity-70"}>
                <div className="flex gap-3">
                  <div className="h-24 w-24 shrink-0">
                    <Sigil seed={shadow.name} gold={shadow.rank === "MONARCH" || shadow.rank === "SSS"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs tracking-wide text-accent uppercase">Rank {rankLabel(shadow.rank)}</p>
                    <h2 className="font-display text-xl">{owned ? shadow.name : "Desconhecida"}</h2>
                    <p className="text-sm text-muted">{owned ? shadow.title : "Derrote o chefe deste portão."}</p>
                    {owned ? (
                      <p className="mt-1 text-sm tabular-nums">
                        Nível {owned.level}
                        {owned.level < 20 ? ` · ${owned.xp}/${shadowNeed(owned.level)} XP` : " · teto"}
                      </p>
                    ) : null}
                  </div>
                </div>
                {owned ? (
                  <>
                    <p className="mt-3 text-sm text-muted">{shadow.line}</p>
                    <p className="mt-1 text-xs text-muted">
                      Bônus base: ataque +{shadow.atk}
                      {shadow.bonus.str ? ` · força +${shadow.bonus.str}` : ""}
                      {shadow.bonus.agi ? ` · agilidade +${shadow.bonus.agi}` : ""}
                      {shadow.bonus.vit ? ` · vitalidade +${shadow.bonus.vit}` : ""}
                      {shadow.bonus.int ? ` · inteligência +${shadow.bonus.int}` : ""}
                      {shadow.bonus.sen ? ` · sentido +${shadow.bonus.sen}` : ""}
                    </p>
                    <Btn className="mt-3" variant={active ? "accent" : "ghost"} onClick={() => toggle(shadow.id)}>
                      {active ? "Na formação" : "Chamar"}
                    </Btn>
                  </>
                ) : (
                  <p className="mt-3 text-sm text-muted">A sombra só aparece depois da vitória.</p>
                )}
              </Frame>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
