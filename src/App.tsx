import { CalendarDays, History, Loader2, LogOut, Settings, Users } from "lucide-react"
import {
  Navigate,
  NavLink,
  Outlet,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom"
import { toast } from "sonner"
import { SetupNotice } from "@/components/SetupNotice"
import { Toaster } from "@/components/ui/sonner"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/hooks/use-auth"
import { isSupabaseConfigured } from "@/lib/supabase"
import { cn } from "@/lib/utils"
import { DailySchedulePage } from "@/pages/DailySchedule"
import { LoginPage } from "@/pages/Login"
import { ScheduleHistoryPage } from "@/pages/ScheduleHistory"
import { SettingsPage } from "@/pages/Settings"
import { StaffAndBlocksPage } from "@/pages/StaffAndBlocks"

const navItems = [
  { to: "/", label: "Daily Schedule", shortLabel: "Daily", icon: CalendarDays, end: true },
  { to: "/history", label: "Schedule History", shortLabel: "History", icon: History },
  { to: "/staff", label: "Staff & Blocks", shortLabel: "Staff", icon: Users },
  { to: "/settings", label: "Settings", shortLabel: "Settings", icon: Settings },
]

function FullPageLoader() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        Loading…
      </div>
    </div>
  )
}

function AppLayout() {
  const { session, loading, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  if (loading) return <FullPageLoader />
  if (!session) {
    return (
      <Navigate
        to="/login"
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  async function handleSignOut() {
    try {
      await signOut()
      navigate("/login", { replace: true })
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not sign out. Try again.",
      )
    }
  }

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
          <div className="flex items-center gap-2.5">
            <div className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarDays className="size-4" />
            </div>
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Daily Duty Manager
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span className="hidden max-w-48 truncate text-xs text-muted-foreground sm:inline">
              {session.user.email}
            </span>
            <Button variant="ghost" size="sm" onClick={handleSignOut}>
              <LogOut />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors",
                  isActive
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )
              }
            >
              <item.icon className="size-4" />
              <span className="sm:hidden">{item.shortLabel}</span>
              <span className="hidden sm:inline">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:py-7 sm:pb-10">
        <Outlet />
      </main>
    </div>
  )
}

export function App() {
  if (!isSupabaseConfigured) {
    return <SetupNotice />
  }

  return (
    <>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AppLayout />}>
          <Route index element={<DailySchedulePage />} />
          <Route path="/history" element={<ScheduleHistoryPage />} />
          <Route path="/staff" element={<StaffAndBlocksPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster position="top-center" theme="light" />
    </>
  )
}
