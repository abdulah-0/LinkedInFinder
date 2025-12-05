import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Auth from '@/components/Auth'
import SearchForm from '@/components/SearchForm'
import ResultsTable from '@/components/ResultsTable'
import SearchHistory from '@/components/SearchHistory'
import { Toaster } from '@/components/ui/toaster'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (!session) {
    return <Auth />
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <header className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <h1 className="text-3xl font-bold tracking-tight">LinkedIn Finder</h1>
          <button
            onClick={() => supabase.auth.signOut()}
            className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-1 space-y-8">
              <SearchForm />
              <SearchHistory
                onSelectJob={setSelectedJobId}
                selectedJobId={selectedJobId}
              />
            </div>
            <div className="lg:col-span-3">
              <ResultsTable selectedJobId={selectedJobId} />
            </div>
          </div>
        </div>
      </main>
      <Toaster />
    </div>
  )
}

export default App
