import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { LightningBoltIcon } from "@radix-ui/react-icons";
import type { DistillDocument } from "../../types";
import {
  LoadingState,
  EmptyState,
  SearchInput,
  PageHeader,
  ItemCard,
  ConfigPage,
  useSearch,
} from "../../components/config";
import { DistillMenu } from "./DistillMenu";

interface DistillViewProps {
  onSelect: (doc: DistillDocument) => void;
  watchEnabled: boolean;
  onWatchToggle: (enabled: boolean) => void;
}

export function DistillView({ onSelect, watchEnabled, onWatchToggle }: DistillViewProps) {
  const [documents, setDocuments] = useState<DistillDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const { search, setSearch, filtered } = useSearch(documents, ["title", "tags"]);

  const fetchDocuments = () => {
    setLoading(true);
    invoke<DistillDocument[]>("list_distill_documents")
      .then(setDocuments)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDocuments();
    // Listen for distill directory changes
    const unlisten = listen("distill-changed", () => {
      fetchDocuments();
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  if (loading) return <LoadingState message="Loading distill documents..." />;

  return (
    <ConfigPage>
      <PageHeader
        title="Distill (CC)"
        subtitle={`${documents.length} summaries`}
        action={
          <DistillMenu
            watchEnabled={watchEnabled}
            onWatchToggle={onWatchToggle}
            onRefresh={fetchDocuments}
          />
        }
      />

      <SearchInput placeholder="Search by title or tags..." value={search} onChange={setSearch} />

      {filtered.length > 0 ? (
        <div className="space-y-2">
          {filtered.map((doc) => (
            <ItemCard
              key={doc.file}
              name={doc.title}
              description={doc.tags.map((t) => `#${t}`).join(" ")}
              timestamp={doc.date}
              onClick={() => onSelect(doc)}
            />
          ))}
        </div>
      ) : !search ? (
        <EmptyState
          icon={LightningBoltIcon}
          message="No distill documents yet"
          hint="Use /distill in Claude Code to capture wisdom"
        />
      ) : (
        <p className="text-muted-foreground text-sm">No documents match "{search}"</p>
      )}
    </ConfigPage>
  );
}
