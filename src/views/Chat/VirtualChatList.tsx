import { useRef, useCallback, type UIEvent } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type { ChatMessage, SearchResult } from "../../types";

interface VirtualChatListProps {
  chats: (ChatMessage | SearchResult)[];
  onSelectChat: (c: ChatMessage) => void;
  formatPath: (p: string) => string;
  hasMore: boolean;
  loadMore: () => void;
  loadingMore: boolean;
}

export function VirtualChatList({
  chats,
  onSelectChat,
  formatPath,
  hasMore,
  loadMore,
  loadingMore,
}: VirtualChatListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const ITEM_HEIGHT = 110;

  const virtualizer = useVirtualizer({
    count: chats.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ITEM_HEIGHT,
    overscan: 5,
  });

  const handleScroll = useCallback(
    (e: UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      const nearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 200;
      if (nearBottom && hasMore && !loadingMore) {
        loadMore();
      }
    },
    [hasMore, loadMore, loadingMore]
  );

  return (
    <div ref={parentRef} onScroll={handleScroll} className="h-[calc(100vh-320px)] overflow-auto -mr-4 pr-4">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: "100%",
          position: "relative",
        }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const chat = chats[virtualItem.index];
          return (
            <div
              key={chat.uuid}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
              className="pb-3"
            >
              <button
                onClick={() => onSelectChat(chat)}
                className="w-full h-full text-left bg-card rounded-xl p-4 border border-border hover:border-primary transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`text-xs px-1.5 py-0.5 rounded ${
                      chat.role === "user" ? "bg-primary/15 text-primary" : "bg-card-alt text-muted-foreground"
                    }`}
                  >
                    {chat.role}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {chat.timestamp ? new Date(chat.timestamp).toLocaleString() : ""}
                  </span>
                  {"score" in chat && (
                    <span className="text-xs text-muted-foreground">
                      · score: {(chat as SearchResult).score.toFixed(2)}
                    </span>
                  )}
                </div>
                <p className="text-ink line-clamp-2">{chat.content}</p>
                <p className="text-xs text-muted-foreground mt-2 truncate">
                  {formatPath(chat.project_path)} · {chat.session_summary || "Untitled"}
                </p>
              </button>
            </div>
          );
        })}
      </div>
      {loadingMore && <div className="py-4 text-center text-muted-foreground text-sm">Loading more...</div>}
    </div>
  );
}
