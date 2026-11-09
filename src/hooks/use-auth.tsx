import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import type { Session } from "@supabase/supabase-js"
import { requireSupabase, supabase } from "@/lib/supabase"

interface AuthContextValue {
  session: Session | null
  loading: boolean
  signIn: (username: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// Supabase Auth signs in with an email. The app shows a username instead and
// maps it to the account's internal address.
const USERNAME_EMAILS: Record<string, string> = {
  uma: "uma@duty.local",
}

function friendlyAuthError(message: string): string {
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Username or password is incorrect."
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "This account is not confirmed yet."
  }
  if (message.toLowerCase().includes("failed to fetch")) {
    return "Could not reach Supabase. Check the URL in your .env.local file."
  }
  return message
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    let active = true
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      loading,
      async signIn(username, password) {
        const email = USERNAME_EMAILS[username.trim().toLowerCase()]
        if (!email) throw new Error("Username or password is incorrect.")
        const client = requireSupabase()
        const { data, error } = await client.auth.signInWithPassword({
          email,
          password,
        })
        if (error) throw new Error(friendlyAuthError(error.message))
        setSession(data.session)
      },
      async signOut() {
        const client = requireSupabase()
        const { error } = await client.auth.signOut()
        if (error) throw new Error(friendlyAuthError(error.message))
      },
    }),
    [session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error("useAuth must be used inside AuthProvider")
  return context
}
