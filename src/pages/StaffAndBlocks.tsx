import { useEffect, useState, type FormEvent } from "react"
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Loader2,
  Pencil,
  Plus,
} from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
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
import {
  createBlock,
  createStaff,
  fetchBlocks,
  fetchStaff,
  reorderBlocks,
  reorderStaff,
  setBlockActive,
  setStaffActive,
  updateBlock,
  updateStaff,
} from "@/lib/api"
import type { StaffMember, WorkBlock } from "@/lib/types"

type ItemKind = "staff" | "block"
type NamedItem = StaffMember | WorkBlock

interface EditorState {
  kind: ItemKind
  id: string | null
}

function duplicateMessage(error: unknown, kind: ItemKind): string {
  const message = error instanceof Error ? error.message : ""
  if (message.toLowerCase().includes("duplicate key")) {
    return `A ${kind === "staff" ? "staff member" : "block"} with this name already exists.`
  }
  return message || "Could not save the change."
}

function ItemRow({
  item,
  canMoveUp,
  canMoveDown,
  busy,
  onMove,
  onEdit,
  onToggle,
}: {
  item: NamedItem
  canMoveUp: boolean
  canMoveDown: boolean
  busy: boolean
  onMove: (direction: "up" | "down") => void
  onEdit: () => void
  onToggle: () => void
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-medium">{item.display_name}</p>
          {!item.is_active ? <Badge variant="outline">Inactive</Badge> : null}
        </div>
        {item.name !== item.display_name ? (
          <p className="truncate text-xs text-muted-foreground">{item.name}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-0.5 self-start sm:self-auto">
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9"
          title="Move up"
          aria-label={`Move ${item.display_name} up`}
          disabled={!canMoveUp || busy}
          onClick={() => onMove("up")}
        >
          <ChevronUp />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9"
          title="Move down"
          aria-label={`Move ${item.display_name} down`}
          disabled={!canMoveDown || busy}
          onClick={() => onMove("down")}
        >
          <ChevronDown />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-9"
          title="Edit"
          aria-label={`Edit ${item.display_name}`}
          disabled={busy}
          onClick={onEdit}
        >
          <Pencil />
        </Button>
        <Button
          variant={item.is_active ? "ghost" : "outline"}
          size="sm"
          disabled={busy}
          onClick={onToggle}
          className="ml-1"
        >
          {busy ? <Loader2 className="animate-spin" /> : null}
          {item.is_active ? "Deactivate" : "Activate"}
        </Button>
      </div>
    </div>
  )
}

export function StaffAndBlocksPage() {
  const [staff, setStaff] = useState<StaffMember[]>([])
  const [blocks, setBlocks] = useState<WorkBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [editor, setEditor] = useState<EditorState | null>(null)
  const [name, setName] = useState("")
  const [displayName, setDisplayName] = useState("")
  const [displayTouched, setDisplayTouched] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [savingItem, setSavingItem] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [staffRows, blockRows] = await Promise.all([fetchStaff(), fetchBlocks()])
        if (cancelled) return
        setStaff(staffRows)
        setBlocks(blockRows)
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error ? loadError.message : "Could not load the lists.",
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [reloadKey])

  function openCreate(kind: ItemKind) {
    setEditor({ kind, id: null })
    setName("")
    setDisplayName("")
    setDisplayTouched(false)
    setFormError(null)
  }

  function openEdit(kind: ItemKind, item: NamedItem) {
    setEditor({ kind, id: item.id })
    setName(item.name)
    setDisplayName(item.display_name)
    setDisplayTouched(true)
    setFormError(null)
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!editor) return
    if (!name.trim()) {
      setFormError("Enter a name.")
      return
    }
    if (!displayName.trim()) {
      setFormError("Enter the name that should appear in the schedule message.")
      return
    }
    setSavingItem(true)
    setFormError(null)
    try {
      const input = { name: name.trim(), display_name: displayName.trim() }
      if (editor.kind === "staff") {
        if (editor.id) await updateStaff(editor.id, input)
        else await createStaff(input)
      } else {
        if (editor.id) await updateBlock(editor.id, input)
        else await createBlock(input)
      }
      toast.success(
        editor.id
          ? "Changes saved"
          : `${editor.kind === "staff" ? "Staff member" : "Block"} added`,
      )
      setEditor(null)
      setReloadKey((key) => key + 1)
    } catch (saveError) {
      setFormError(duplicateMessage(saveError, editor.kind))
    } finally {
      setSavingItem(false)
    }
  }

  async function handleToggle(kind: ItemKind, item: NamedItem) {
    const nextActive = !item.is_active
    if (
      !nextActive &&
      !window.confirm(
        `Deactivate ${item.display_name}? ${
          kind === "staff" ? "They" : "It"
        } will no longer appear in new daily schedules. Saved schedules stay unchanged.`,
      )
    ) {
      return
    }
    setBusyId(item.id)
    try {
      if (kind === "staff") await setStaffActive(item.id, nextActive)
      else await setBlockActive(item.id, nextActive)
      toast.success(nextActive ? "Reactivated" : "Deactivated")
      setReloadKey((key) => key + 1)
    } catch (toggleError) {
      toast.error(
        toggleError instanceof Error ? toggleError.message : "Could not update the item.",
      )
    } finally {
      setBusyId(null)
    }
  }

  async function handleMove(kind: ItemKind, item: NamedItem, direction: "up" | "down") {
    const list: NamedItem[] = kind === "staff" ? staff : blocks
    const index = list.findIndex((entry) => entry.id === item.id)
    const swapIndex = direction === "up" ? index - 1 : index + 1
    if (index < 0 || swapIndex < 0 || swapIndex >= list.length) return
    const neighbour = list[swapIndex]
    if (neighbour.is_active !== item.is_active) return

    const reordered = [...list]
    reordered[index] = neighbour
    reordered[swapIndex] = item
    setBusyId(item.id)
    try {
      const ids = reordered.map((entry) => entry.id)
      if (kind === "staff") await reorderStaff(ids)
      else await reorderBlocks(ids)
      setReloadKey((key) => key + 1)
    } catch (moveError) {
      toast.error(
        moveError instanceof Error ? moveError.message : "Could not change the order.",
      )
    } finally {
      setBusyId(null)
    }
  }

  function moveDisabled(kind: ItemKind, item: NamedItem, direction: "up" | "down") {
    const list: NamedItem[] = kind === "staff" ? staff : blocks
    const index = list.findIndex((entry) => entry.id === item.id)
    const neighbour = list[direction === "up" ? index - 1 : index + 1]
    return !neighbour || neighbour.is_active !== item.is_active
  }

  const staffTitle = editor?.kind === "staff" ? "staff member" : "block"

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
          Staff &amp; Blocks
        </h1>
        <p className="text-sm text-muted-foreground">
          Add people and workplace blocks, rename them, or deactivate the ones no longer
          in use.
        </p>
      </div>

      {error ? (
        <div className="space-y-3">
          <Alert variant="destructive">
            <AlertTriangle />
            <AlertTitle>Could not load the lists</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
            Try again
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Staff members</CardTitle>
            <CardDescription>
              The order here is the order used in the WhatsApp message.
            </CardDescription>
            <CardAction>
              <Button size="sm" onClick={() => openCreate("staff")}>
                <Plus />
                Add staff
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : staff.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No staff yet. Add the first staff member.
              </p>
            ) : (
              staff.map((member) => (
                <ItemRow
                  key={member.id}
                  item={member}
                  canMoveUp={!moveDisabled("staff", member, "up")}
                  canMoveDown={!moveDisabled("staff", member, "down")}
                  busy={busyId === member.id}
                  onMove={(direction) => handleMove("staff", member, direction)}
                  onEdit={() => openEdit("staff", member)}
                  onToggle={() => handleToggle("staff", member)}
                />
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workplace blocks</CardTitle>
            <CardDescription>
              Blocks appear as choices on the daily schedule and in the message.
            </CardDescription>
            <CardAction>
              <Button size="sm" onClick={() => openCreate("block")}>
                <Plus />
                Add block
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-lg bg-muted" />
                ))}
              </div>
            ) : blocks.length === 0 ? (
              <p className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                No blocks yet. Add the first workplace block.
              </p>
            ) : (
              blocks.map((block) => (
                <ItemRow
                  key={block.id}
                  item={block}
                  canMoveUp={!moveDisabled("block", block, "up")}
                  canMoveDown={!moveDisabled("block", block, "down")}
                  busy={busyId === block.id}
                  onMove={(direction) => handleMove("block", block, direction)}
                  onEdit={() => openEdit("block", block)}
                  onToggle={() => handleToggle("block", block)}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Renaming a staff member or block only affects future schedules. Saved schedules
        keep the names used on the day they were saved.
      </p>

      <Dialog
        open={Boolean(editor)}
        onOpenChange={(open) => {
          if (!open) setEditor(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editor?.id ? "Edit" : "Add"} {staffTitle}
            </DialogTitle>
            <DialogDescription>
              {editor?.kind === "staff"
                ? "The display name is exactly what appears in the daily message."
                : "Use the full block name and a short display name if the message needs one."}
            </DialogDescription>
          </DialogHeader>
          <form id="item-form" onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">
                {editor?.kind === "staff" ? "Full name" : "Block name"}
              </Label>
              <Input
                id="item-name"
                required
                value={name}
                onChange={(event) => {
                  setName(event.target.value)
                  if (!displayTouched) setDisplayName(event.target.value)
                }}
                placeholder={
                  editor?.kind === "staff" ? "Sister Jeeva" : "Phone Block"
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="item-display">Name shown in messages</Label>
              <Input
                id="item-display"
                required
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value)
                  setDisplayTouched(true)
                }}
                placeholder={
                  editor?.kind === "staff" ? "Sister Jeeva" : "Phone Block"
                }
              />
              <p className="text-xs text-muted-foreground">
                Saved schedules keep the old name, so the past stays unchanged.
              </p>
            </div>
            {formError ? <p className="text-sm text-destructive">{formError}</p> : null}
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button type="submit" form="item-form" disabled={savingItem}>
              {savingItem ? <Loader2 className="animate-spin" /> : null}
              {editor?.id ? "Save changes" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
