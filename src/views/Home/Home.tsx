import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FeatureType, Project, LocalCommand } from "../../types";
import { FEATURES, FEATURE_ICONS } from "../../constants";

interface HomeStats {
  projects: number;
  sessions: number;
  commands: number;
}

interface HomeProps {
  onFeatureClick: (feature: FeatureType) => void;
}

export function Home({ onFeatureClick }: HomeProps) {
  const [stats, setStats] = useState<HomeStats | null>(null);

  useEffect(() => {
    Promise.all([
      invoke<Project[]>("list_projects"),
      invoke<LocalCommand[]>("list_local_commands"),
    ]).then(([projects, commands]) => {
      const sessions = projects.reduce((sum, p) => sum + p.session_count, 0);
      setStats({ projects: projects.length, sessions, commands: commands.length });
    });
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-full px-6 py-16">
      <h1 className="font-serif text-5xl font-bold text-primary mb-3 tracking-tight flex items-center gap-3">
        <img src="/logo.png" alt="Lovcode" className="w-12 h-12" />
        Lovcode
      </h1>
      <p className="text-muted-foreground text-lg mb-12">Your Vibe Coding Hub</p>

      {stats && (
        <div className="flex gap-3 mb-12">
          {[
            { value: stats.projects, label: "Workspaces" },
            { value: stats.sessions, label: "Sessions" },
            { value: stats.commands, label: "Commands" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="text-center px-6 py-4 bg-card rounded-2xl border border-border/60"
            >
              <p className="text-3xl font-semibold text-ink font-serif">{stat.value}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-lg">
        {FEATURES.map((feature) => {
          const Icon = FEATURE_ICONS[feature.type];
          return (
            <button
              key={feature.type}
              onClick={() => onFeatureClick(feature.type)}
              className={`flex flex-col items-center p-6 rounded-2xl border transition-all duration-200 ${
                feature.available
                  ? "bg-card border-border/60 hover:border-primary hover:shadow-sm cursor-pointer"
                  : "bg-card/40 border-border/40"
              }`}
            >
              {Icon && <Icon className="w-8 h-8 mb-3" />}
              <span
                className={`text-sm font-medium ${feature.available ? "text-ink" : "text-muted-foreground"}`}
              >
                {feature.label}
              </span>
              {!feature.available && (
                <span className="text-xs text-muted-foreground/70 mt-1.5 italic">Soon</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
