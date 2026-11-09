import { Copy, RefreshCw } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"

interface MessagePanelProps {
  value: string
  onChange: (value: string) => void
  onCopy: () => void
  onRegenerate: () => void
  stale: boolean
  edited: boolean
  disabled?: boolean
}

export function MessagePanel({
  value,
  onChange,
  onCopy,
  onRegenerate,
  stale,
  edited,
  disabled = false,
}: MessagePanelProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle>WhatsApp message</CardTitle>
          {edited ? <Badge variant="outline">Edited by hand</Badge> : null}
        </div>
        <CardDescription>
          Review or adjust the wording. Editing this message does not change the duty
          assignments.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Textarea
          aria-label="WhatsApp message"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          rows={12}
          className="min-h-64 resize-y bg-card font-sans"
        />
        {stale ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
            The assignments changed after this message was made. Generate it again to
            pick up the changes.
          </p>
        ) : null}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          The message is saved with the schedule, exactly as shown.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onRegenerate} disabled={disabled}>
            <RefreshCw />
            Regenerate
          </Button>
          <Button onClick={onCopy} disabled={disabled || !value.trim()}>
            <Copy />
            Copy Message
          </Button>
        </div>
      </CardFooter>
    </Card>
  )
}
