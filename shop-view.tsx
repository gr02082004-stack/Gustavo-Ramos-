import { useState } from "react";
import { ITEMS, POTION_PRICE, RARITY_LABEL, SLOT_LABEL } from "@/lib/system/content";
import { useGame } from "@/lib/system/store";
import type { ItemSlot } from "@/lib/system/types";
import { Btn, Frame } from "@/components/system/ui";

const FILTERS: { id: "all" | ItemSlot; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "weapon", label: "Armas" },
  { id: "chest", label: "Armaduras" },
  { id: "head", label: "Elmos" },
  { id: "hands", label: "Luvas" },
  { id: "feet", label: "Botas" },
  { id: "relic", label: "Relíquias" },
];

export function ShopView() {
  const save = useGame();
  const buy = useGame((s) => s.buy);
  const buyPotion = useGame((s) => s.buyPotion);
  const [slot, setSlot] = useState<(typeof FILTERS)[number]["id"]>("all");
  const items = ITEMS.filter((item) => slot === "all" || item.slot === slot);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="font-display text-xs tracking-widest text-primary">MERCADO</p>
          <h1 className="font-display text-3xl">Loja</h1>
        </div>
        <p className="font-display text-xl text-accent tabular-nums">{save.gold} ouro</p>
      </header>
      <Frame>
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-xl">Frasco de vitalidade</h2>
            <p className="text-sm text-muted">Recupera cerca de um terço da vida em combate. Você tem {save.potions}.</p>
          </div>
          <Btn variant="ghost" onClick={buyPotion}>{POTION_PRICE} ouro</Btn>
        </div>
      </Frame>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={slot === item.id ? "min-h-11 shrink-0 bg-primary px-3 text-sm text-bg" : "min-h-11 shrink-0 border border-border px-3 text-sm text-muted"}
            onClick={() => setSlot(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-3">
        {items.map((item) => {
          const owned = save.inventory.includes(item.id);
          const locked = save.level < item.minLevel;
          return (
            <li key={item.id}>
              <Frame>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs tracking-wide text-accent uppercase">
                      {SLOT_LABEL[item.slot]} · {RARITY_LABEL[item.rarity]}
                      {locked ? ` · nível ${item.minLevel}` : ""}
                    </p>
                    <h2 className="font-display text-xl">{item.name}</h2>
                    <p className="mt-1 text-sm text-muted">{item.blurb}</p>
                    <p className="mt-2 text-xs text-muted">{bonusLine(item.bonus)}</p>
                  </div>
                  <Btn disabled={owned || locked || save.gold < item.price} onClick={() => buy(item.id)}>
                    {owned ? "Seu" : `${item.price}`}
                  </Btn>
                </div>
              </Frame>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function bonusLine(bonus: { str?: number; agi?: number; vit?: number; int?: number; sen?: number; atk?: number; def?: number; hp?: number }) {
  const parts: string[] = [];
  if (bonus.atk) parts.push(`ataque +${bonus.atk}`);
  if (bonus.def) parts.push(`defesa +${bonus.def}`);
  if (bonus.hp) parts.push(`vida +${bonus.hp}`);
  if (bonus.str) parts.push(`força +${bonus.str}`);
  if (bonus.agi) parts.push(`agilidade +${bonus.agi}`);
  if (bonus.vit) parts.push(`vitalidade +${bonus.vit}`);
  if (bonus.int) parts.push(`inteligência +${bonus.int}`);
  if (bonus.sen) parts.push(`sentido +${bonus.sen}`);
  return parts.join(" · ");
}
