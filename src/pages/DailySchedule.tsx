import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react"
import {
  AlertTriangle,
  Eraser,
  History,
  Loader2,
  Save,
  Settings2,
  Wand2,
} from "lucide-react"
import { Link, useSearchParams } from "react-router-dom"
import { toast } from "sonner"
import { MessagePanel } from "@/components/MessagePanel"
import { StaffAssignmentCard } from "@/components/StaffAssignmentCard"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import {
  fetchBlocks,
  fetchPreviousSchedule,
  fetchSchedule,
  fetchSettings,
  fetchStaff,
  saveSchedule,
} from "@/lib/api"
import {
  availableBlocksForAssignment,
  buildAssignments,
  generateScheduleMessage,
  issuesByStaff,
  validateAssignments,
  type ValidationLabels,
} from "@/lib/assignments"
import { copyText } from "@/lib/clipboard"
import {
  formatFullDate,
  formatShortDate,
  isISODate,
  todayISO,
} from "@/lib/date"
import {
  DEFAULT_APP_SETTINGS,
  defaultDutyLabels,
  type AppSettings,
  type DailySchedule,
  type StaffAssignment,
  type StaffMember,
  type WorkBlock,
} from "@/lib/types"

export function DailySchedulePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dateParam = searchParams.get("date")
  const [date, setDate] = useState(isISODate(dateParam) ? dateParam : todayISO())

  const [staff, setStaff] = useState<StaffMember[]>([])
  const [blocks, setBlocks] = useState<WorkBlock[]>([])
  const [settings, setSettings] = useState<AppSettings | null>(null)
  const [assignments, setAssignments] = useState<StaffAssignment[]>([])
  const [savedSchedule, setSavedSchedule] = useState<DailySchedule | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [copying, setCopying] = useState(false)

  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null)
  const [messageText, setMessageText] = useState("")
  const [messageEdited, setMessageEdited] = useState(false)
  const [messageBase, setMessageBase] = useState("")
  const [showMessage, setShowMessage] = useState(false)
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false)
  const messagePanelRef = useRef<HTMLDivElement | null>(null)

  const activeStaff = useMemo(() => staff.filter((member) => member.is_active), [staff])
  const activeBlocks = useMemo(
    () => blocks.filter((block) => block.is_active),
    [blocks],
  )
  const activeStaffIds = useMemo(
    () => new Set(activeStaff.map((member) => member.id)),
    [activeStaff],
  )

  const availableBlocksByStaff = useMemo(() => {
    const map = new Map<string, WorkBlock[]>()
    for (const assignment of assignments) {
      map.set(
        assignment.staff_id,
        availableBlocksForAssignment(assignment, activeBlocks, assignments),
      )
    }
    return map
  }, [assignments, activeBlocks])

  const validationLabels = useMemo<ValidationLabels>(() => {
    if (!settings) {
      return {
        duty: defaultDutyLabels(),
        leave: "Leave",
        compOff: "Comp Off",
        weeklyOff: "Weekly Off",
      }
    }
    return {
      duty: {
        "7am": settings.duty_7am_label,
        "11am": settings.duty_11am_label,
        gerugambakkam: settings.gerugambakkam_label,
        night: settings.night_duty_label,
      },
      leave: settings.leave_label,
      compOff: settings.comp_off_label,
      weeklyOff: settings.weekly_off_label,
    }
  }, [settings])

  const issues = useMemo(
    () => validateAssignments(assignments, validationLabels),
    [assignments, validationLabels],
  )
  const cardIssues = useMemo(() => issuesByStaff(issues), [issues])
  const isValid = issues.length === 0

  const assignedCount = assignments.filter(
    (assignment) =>
      activeStaffIds.has(assignment.staff_id) &&
      (assignment.status !== "working" ||
        assignment.duty !== null ||
        assignment.blocks.length > 0),
  ).length
  const canFinalize = isValid && activeStaff.length > 0 && assignedCount > 0

  const messageStale =
    showMessage && messageBase !== JSON.stringify(assignments)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError(null)
      try {
        const [staffRows, blockRows, settingsRow, schedule] = await Promise.all([
          fetchStaff(),
          fetchBlocks(),
          fetchSettings(),
          fetchSchedule(date),
        ])
        if (cancelled) return

        const active = staffRows.filter((member) => member.is_active)
        const built = buildAssignments({
          staff: active,
          blocks: blockRows,
          saved: schedule?.assignments ?? null,
        })

        const generated = schedule?.generated_message ?? null
        const final = schedule?.final_message ?? null
        const message = final ?? generated ?? ""

        setStaff(staffRows)
        setBlocks(blockRows)
        setSettings(settingsRow)
        setAssignments(built)
        setSavedSchedule(schedule)
        setGeneratedMessage(generated)
        setMessageText(message)
        setMessageEdited(Boolean(final && generated && final.trim() !== generated.trim()))
        setShowMessage(Boolean(message))
        setMessageBase(JSON.stringify(built))
        const savedIds = new Set(
          (schedule?.assignments ?? []).map((entry) => entry.staff_id),
        )
        setDirty(
          Boolean(schedule) && built.some((entry) => !savedIds.has(entry.staff_id)),
        )
      } catch (error) {
        if (cancelled) return
        setLoadError(
          error instanceof Error ? error.message : "Could not load this schedule.",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [date, reloadKey])

  function updateAssignment(
    staffId: string,
    updater: (assignment: StaffAssignment) => StaffAssignment,
  ) {
    setAssignments((current) =>
      current.map((assignment) =>
        assignment.staff_id === staffId ? updater(assignment) : assignment,
      ),
    )
    setDirty(true)
  }

  function resetMessage() {
    setGeneratedMessage(null)
    setMessageText("")
    setMessageEdited(false)
    setShowMessage(false)
    setMessageBase("")
  }

  function handleDateChange(event: ChangeEvent<HTMLInputElement>) {
    const next = event.target.value
    if (!isISODate(next) || next === date) return
    if (
      dirty &&
      !window.confirm(
        "You have unsaved changes for this date. Change the date anyway?",
      )
    ) {
      event.target.value = date
      return
    }
    setDate(next)
    setSearchParams(next === todayISO() ? {} : { date: next }, { replace: true })
  }

  function goToToday() {
    if (date === todayISO()) return
    if (dirty && !window.confirm("You have unsaved changes for this date. Change the date anyway?")) {
      return
    }
    setDate(todayISO())
    setSearchParams({}, { replace: true })
  }

  function handleClear() {
    if (!window.confirm("Clear every assignment for this date?")) return
    setAssignments((current) =>
      current.map((assignment) => ({
        ...assignment,
        status: "working",
        duty: null,
        blocks: [],
      })),
    )
    setDirty(true)
    resetMessage()
    toast.success("Assignments cleared")
  }

  async function handleCopyPrevious() {
    if (
      dirty &&
      !window.confirm(
        "Replace the current assignments with the previous saved schedule?",
      )
    ) {
      return
    }
    setCopying(true)
    try {
      const previous = await fetchPreviousSchedule(date)
      if (!previous) {
        toast.error("There is no earlier saved schedule to copy.")
        return
      }
      const built = buildAssignments({
        staff: activeStaff,
        blocks,
        saved: previous.assignments,
      })
      setAssignments(built)
      setDirty(true)
      resetMessage()
      toast.success(
        `Copied the assignments from ${formatShortDate(previous.schedule_date)}. Generate the message when ready.`,
      )
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not copy the previous schedule.",
      )
    } finally {
      setCopying(false)
    }
  }

  function applyGeneratedMessage() {
    if (!settings) return
    const text = generateScheduleMessage(assignments, settings, date)
    setGeneratedMessage(text)
    setMessageText(text)
    setMessageEdited(false)
    setShowMessage(true)
    setMessageBase(JSON.stringify(assignments))
    setDirty(true)
    toast.success("Message generated. Review it before copying.")
    window.setTimeout(() => {
      messagePanelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
    }, 60)
  }

  function handleGenerate() {
    if (activeStaff.length === 0) {
      toast.error("Add at least one active staff member first.")
      return
    }
    if (assignedCount === 0) {
      toast.error("Assign at least one sister before generating the message.")
      return
    }
    if (!isValid) {
      toast.error("Fix the conflicting assignments before generating the message.")
      return
    }
    if (messageEdited && messageText.trim().length > 0) {
      setConfirmRegenerateOpen(true)
      return
    }
    applyGeneratedMessage()
  }

  async function handleCopy() {
    if (!messageText.trim()) {
      toast.error("Generate the message first.")
      return
    }
    try {
      await copyText(messageText)
      toast.success("Message copied")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not copy the message.")
    }
  }

  async function handleSave() {
    if (!settings || !canFinalize) {
      toast.error(
        activeStaff.length === 0
          ? "Add at least one active staff member first."
          : assignedCount === 0
            ? "Assign at least one sister before saving."
            : "Fix the conflicting assignments before saving.",
      )
      return
    }
    if (
      messageStale &&
      !window.confirm(
        "The message was generated before your latest assignment changes. Save it anyway?",
      )
    ) {
      return
    }
    setSaving(true)
    try {
      const generated =
        generatedMessage ?? generateScheduleMessage(assignments, settings, date)
      const final = messageText.trim() || generated
      const saved = await saveSchedule({
        schedule_date: date,
        assignments,
        generated_message: generated,
        final_message: final,
        status: "finalized",
      })
      setSavedSchedule(saved)
      setGeneratedMessage(generated)
      setMessageText(final)
      setMessageEdited(final.trim() !== generated.trim())
      setShowMessage(true)
      setMessageBase(JSON.stringify(assignments))
      setDirty(false)
      toast.success("Schedule saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the schedule.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-7 w-52 animate-pulse rounded-lg bg-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-64 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <p className="sr-only">Loading schedule…</p>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="space-y-4">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Could not load the schedule</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
          Try again
        </Button>
      </div>
    )
  }

  const statusBadge = !savedSchedule
    ? { label: "Not saved", className: "bg-muted text-muted-foreground" }
    : dirty
      ? { label: "Unsaved changes", className: "bg-amber-100 text-amber-900" }
      : savedSchedule.status === "draft"
        ? { label: "Draft", className: "bg-amber-100 text-amber-900" }
        : { label: "Saved", className: "bg-emerald-100 text-emerald-900" }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Daily Schedule
          </h1>
          <p className="text-sm text-muted-foreground">{formatFullDate(date)}</p>
        </div>
        <Badge variant="secondary" className={statusBadge.className}>
          {statusBadge.label}
        </Badge>
      </div>

      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-1.5">
              <Label htmlFor="schedule-date">Schedule date</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="schedule-date"
                  type="date"
                  value={date}
                  onChange={handleDateChange}
                  className="w-44"
                />
                <Button
                  variant="outline"
                  onClick={goToToday}
                  disabled={date === todayISO()}
                >
                  Today
                </Button>
              </div>
            </div>

            <div className="grid gap-2 sm:flex sm:flex-wrap sm:justify-end">
              <Button
                variant="ghost"
                onClick={handleClear}
                disabled={saving}
                className="justify-start sm:justify-center"
              >
                <Eraser />
                Clear Assignments
              </Button>
              <Button
                variant="outline"
                onClick={handleCopyPrevious}
                disabled={saving || copying}
                className="justify-start sm:justify-center"
              >
                {copying ? <Loader2 className="animate-spin" /> : <History />}
                Copy Previous Schedule
              </Button>
              <Button
                variant="secondary"
                onClick={handleGenerate}
                disabled={!canFinalize || saving}
                className="justify-start sm:justify-center"
              >
                <Wand2 />
                Generate Schedule
              </Button>
              <Button
                onClick={handleSave}
                disabled={!canFinalize || saving}
                className="justify-start sm:justify-center"
              >
                {saving ? <Loader2 className="animate-spin" /> : <Save />}
                {saving ? "Saving…" : "Save Schedule"}
              </Button>
            </div>
          </div>
          {!canFinalize && activeStaff.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {assignedCount === 0
                ? "Assign at least one sister to generate or save."
                : "Fix the conflicting assignments below to generate or save."}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {settings && activeStaff.length === 0 ? (
        <Alert>
          <AlertTriangle />
          <AlertTitle>No active staff members</AlertTitle>
          <AlertDescription>
            Add staff in Staff &amp; Blocks before preparing a schedule.
          </AlertDescription>
        </Alert>
      ) : null}

      {settings && showMessage ? (
        <div ref={messagePanelRef}>
          <MessagePanel
            value={messageText}
            onChange={(value) => {
              setMessageText(value)
              setMessageEdited(true)
              setDirty(true)
            }}
            onCopy={handleCopy}
            onRegenerate={handleGenerate}
            stale={messageStale}
            edited={messageEdited}
            disabled={!canFinalize || saving}
          />
        </div>
      ) : null}

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Staff assignments</h2>
        <span className="text-xs text-muted-foreground">
          {activeStaff.length} active staff
        </span>
      </div>

      {activeStaff.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-start gap-2 py-6">
            <p className="text-sm font-medium">No active staff members</p>
            <p className="text-sm text-muted-foreground">
              Add staff in Staff &amp; Blocks before preparing a schedule.
            </p>
            <Button variant="outline" asChild>
              <Link to="/staff">
                <Settings2 />
                Open Staff &amp; Blocks
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {assignments.map((assignment) => (
            <StaffAssignmentCard
              key={assignment.staff_id}
              assignment={assignment}
              blocks={availableBlocksByStaff.get(assignment.staff_id) ?? activeBlocks}
              settings={settings ?? DEFAULT_APP_SETTINGS}
              issues={cardIssues.get(assignment.staff_id) ?? []}
              inactive={!activeStaffIds.has(assignment.staff_id)}
              emptyBlocksText={
                activeBlocks.length === 0
                  ? "No blocks available. Add blocks in Staff & Blocks."
                  : "All blocks are assigned to other sisters."
              }
              onChange={(next) => updateAssignment(assignment.staff_id, () => next)}
            />
          ))}
        </div>
      )}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t bg-background/95 p-3 backdrop-blur sm:hidden">
        <div className="mx-auto flex max-w-md gap-2">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={handleGenerate}
            disabled={!canFinalize || saving}
          >
            <Wand2 />
            Generate
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={!canFinalize || saving}
          >
            {saving ? <Loader2 className="animate-spin" /> : <Save />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <Dialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Replace your edited message?</DialogTitle>
            <DialogDescription>
              You changed the message by hand. Regenerating will replace those edits
              with a new message from the current assignments.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmRegenerateOpen(false)}>
              Keep my edits
            </Button>
            <Button
              onClick={() => {
                setConfirmRegenerateOpen(false)
                applyGeneratedMessage()
              }}
            >
              Replace message
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
