import { Check } from "lucide-react"
import { cn } from "@/lib/utils"
import type { WorkBlock } from "@/lib/types"

interface BlockChipsProps {
  blocks: WorkBlock[]
  selectedIds: string[]
  onToggle: (block: WorkBlock) => void
  disabled?: boolean
  compact?: boolean
  disableInactive?: boolean
  emptyText?: string
}

export function BlockChips({
  blocks,
  selectedIds,
  onToggle,
  disabled = false,
  compact = false,
  disableInactive = false,
  emptyText = "No blocks available. Add blocks in Staff & Blocks.",
}: BlockChipsProps) {
  if (blocks.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {blocks.map((block) => {
        const selected = selectedIds.includes(block.id)
        const blockedByInactive = disableInactive && !block.is_active && !selected
        return (
          <button
            key={block.id}
            type="button"
            aria-pressed={selected}
            disabled={disabled || blockedByInactive}
            title={!block.is_active ? `${block.name} (inactive)` : undefined}
            onClick={() => onToggle(block)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              compact ? "h-8 px-2.5 text-xs" : "h-9 px-3",
              selected
                ? "border-primary/30 bg-accent font-medium text-accent-foreground"
                : "border-border bg-card text-foreground hover:bg-muted",
              !block.is_active && "border-dashed",
              (disabled || blockedByInactive) && "cursor-not-allowed opacity-50",
            )}
          >
            {selected ? <Check className="size-3.5 shrink-0" /> : null}
            {block.display_name}
          </button>
        )
      })}
    </div>
  )
}
