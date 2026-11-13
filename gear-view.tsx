import { ITEMS, SLOT_LABEL } from "@/lib/system/content";
import { derive } from "@/lib/system/formulas";
import { useGame } from "@/lib/system/store";
import type { ItemSlot } from "@/lib/system/types";
import { Btn, Frame } from "@/components/system/ui";

const SLOTS: ItemSlot[] = ["weapon", "chest", "head", "hands", "feet", "relic"];

export function GearView() {
  const save = useGame();
  const equip = useGame((s) => s.equip);
  const unequip = useGame((s) => s.unequip);
  const profile = derive(save);

  return (
    <div className="flex flex-col gap-4">
      <header>
        <p className="font-display text-xs tracking-widest text-primary">ARSENAL</p>
        <h1 className="font-display text-3xl">Equipamento</h1>
        <p className="mt-1 text-sm text-muted tabular-nums">
          Poder {profile.power} · ataque {profile.atk} · defesa {profile.def} · vida {profile.maxHp}
        </p>
      </header>
      {SLOTS.map((slot) => {
        const equippedId = save.equipment[slot];
        const equipped = ITEMS.find((item) => item.id === equippedId);
        const owned = ITEMS.filter((item) => item.slot === slot && save.inventory.includes(item.id));
        return (
          <Frame key={slot}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs tracking-wide text-muted uppercase">{SLOT_LABEL[slot]}</p>
                <h2 className="font-display text-xl">{equipped ? equipped.name : "Vazio"}</h2>
              </div>
              {equipped ? (
                <Btn variant="quiet" onClick={() => unequip(slot)}>
                  Remover
                </Btn>
              ) : null}
            </div>
            {owned.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Nada deste tipo no inventário.</p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {owned.map((item) => (
                  <li key={item.id} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{item.name}</span>
                    <Btn
                      variant={equippedId === item.id ? "accent" : "ghost"}
                      onClick={() => equip(item.id)}
                      disabled={equippedId === item.id}
                    >
                      {equippedId === item.id ? "Equipado" : "Equipar"}
                    </Btn>
                  </li>
                ))}
              </ul>
            )}
          </Frame>
        );
      })}
    </div>
  );
}
