/**
 * [INPUT]: ExecutorProfile from Tauri backend
 * [OUTPUT]: NewTerminalSplitButton component with dynamic agent profiles
 * [POS]: UI 组件，提供多 Agent 终端创建入口
 * [PROTOCOL]: 变更时更新此头部，然后检查 components/CLAUDE.md
 */

import { useEffect, useState } from 'react';
import { PlusIcon, ChevronDownIcon } from '@radix-ui/react-icons';
import { invoke } from '@tauri-apps/api/core';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  DropdownMenuSeparator,
} from './dropdown-menu';
import type { ExecutorProfile } from '@/types';

// Fallback options when profiles fail to load
const FALLBACK_OPTIONS = [
  { command: undefined, label: 'Terminal' },
  { command: 'claude', label: 'Claude Code' },
];

interface NewTerminalSplitButtonProps {
  onSelect: (command?: string) => void;
  variant?: 'primary' | 'icon';
  className?: string;
}

/**
 * Split button for creating new terminals with multiple agent options.
 * - Primary variant: Full button with "New Terminal" text (for empty state)
 * - Icon variant: Compact icon-only button (for inline use)
 */
export function NewTerminalSplitButton({
  onSelect,
  variant = 'primary',
  className = '',
}: NewTerminalSplitButtonProps) {
  const [profiles, setProfiles] = useState<ExecutorProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    invoke<ExecutorProfile[]>('list_executor_profiles')
      .then(setProfiles)
      .catch((err) => console.error('Failed to load executor profiles:', err))
      .finally(() => setLoading(false));
  }, []);

  // Group profiles by agent
  const groupedProfiles = profiles.reduce<Record<string, ExecutorProfile[]>>((acc, profile) => {
    if (!acc[profile.agent]) {
      acc[profile.agent] = [];
    }
    acc[profile.agent].push(profile);
    return acc;
  }, {});

  const renderMenuContent = () => {
    if (loading) {
      return <DropdownMenuItem disabled>Loading...</DropdownMenuItem>;
    }

    if (profiles.length === 0) {
      // Fallback to simple options
      return FALLBACK_OPTIONS.map((opt) => (
        <DropdownMenuItem
          key={opt.label}
          onClick={(e) => {
            e.stopPropagation();
            onSelect(opt.command);
          }}
        >
          {opt.label}
        </DropdownMenuItem>
      ));
    }

    return (
      <>
        {/* Plain terminal option */}
        <DropdownMenuItem
          onClick={(e) => {
            e.stopPropagation();
            onSelect(undefined);
          }}
        >
          Terminal
        </DropdownMenuItem>
        <DropdownMenuSeparator />

        {/* Agent submenus */}
        {Object.entries(groupedProfiles).map(([agent, agentProfiles]) => {
          const agentName = agentProfiles[0]?.agent_name || agent;

          // If only one profile (default), show directly
          if (agentProfiles.length === 1) {
            const profile = agentProfiles[0];
            return (
              <DropdownMenuItem
                key={agent}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(profile.command);
                }}
              >
                {agentName}
              </DropdownMenuItem>
            );
          }

          // Multiple profiles: show submenu
          return (
            <DropdownMenuSub key={agent}>
              <DropdownMenuSubTrigger>{agentName}</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {agentProfiles.map((profile) => (
                  <DropdownMenuItem
                    key={profile.profile_id}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelect(profile.command);
                    }}
                  >
                    <div className="flex flex-col">
                      <span>{profile.label}</span>
                      <span className="text-muted-foreground text-xs">{profile.description}</span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </>
    );
  };

  if (variant === 'icon') {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className={`text-muted-foreground hover:text-ink p-0.5 transition-colors ${className}`}
            title="New terminal"
            onClick={(e) => e.stopPropagation()}
          >
            <PlusIcon className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{renderMenuContent()}</DropdownMenuContent>
      </DropdownMenu>
    );
  }

  // Primary variant - full split button
  return (
    <div className={`inline-flex overflow-hidden rounded-lg ${className}`}>
      <button
        onClick={() => onSelect()}
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex items-center gap-2 px-4 py-2 transition-colors"
      >
        <PlusIcon className="h-4 w-4" />
        New Terminal
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="bg-primary text-primary-foreground hover:bg-primary/90 border-primary-foreground/20 border-l px-2 py-2 transition-colors">
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">{renderMenuContent()}</DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
