import { Database, KeyRound, ShieldCheck, Terminal } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const steps = [
  {
    icon: Database,
    title: "1. Create a Supabase project",
    body: "Open supabase.com, create a project, then run the three files in supabase/migrations in order (init, admin lockdown, function hardening) and finally supabase/seed.sql. The seed adds the 10 sisters and 10 blocks.",
  },
  {
    icon: KeyRound,
    title: "2. Create the administrator",
    body: "Create the account in Authentication → Users with the internal address uma@duty.local and a password of at least 6 characters, then turn on Auto Confirm. Add its id to public.admin_users (SQL in README.md) so RLS authorizes it. The login screen shows username uma; it maps to that address. Keep public sign-up disabled; this is the only account.",
  },
  {
    icon: ShieldCheck,
    title: "3. Add the browser key",
    body: "Create a file called .env.local in the project folder with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY. Use the anon/publishable key from Project Settings → API. Never use the service role key here.",
  },
  {
    icon: Terminal,
    title: "4. Restart the app",
    body: "Stop the dev server, run npm run dev again, and sign in with username uma and the password you set. All data is stored in Supabase.",
  },
]

export function SetupNotice() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background px-4 py-10">
      <div className="w-full max-w-xl space-y-5">
        <div className="space-y-1">
          <p className="text-sm font-medium text-primary">Daily Duty Manager</p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Connect Supabase to get started
          </h1>
          <p className="text-sm text-muted-foreground">
            The app needs its database before it can load staff, blocks or schedules.
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Setup checklist</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {steps.map((step) => (
              <div key={step.title} className="flex gap-3">
                <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
                  <step.icon className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.body}</p>
                </div>
              </div>
            ))}

            <div className="rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed text-muted-foreground">
              VITE_SUPABASE_URL=https://your-project.supabase.co
              <br />
              VITE_SUPABASE_ANON_KEY=your-anon-key
            </div>
            <p className="text-xs text-muted-foreground">
              Full instructions, SQL and deployment notes are in README.md.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
