import { useEffect, useState } from "react";
import {
  BookOpen,
  Crown,
  Menu,
  ScrollText,
  Shield,
  ShoppingBag,
  Swords,
  User,
  Users,
  X,
} from "lucide-react";
import { CombatView, type Run } from "@/components/system/combat-view";
import { GatesView } from "@/components/system/gates-view";
import { GearView } from "@/components/system/gear-view";
import { JournalView } from "@/components/system/journal-view";
import { QuestsView } from "@/components/system/quests-view";
import { RankView } from "@/components/system/rank-view";
import { ShadowsView } from "@/components/system/shadows-view";
import { ShopView } from "@/components/system/shop-view";
import { StatusView } from "@/components/system/status-view";
import { Btn, Frame } from "@/components/system/ui";
import { todayKey } from "@/lib/system/formulas";
import { chime, useGame } from "@/lib/system/store";
import type { RankId, ViewId } from "@/lib/system/types";

const NAV: { id: ViewId; label: string; icon: typeof User; more?: boolean }[] = [
  { id: "status", label: "Status", icon: User },
  { id: "quests", label: "Missões", icon: ScrollText },
  { id: "gates", label: "Portões", icon: Swords },
  { id: "shadows", label: "Sombras", icon: Users },
  { id: "shop", label: "Loja", icon: ShoppingBag, more: true },
  { id: "rank", label: "Rank", icon: Crown, more: true },
  { id: "gear", label: "Itens", icon: Shield, more: true },
  { id: "journal", label: "Diário", icon: BookOpen, more: true },
];

export function AppRoot() {
  const awakened = useGame((s) => s.awakened);
  const tickDay = useGame((s) => s.tickDay);
  const [view, setView] = useState<ViewId>("status");
  const [more, setMore] = useState(false);
  const [run, setRun] = useState<Run | null>(null);

  useEffect(() => {
    tickDay();
  }, [tickDay]);

  if (!awakened) return <Awaken />;

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl md:flex-row">
      <aside className="hidden w-56 shrink-0 flex-col gap-1 border-r border-border p-4 md:flex">
        <p className="font-display px-2 text-sm tracking-widest text-primary">UMBRA</p>
        <p className="mb-4 px-2 text-xs text-muted">Sistema do caçador</p>
        {NAV.map((item) => (
          <NavButton key={item.id} item={item} active={view === item.id} onClick={() => setView(item.id)} />
        ))}
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between px-4 py-4 md:hidden">
          <p className="font-display text-sm tracking-widest text-primary">UMBRA</p>
          <Fatigue />
        </header>
        <div className="hidden px-6 pt-6 md:block">
          <Fatigue />
        </div>
        <main className="flex-1 px-4 pb-28 md:px-6 md:pb-10">
          {view === "status" ? <StatusView /> : null}
          {view === "quests" ? <QuestsView /> : null}
          {view === "gates" ? <GatesView onEnter={(id) => setRun({ kind: "gate", id })} /> : null}
          {view === "shadows" ? <ShadowsView /> : null}
          {view === "shop" ? <ShopView /> : null}
          {view === "rank" ? <RankView onFight={(rank: RankId) => setRun({ kind: "guardian", rank })} /> : null}
          {view === "gear" ? <GearView /> : null}
          {view === "journal" ? <JournalView /> : null}
        </main>
      </div>
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg md:hidden">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.filter((item) => !item.more).map((item) => (
            <NavButton key={item.id} item={item} active={view === item.id} compact onClick={() => { setMore(false); setView(item.id); }} />
          ))}
          <button type="button" className="flex min-h-16 flex-col items-center justify-center gap-1 text-xs text-muted" onClick={() => setMore(true)}>
            <Menu className="size-5" aria-hidden />
            Mais
          </button>
        </div>
      </nav>
      {more ? (
        <div className="fixed inset-0 z-40 bg-bg/70 md:hidden" onClick={() => setMore(false)}>
          <div className="absolute inset-x-0 bottom-0 border-t border-border bg-surface p-4" onClick={(event) => event.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-display text-lg">Mais</p>
              <button type="button" className="flex size-11 items-center justify-center" onClick={() => setMore(false)} aria-label="Fechar">
                <X className="size-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {NAV.filter((item) => item.more).map((item) => (
                <Btn
                  key={item.id}
                  variant="ghost"
                  onClick={() => {
                    setView(item.id);
                    setMore(false);
                  }}
                >
                  <item.icon className="size-4" aria-hidden />
                  {item.label}
                </Btn>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {run ? <CombatView run={run} onClose={() => setRun(null)} /> : null}
      <LevelUp />
      <Notice />
    </div>
  );
}

function NavButton({
  item,
  active,
  compact,
  onClick,
}: {
  item: (typeof NAV)[number];
  active: boolean;
  compact?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? `flex min-h-16 flex-col items-center justify-center gap-1 text-xs ${active ? "text-primary" : "text-muted"}`
          : `flex min-h-11 items-center gap-2 rounded-sm px-2 text-left text-sm ${active ? "bg-surface text-primary" : "text-muted"}`
      }
    >
      <Icon className="size-5" aria-hidden />
      {item.label}
    </button>
  );
}

function Fatigue() {
  const fatigueDate = useGame((s) => s.fatigueDate);
  if (fatigueDate !== todayKey()) return null;
  return <p className="text-xs text-accent">Fadiga do Sistema · experiência −10% hoje</p>;
}

function Notice() {
  const banner = useGame((s) => s.banner);
  const dismiss = useGame((s) => s.dismissBanner);
  useEffect(() => {
    if (!banner) return;
    const timer = window.setTimeout(dismiss, 3200);
    return () => window.clearTimeout(timer);
  }, [banner, dismiss]);
  if (!banner) return null;
  return (
    <div className="fixed top-4 right-4 left-4 z-50 mx-auto max-w-md border border-border bg-surface px-4 py-3 text-sm shadow-lg">
      <p className={banner.tone === "warn" ? "text-accent" : banner.tone === "good" ? "text-primary" : "text-fg"}>
        {banner.text}
      </p>
    </div>
  );
}

function LevelUp() {
  const pending = useGame((s) => s.pendingLevel);
  const level = useGame((s) => s.level);
  const points = useGame((s) => s.points);
  const dismiss = useGame((s) => s.dismissLevel);
  const muted = useGame((s) => s.muted);
  useEffect(() => {
    if (pending > 0) chime(muted);
  }, [pending, muted]);
  if (pending <= 0) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg/80 px-5">
      <Frame className="w-full max-w-md">
        <p className="font-display text-xs tracking-widest text-primary">NÍVEL</p>
        <h2 className="font-display text-5xl">{level}</h2>
        <p className="mt-2 text-sm text-muted">
          {pending === 1 ? "Você subiu um nível." : `Você subiu ${pending} níveis.`} {pending * 3} pontos foram
          concedidos. {points} ainda {points === 1 ? "está livre" : "estão livres"}.
        </p>
        <Btn className="mt-4 w-full" onClick={dismiss}>
          Continuar
        </Btn>
      </Frame>
    </div>
  );
}

function Awaken() {
  const awaken = useGame((s) => s.awaken);
  const [name, setName] = useState("");
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-5 px-5 py-8">
      <img src="/art/hunter-1.jpg" alt="Caçador antes do despertar" className="portrait-frame w-full object-cover" />
      <div>
        <p className="font-display text-xs tracking-widest text-primary">UMBRA</p>
        <h1 className="mt-2 font-display text-4xl">Você foi escolhido.</h1>
        <p className="mt-3 text-sm text-muted">
          Um sistema se vinculou à sua vida. Missões reais de corpo, estudos que você mesmo cria, portões para
          invadir e sombras para extrair. Do nível 1 ao 200. Do rank E ao Monarca.
        </p>
      </div>
      <form
        className="mt-auto flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (name.trim().length < 2) return;
          void navigator.storage?.persist?.();
          awaken(name);
        }}
      >
        <label className="block">
          <span className="mb-1 block text-xs tracking-wide text-muted uppercase">Nome</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={18}
            placeholder="Como o Sistema vai te chamar"
            className="min-h-11 w-full border border-border bg-surface px-3 text-fg outline-none"
            data-testid="hunter-name"
          />
        </label>
        <Btn type="submit" disabled={name.trim().length < 2} data-testid="awaken">
          Aceitar o Sistema
        </Btn>
      </form>
    </main>
  );
}
