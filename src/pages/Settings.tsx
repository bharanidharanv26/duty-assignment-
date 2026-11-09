import { useEffect, useState, type FormEvent } from "react"
import { AlertTriangle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchBlocks, fetchSettings, saveSettings } from "@/lib/api"
import {
  type AppSettings,
  type BlockJoiner,
  type SettingsInput,
  type WorkBlock,
} from "@/lib/types"

function toInput(settings: AppSettings): SettingsInput {
  return {
    message_heading: settings.message_heading,
    duty_7am_label: settings.duty_7am_label,
    duty_11am_label: settings.duty_11am_label,
    gerugambakkam_label: settings.gerugambakkam_label,
    night_duty_label: settings.night_duty_label,
    leave_label: settings.leave_label,
    comp_off_label: settings.comp_off_label,
    weekly_off_label: settings.weekly_off_label,
    block_joiner: settings.block_joiner,
    block_abbreviations: { ...settings.block_abbreviations },
  }
}

function LabelField({
  id,
  label,
  value,
  hint,
  onChange,
}: {
  id: string
  label: string
  value: string
  hint?: string
  onChange: (value: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        value={value}
        required
        maxLength={40}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  )
}

export function SettingsPage() {
  const [form, setForm] = useState<SettingsInput | null>(null)
  const [blocks, setBlocks] = useState<WorkBlock[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [settingsRow, blockRows] = await Promise.all([
          fetchSettings(),
          fetchBlocks(),
        ])
        if (cancelled) return
        setForm(toInput(settingsRow))
        setBlocks(blockRows)
      } catch (loadError) {
        if (cancelled) return
        setError(
          loadError instanceof Error ? loadError.message : "Could not load the settings.",
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

  function updateForm(patch: Partial<SettingsInput>) {
    setForm((current) => (current ? { ...current, ...patch } : current))
  }

  function updateAbbreviation(blockId: string, value: string) {
    setForm((current) =>
      current
        ? {
            ...current,
            block_abbreviations: {
              ...current.block_abbreviations,
              [blockId]: value,
            },
          }
        : current,
    )
  }

  async function handleSettingsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form) return
    const labels = [
      form.duty_7am_label,
      form.duty_11am_label,
      form.gerugambakkam_label,
      form.night_duty_label,
      form.leave_label,
      form.comp_off_label,
      form.weekly_off_label,
    ]
    if (labels.some((label) => !label.trim())) {
      toast.error("Duty and status labels cannot be empty.")
      return
    }
    setSavingSettings(true)
    try {
      const saved = await saveSettings({
        ...form,
        message_heading: form.message_heading.trim(),
        duty_7am_label: form.duty_7am_label.trim(),
        duty_11am_label: form.duty_11am_label.trim(),
        gerugambakkam_label: form.gerugambakkam_label.trim(),
        night_duty_label: form.night_duty_label.trim(),
        leave_label: form.leave_label.trim(),
        comp_off_label: form.comp_off_label.trim(),
        weekly_off_label: form.weekly_off_label.trim(),
      })
      setForm(toInput(saved))
      toast.success("Message settings saved")
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Could not save the settings.",
      )
    } finally {
      setSavingSettings(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4" aria-busy="true">
        <div className="h-7 w-40 animate-pulse rounded-lg bg-muted" />
        <div className="h-80 animate-pulse rounded-xl bg-muted" />
        <div className="h-64 animate-pulse rounded-xl bg-muted" />
      </div>
    )
  }

  if (error || !form) {
    return (
      <div className="space-y-3">
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Could not load the settings</AlertTitle>
          <AlertDescription>{error ?? "Settings are unavailable."}</AlertDescription>
        </Alert>
        <Button variant="outline" onClick={() => setReloadKey((key) => key + 1)}>
          Try again
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">Settings</h1>
        <p className="text-sm text-muted-foreground">
          Adjust the message wording and block abbreviations.
        </p>
      </div>

      <form onSubmit={handleSettingsSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Message wording</CardTitle>
            <CardDescription>
              These labels appear in every generated message. You can still edit each
              message before copying it.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="message-heading">Message heading</Label>
              <Input
                id="message-heading"
                value={form.message_heading}
                onChange={(event) => updateForm({ message_heading: event.target.value })}
                placeholder="Duty Schedule – {date}"
              />
              <p className="text-xs text-muted-foreground">
                {"{date}"} is replaced with the schedule date. Leave it blank for no
                heading.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <LabelField
                id="label-7am"
                label="7 AM duty label"
                value={form.duty_7am_label}
                onChange={(value) => updateForm({ duty_7am_label: value })}
              />
              <LabelField
                id="label-11am"
                label="11 AM duty label"
                value={form.duty_11am_label}
                onChange={(value) => updateForm({ duty_11am_label: value })}
              />
              <LabelField
                id="label-gerugambakkam"
                label="Gerugambakkam duty label"
                value={form.gerugambakkam_label}
                onChange={(value) => updateForm({ gerugambakkam_label: value })}
              />
              <LabelField
                id="label-night"
                label="Night duty label"
                value={form.night_duty_label}
                onChange={(value) => updateForm({ night_duty_label: value })}
              />
              <LabelField
                id="label-leave"
                label="Leave label"
                value={form.leave_label}
                onChange={(value) => updateForm({ leave_label: value })}
              />
              <LabelField
                id="label-comp-off"
                label="Comp Off label"
                value={form.comp_off_label}
                onChange={(value) => updateForm({ comp_off_label: value })}
              />
              <LabelField
                id="label-weekly-off"
                label="Weekly Off label"
                value={form.weekly_off_label}
                onChange={(value) => updateForm({ weekly_off_label: value })}
              />
            </div>

            <div className="space-y-1.5 sm:max-w-xs">
              <Label htmlFor="block-joiner">How to join multiple blocks</Label>
              <Select
                value={form.block_joiner}
                onValueChange={(value) =>
                  updateForm({ block_joiner: value as BlockJoiner })
                }
              >
                <SelectTrigger id="block-joiner" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="and">Helpage and CY Block</SelectItem>
                  <SelectItem value="comma">Helpage, CY Block</SelectItem>
                  <SelectItem value="slash">Helpage / CY Block</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">Block abbreviations</p>
                <p className="text-xs text-muted-foreground">
                  Optional short names for long blocks. Leave blank to use the full block
                  name.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {blocks.map((block) => (
                  <div key={block.id} className="space-y-1.5">
                    <Label
                      htmlFor={`abbreviation-${block.id}`}
                      className="text-xs font-medium text-muted-foreground"
                    >
                      {block.display_name}
                      {!block.is_active ? " (inactive)" : ""}
                    </Label>
                    <Input
                      id={`abbreviation-${block.id}`}
                      value={form.block_abbreviations[block.id] ?? ""}
                      maxLength={16}
                      placeholder={block.display_name}
                      onChange={(event) =>
                        updateAbbreviation(block.id, event.target.value)
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" disabled={savingSettings}>
              {savingSettings ? <Loader2 className="animate-spin" /> : null}
              Save message settings
            </Button>
          </CardFooter>
        </Card>
      </form>

    </div>
  )
}
