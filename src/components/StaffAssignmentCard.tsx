import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BlockChips } from "@/components/BlockChips"
import {
  applyDutyChange,
  applyStatusChange,
  blocksForAssignment,
  toggleBlock,
} from "@/lib/assignments"
import {
  DUTY_TYPES,
  getDutyLabel,
  getStatusLabel,
  type AppSettings,
  type DutyType,
  type StaffAssignment,
  type StaffStatus,
  type WorkBlock,
} from "@/lib/types"
import { cn } from "@/lib/utils"

interface StaffAssignmentCardProps {
  assignment: StaffAssignment
  blocks: WorkBlock[]
  settings: AppSettings
  issues: string[]
  inactive?: boolean
  emptyBlocksText?: string
  onChange: (next: StaffAssignment) => void
}

const STATUS_OPTIONS: { value: StaffStatus; fallback: string }[] = [
  { value: "working", fallback: "Working" },
  { value: "leave", fallback: "Leave" },
  { value: "comp_off", fallback: "Comp Off" },
  { value: "weekly_off", fallback: "Weekly Off" },
]

export function StaffAssignmentCard({
  assignment,
  blocks,
  settings,
  issues,
  inactive = false,
  emptyBlocksText,
  onChange,
}: StaffAssignmentCardProps) {
  const blockOptions = blocksForAssignment(assignment, blocks)
  const hasDuty = assignment.duty !== null || assignment.blocks.length > 0
  const isWorking = assignment.status === "working"

  const badgeLabel =
    assignment.status !== "working"
      ? getStatusLabel(settings, assignment.status)
      : assignment.duty
        ? getDutyLabel(settings, assignment.duty)
        : assignment.blocks.length > 0
          ? `${assignment.blocks.length} block${assignment.blocks.length > 1 ? "s" : ""}`
          : "No duty"

  return (
    <Card
      className={cn(
        "gap-0 py-0 overflow-visible",
        issues.length > 0 && "ring-destructive/40",
        !isWorking && "bg-muted/40",
      )}
    >
      <CardHeader className="px-4 pt-4 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <CardTitle className="truncate text-base">
              {assignment.staff_display_name}
            </CardTitle>
            {inactive ? (
              <p className="text-xs text-muted-foreground">No longer active</p>
            ) : null}
          </div>
          <Badge
            variant={
              !hasDuty && isWorking
                ? "outline"
                : isWorking
                  ? "secondary"
                  : "default"
            }
            className="max-w-[55%] truncate"
          >
            {badgeLabel}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 px-4 pb-4">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 sm:grid-cols-4">
          {STATUS_OPTIONS.map((option) => {
            const selected = assignment.status === option.value
            const label =
              option.value === "working"
                ? option.fallback
                : getStatusLabel(settings, option.value)
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={selected}
                onClick={() => onChange(applyStatusChange(assignment, option.value))}
                className={cn(
                  "h-8 rounded-md px-1 text-xs font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm",
                  selected
                    ? "bg-card text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            )
          })}
        </div>

        <div className="space-y-1.5">
          <Label
            htmlFor={`duty-${assignment.staff_id}`}
            className="text-xs font-medium text-muted-foreground"
          >
            Special duty
          </Label>
          <Select
            value={assignment.duty ?? "none"}
            disabled={!isWorking}
            onValueChange={(value) =>
              onChange(
                applyDutyChange(
                  assignment,
                  value === "none" ? null : (value as DutyType),
                ),
              )
            }
          >
            <SelectTrigger id={`duty-${assignment.staff_id}`} className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No special duty</SelectItem>
              {DUTY_TYPES.map((duty) => (
                <SelectItem key={duty} value={duty}>
                  {getDutyLabel(settings, duty)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label className="text-xs font-medium text-muted-foreground">Blocks</Label>
            <span className="text-xs text-muted-foreground">
              {assignment.blocks.length} selected
            </span>
          </div>
          <BlockChips
            blocks={blockOptions}
            selectedIds={assignment.blocks.map((block) => block.block_id)}
            disabled={!isWorking}
            disableInactive
            emptyText={emptyBlocksText}
            onToggle={(block) => onChange(toggleBlock(assignment, block, blockOptions))}
          />
        </div>

        {!isWorking ? (
          <p className="text-xs text-muted-foreground">
            {getStatusLabel(settings, assignment.status)} cannot be combined with shifts,
            blocks or other duties.
          </p>
        ) : null}

        {issues.length > 0 ? (
          <p className="text-xs font-medium text-destructive">{issues[0]}</p>
        ) : null}
      </CardContent>
    </Card>
  )
}
