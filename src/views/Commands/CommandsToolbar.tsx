/**
 * [INPUT]: search, sort, view mode state
 * [OUTPUT]: Commands toolbar with search and options
 * [POS]: 命令列表工具栏组件
 * [PROTOCOL]: 变更时更新此头部
 */

import { FolderTree, List } from "lucide-react";
import { DotsHorizontalIcon, CheckIcon } from "@radix-ui/react-icons";
import { Button } from "../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../components/ui/dropdown-menu";
import { SearchInput } from "../../components/config";
import type { CommandSortKey } from "./types";

interface CommandsToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  viewMode: "flat" | "tree";
  onViewModeChange: (mode: "flat" | "tree") => void;
  sortKey: CommandSortKey;
  sortDir: "asc" | "desc";
  onToggleSort: (key: CommandSortKey) => void;
  showDeprecated: boolean;
  onShowDeprecatedChange: (show: boolean) => void;
}

export function CommandsToolbar({
  search,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortKey,
  sortDir,
  onToggleSort,
  showDeprecated,
  onShowDeprecatedChange,
}: CommandsToolbarProps) {
  return (
    <div className="flex items-center gap-3 mb-6">
      <SearchInput
        placeholder="Search local & marketplace..."
        value={search}
        onChange={onSearchChange}
        className="flex-1 px-4 py-2 bg-card border border-border rounded-lg text-ink placeholder:text-muted-foreground focus:outline-none focus:border-primary"
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="shrink-0">
            <DotsHorizontalIcon className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuLabel className="text-xs">View</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={viewMode}
            onValueChange={(v) => onViewModeChange(v as "flat" | "tree")}
          >
            <DropdownMenuRadioItem value="tree">
              <FolderTree className="w-4 h-4 mr-2" /> Tree
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="flat">
              <List className="w-4 h-4 mr-2" /> Flat
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel className="text-xs">Sort</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => onToggleSort("usage")}>
            {sortKey === "usage" && <CheckIcon className="w-4 h-4 mr-2" />}
            {sortKey !== "usage" && <span className="w-4 mr-2" />}
            Usage {sortKey === "usage" && (sortDir === "desc" ? "↓" : "↑")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => onToggleSort("name")}>
            {sortKey === "name" && <CheckIcon className="w-4 h-4 mr-2" />}
            {sortKey !== "name" && <span className="w-4 mr-2" />}
            Name {sortKey === "name" && (sortDir === "desc" ? "↓" : "↑")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuCheckboxItem checked={showDeprecated} onCheckedChange={onShowDeprecatedChange}>
            Show deprecated
          </DropdownMenuCheckboxItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
