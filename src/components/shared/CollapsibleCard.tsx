import type { ReactNode } from "react";
import { ChevronDownIcon } from "@radix-ui/react-icons";
import { Collapsible, CollapsibleTrigger, CollapsibleContent as CollapsibleBody } from "../ui/collapsible";
import { usePersistedState } from "../../hooks";

interface CollapsibleCardProps {
  storageKey: string;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  bodyClassName?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

export function CollapsibleCard({
  storageKey,
  title,
  subtitle,
  headerRight,
  bodyClassName = "",
  defaultOpen = true,
  children,
}: CollapsibleCardProps) {
  const [open, setOpen] = usePersistedState(storageKey, defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="bg-card rounded-xl border border-border overflow-hidden mb-4">
        <CollapsibleTrigger className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 group">
          <div>
            <p className="text-sm font-medium text-ink">{title}</p>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground hover:text-ink">
            {headerRight}
            <span className="group-data-[state=open]:hidden">Expand</span>
            <span className="group-data-[state=closed]:hidden">Collapse</span>
            <ChevronDownIcon className="w-4 h-4 transition-transform group-data-[state=open]:rotate-180" />
          </div>
        </CollapsibleTrigger>
        <CollapsibleBody className={bodyClassName}>{children}</CollapsibleBody>
      </div>
    </Collapsible>
  );
}
