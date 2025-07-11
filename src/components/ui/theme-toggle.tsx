"use client";

import { useEffect, useState } from "react";

export default function ThemeToggle() {
  const [theme, setTheme] = useState("light");

  useEffect(() => {
    if (typeof window !== "undefined") {
      const root = window.document.documentElement;
      if (theme === "dark") {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <button
      onClick={toggleTheme}
      className="rounded-lg border px-4 py-2 bg-card text-foreground hover:bg-accent transition-colors"
      aria-label="Tema değiştir"
    >
      {theme === "light" ? "🌙 Karanlık" : "☀️ Aydınlık"}
    </button>
  );
}
