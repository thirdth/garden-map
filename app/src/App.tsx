import { useEffect, useState } from 'react'
import { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import { SignIn } from './components/SignIn'
import { GardenApp } from './components/GardenApp'

const ALLOWED_EMAILS = (import.meta.env.VITE_ALLOWED_EMAILS ?? '')
  .split(',')
  .map((e: string) => e.trim().toLowerCase())
  .filter(Boolean)

function isAllowed(email: string | undefined): boolean {
  if (!email) return false
  if (ALLOWED_EMAILS.length === 0) return true // no restriction configured
  return ALLOWED_EMAILS.includes(email.toLowerCase())
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !isAllowed(session.user.email)) {
        supabase.auth.signOut()
        setDenied(true)
      } else {
        setSession(session)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && !isAllowed(session.user.email)) {
        supabase.auth.signOut()
        setDenied(true)
        setSession(null)
      } else {
        setDenied(false)
        setSession(session)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-stone-400 text-sm">Loading…</div>
      </div>
    )
  }

  if (denied) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="text-center max-w-sm">
          <p className="text-stone-700 font-medium mb-1">Access denied</p>
          <p className="text-stone-400 text-sm mb-4">This app is private. Your Google account is not on the invite list.</p>
          <button
            onClick={() => setDenied(false)}
            className="text-sm text-green-700 hover:underline"
          >
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return session ? <GardenApp session={session} /> : <SignIn />
}
