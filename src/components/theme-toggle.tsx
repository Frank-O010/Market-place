"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

const order = ["system", "light", "dark"] as const;
const labels = { system: "System theme", light: "Light theme", dark: "Dark theme" } as const;
const icons = { system: Monitor, light: Sun, dark: Moon } as const;

const subscribe = () => () => {};

/** Cycles system -> light -> dark. Follows the device setting by default. */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser; render a neutral icon on the server.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const current = (
    mounted && order.includes(theme as (typeof order)[number]) ? theme : "system"
  ) as (typeof order)[number];
  const next = order[(order.indexOf(current) + 1) % order.length]!;
  const Icon = icons[current];
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={() => setTheme(next)}
      aria-label={`${labels[current]}. Switch to ${labels[next].toLowerCase()}`}
      title={labels[current]}
    >
      <Icon aria-hidden />
    </Button>
  );
}
