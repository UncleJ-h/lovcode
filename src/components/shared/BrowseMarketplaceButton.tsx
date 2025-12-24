import { Store } from "lucide-react";

interface BrowseMarketplaceButtonProps {
  onClick?: () => void;
}

export function BrowseMarketplaceButton({ onClick }: BrowseMarketplaceButtonProps) {
  if (!onClick) return null;
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-1.5 text-sm text-muted-foreground hover:text-ink hover:bg-card-alt rounded-lg transition-colors"
      title="Browse marketplace"
    >
      <Store className="w-4 h-4" />
      <span>Marketplace</span>
    </button>
  );
}
