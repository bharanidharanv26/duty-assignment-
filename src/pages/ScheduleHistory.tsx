import { useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Copy,
  CopyPlus,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  deleteSchedule,
  fetchSchedule,
  fetchSchedulesForMonth,
  fetchSettings,
  saveSchedule,
} from "@/lib/api"
import { describeAssignment } from "@/lib/assignments"
import { copyText } from "@/lib/clipboard"
import {
  addDays,
  formatFullDate,
  formatMediumDate,
  formatSavedAt,
  formatShortDate,
  getMonthWeeks,
  isISODate,
  monthLabel,
  monthRange,
  todayISO,
} from "@/lib/date"
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type DailySchedule,
} from "@/lib/types"
import { cn } from "@/lib/utils"

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

function currentMonth() {
  const now = new Date()
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

function messageOf(schedule: DailySchedule): string {
  return schedule.final_message?.trim() || schedule.generated_message?.trim() || ""
}

function snippetOf(schedule: DailySchedule): string {
  const message = messageOf(schedule)
  const lines = message.split("\n").filter((line) => line.trim().length > 0)
  return lines.slice(1, 3).join(" · ") || "No message saved"
}

export function ScheduleHistoryPage() {
  const navigate = useNavigate()
  const [month, setMonth] = useState(currentMonth)
  const [schedules, setSchedules] = useState<DailySchedule[]>([])
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_APP_SETTINGS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [duplicateSource, setDuplicateSource] = useState<DailySchedule | null>(null)
  const [targetDate, setTargetDate] = useState(todayISO())
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [duplicating, setDuplicating] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const range = monthRange(month.year, month.month)

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [rows, settingsRow] = await Promise.all([
          fetchSchedulesForMonth(range.start, range.end),
          fetchSettings(),
        ])
        if (cancelled) return
        setSchedules(rows)
        setSettings(settingsRow)
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error ? loadError.message : "Could not load the history.",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [month.year, month.month, reloadKey])

  const byDate = useMemo(
    () => new Map(schedules.map((schedule) => [schedule.schedule_date, schedule])),
    [schedules],
  )
  const selected = selectedDate ? (byDate.get(selectedDate) ?? null) : null
  const weeks = useMemo(() => getMonthWeeks(month.year, month.month), [month])
  // Historical rows show the block names saved with the schedule, not new abbreviations.
  const historySettings = useMemo(
    () => ({ ...settings, block_abbreviations: {} }),
    [settings],
  )
  const firstOfMonth = `${month.year}-${String(month.month).padStart(2, "0")}-01`

  function shiftMonth(delta: number) {
    const date = new Date(month.year, month.month - 1 + delta, 1)
    setMonth({ year: date.getFullYear(), month: date.getMonth() + 1 })
    setSelectedDate(null)
  }

  async function handleCopyMessage(schedule: DailySchedule) {
    const message = messageOf(schedule)
    if (!message) {
      toast.error("This schedule has no saved message.")
      return
    }
    try {
      await copyText(message)
      toast.success("Message copied")
    } catch (copyError) {
      toast.error(
        copyError instanceof Error ? copyError.message : "Could not copy the message.",
      )
    }
  }

  function startDuplicate(schedule: DailySchedule) {
    setDuplicateSource(schedule)
    setTargetDate(addDays(schedule.schedule_date, 1))
    setDuplicateError(null)
    setSelectedDate(null)
  }

  async function handleDelete(schedule: DailySchedule) {
    if (
      !window.confirm(
        `Delete the saved schedule for ${formatFullDate(schedule.schedule_date)}? This cannot be undone.`,
      )
    ) {
      return
    }
    setDeleting(true)
    try {
      await deleteSchedule(schedule.id)
      setSchedules((current) => current.filter((row) => row.id !== schedule.id))
      setSelectedDate(null)
      toast.success("Schedule deleted")
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error
          ? deleteError.message
          : "Could not delete the schedule.",
      )
    } finally {
      setDeleting(false)
    }
  }

  async function handleDuplicate() {
    if (!duplicateSource) return
    if (!isISODate(targetDate)) {
      setDuplicateError("Choose a valid date.")
      return
    }
    if (targetDate === duplicateSource.schedule_date) {
      setDuplicateError("Choose a different date from the original schedule.")
      return
    }
    setDuplicating(true)
    setDuplicateError(null)
    try {
      const existing = await fetchSchedule(targetDate)
      if (existing) {
        setDuplicateError(
          `A schedule already exists for ${formatShortDate(targetDate)}. Open it from the calendar instead.`,
        )
        return
      }
      await saveSchedule({
        schedule_date: targetDate,
        assignments: duplicateSource.assignments,
        generated_message: null,
        final_message: null,
        status: "draft",
      })
      toast.success(
        `Schedule copied to ${formatShortDate(targetDate)}. Review it and generate the message.`,
      )
      setDuplicateSource(null)
      navigate(`/?date=${targetDate}`)
    } catch (duplicateFailure) {
      setDuplicateError(
        duplicateFailure instanceof Error
          ? duplicateFailure.message
          : "Could not duplicate the schedule.",
      )
    } finally {
      setDuplicating(false)
    }
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Schedule History
        </h1>
        <p className="text-sm text-muted-foreground">
          Open any saved date, copy its message, edit it, or reuse it for another day.
        </p>
      </div>

      {error ? (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Could not load the history</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[380px_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="Previous month"
                onClick={() => shiftMonth(-1)}
              >
                <ChevronLeft />
              </Button>
              <div className="text-center">
                <CardTitle>{monthLabel(month.year, month.month)}</CardTitle>
                <CardDescription>
                  {schedules.length} saved {schedules.length === 1 ? "day" : "days"}
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Next month"
                onClick={() => shiftMonth(1)}
              >
                <ChevronRight />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="pb-1 text-center text-[10px] font-medium tracking-wide text-muted-foreground uppercase"
                >
                  {day}
                </div>
              ))}
              {weeks.flatMap((week, weekIndex) =>
                week.map((day, dayIndex) => {
                  if (!day) {
                    return (
                      <div key={`empty-${weekIndex}-${dayIndex}`} aria-hidden="true" />
                    )
                  }
                  const schedule = byDate.get(day.iso)
                  return (
                    <button
                      key={day.iso}
                      type="button"
                      disabled={!schedule}
                      onClick={() => setSelectedDate(day.iso)}
                      aria-label={`${formatMediumDate(day.iso)}${
                        schedule ? ", schedule saved" : ", no schedule"
                      }`}
                      className={cn(
                        "relative flex aspect-square flex-col items-center justify-center rounded-lg text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                        schedule
                          ? "bg-accent font-medium text-accent-foreground hover:bg-accent/70"
                          : "cursor-default text-muted-foreground/60",
                        day.iso === todayISO() && "ring-1 ring-primary/40",
                      )}
                    >
                      {day.day}
                      {schedule ? (
                        <span className="absolute bottom-1.5 size-1 rounded-full bg-primary" />
                      ) : null}
                    </button>
                  )
                }),
              )}
            </div>
            <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Days with a saved schedule can be opened
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Saved schedules</CardTitle>
            <CardDescription>{monthLabel(month.year, month.month)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : schedules.length === 0 ? (
              <div className="flex flex-col items-start gap-2 rounded-lg border border-dashed p-4">
                <p className="text-sm font-medium">
                  No schedules saved in {monthLabel(month.year, month.month)}
                </p>
                <p className="text-sm text-muted-foreground">
                  Prepare a duty schedule and save it to see it here.
                </p>
                <Button variant="outline" onClick={() => navigate(`/?date=${firstOfMonth}`)}>
                  <Plus />
                  Prepare a schedule
                </Button>
              </div>
            ) : (
              schedules.map((schedule) => (
                <button
                  key={schedule.id}
                  type="button"
                  onClick={() => setSelectedDate(schedule.schedule_date)}
                  className="flex w-full items-start justify-between gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/60 focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">
                        {formatMediumDate(schedule.schedule_date)}
                      </span>
                      {schedule.status === "draft" ? (
                        <Badge variant="outline">Draft</Badge>
                      ) : null}
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {snippetOf(schedule)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground">
                    {schedule.assignments.length} staff
                    <ChevronRight className="size-4" />
                  </div>
                </button>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelectedDate(null)
        }}
      >
        <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
          {selected ? (
            <>
              <DialogHeader>
                <DialogTitle>{formatFullDate(selected.schedule_date)}</DialogTitle>
                <DialogDescription>
                  {selected.assignments.length} staff · Saved{" "}
                  {formatSavedAt(selected.updated_at)}
                  {selected.status === "draft" ? " · Draft" : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-1.5">
                {selected.assignments.map((assignment) => {
                  const parts = describeAssignment(assignment, historySettings)
                  return (
                    <div
                      key={assignment.staff_id}
                      className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 rounded-lg border px-3 py-2 text-sm"
                    >
                      <span className="font-medium">
                        {assignment.staff_display_name}
                      </span>
                      <span className="text-right text-muted-foreground">
                        {parts.length > 0 ? parts.join(", ") : "No assignment"}
                      </span>
                    </div>
                  )
                })}
              </div>

              <Separator />

              <div className="space-y-1.5">
                <p className="text-sm font-medium">Final message</p>
                <pre className="max-h-72 overflow-y-auto rounded-lg bg-muted p-3 text-sm leading-relaxed whitespace-pre-wrap">
                  {messageOf(selected) || "No message saved for this day."}
                </pre>
              </div>

              {selected.generated_message &&
              selected.generated_message.trim() !==
                (selected.final_message?.trim() ?? "") ? (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    View the generated message before editing
                  </summary>
                  <pre className="mt-1.5 max-h-56 overflow-y-auto rounded-lg bg-muted p-3 text-sm leading-relaxed whitespace-pre-wrap">
                    {selected.generated_message}
                  </pre>
                </details>
              ) : null}

              <DialogFooter className="sm:justify-between">
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => handleCopyMessage(selected)}>
                    <Copy />
                    Copy message
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleDelete(selected)}
                    disabled={deleting}
                  >
                    {deleting ? <Loader2 className="animate-spin" /> : <Trash2 />}
                    {deleting ? "Deleting…" : "Delete schedule"}
                  </Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button variant="outline" onClick={() => startDuplicate(selected)}>
                    <CopyPlus />
                    Duplicate
                  </Button>
                  <Button
                    onClick={() => {
                      setSelectedDate(null)
                      navigate(`/?date=${selected.schedule_date}`)
                    }}
                  >
                    <Pencil />
                    Edit schedule
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(duplicateSource)}
        onOpenChange={(open) => {
          if (!open) setDuplicateSource(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Duplicate schedule</DialogTitle>
            <DialogDescription>
              {duplicateSource
                ? `Copy the assignments from ${formatMediumDate(
                    duplicateSource.schedule_date,
                  )} to another date. The original stays unchanged.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="duplicate-date">New schedule date</Label>
            <Input
              id="duplicate-date"
              type="date"
              value={targetDate}
              onChange={(event) => {
                setTargetDate(event.target.value)
                setDuplicateError(null)
              }}
            />
            {duplicateError ? (
              <p className="text-sm text-destructive">{duplicateError}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              The copy opens as a draft so you can review it and generate a fresh message.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDuplicateSource(null)}>
              Cancel
            </Button>
            <Button onClick={handleDuplicate} disabled={duplicating}>
              {duplicating ? <Loader2 className="animate-spin" /> : <CopyPlus />}
              {duplicating ? "Copying…" : "Duplicate schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
