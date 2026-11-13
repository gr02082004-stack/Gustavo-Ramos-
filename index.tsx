import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppRoot } from "@/components/system/shell";
import { useGame } from "@/lib/system/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const go = () => {
      if (alive) setReady(true);
    };
    const unsub = useGame.persist.onFinishHydration(go);
    if (useGame.persist.hasHydrated()) go();
    const timer = window.setTimeout(go, 200);
    return () => {
      alive = false;
      window.clearTimeout(timer);
      unsub();
    };
  }, []);
  if (!ready) return <Boot />;
  return <AppRoot />;
}

function Boot() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6">
      <p className="font-display text-sm tracking-widest text-primary">UMBRA</p>
      <p className="text-sm text-muted">O Sistema está despertando</p>
    </main>
  );
}
