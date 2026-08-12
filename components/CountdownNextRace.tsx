"use client";

import { useEffect, useState } from "react";

function getRemaining(target: number) {
  const diff = Math.max(0, target - Date.now());
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, done: diff <= 0 };
}

export default function CountdownNextRace({ targetIso }: { targetIso: string }) {
  const target = new Date(targetIso).getTime();
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (remaining.done) {
    return <p className="text-sm font-medium text-red-600 dark:text-red-400">Race weekend is live</p>;
  }

  return (
    <div className="flex gap-3 font-mono">
      {[
        ["D", remaining.days],
        ["H", remaining.hours],
        ["M", remaining.minutes],
        ["S", remaining.seconds],
      ].map(([label, value]) => (
        <div key={label as string} className="flex flex-col items-center">
          <span className="text-xl font-semibold tabular-nums">{String(value).padStart(2, "0")}</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{label}</span>
        </div>
      ))}
    </div>
  );
}
