import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Session } from '@supabase/supabase-js'
import Auth from '@/components/Auth'
import SearchForm from '@/components/SearchForm'
import NameSearchForm from '@/components/NameSearchForm'
import ResultsTable from '@/components/ResultsTable'
import SearchHistory from '@/components/SearchHistory'
import LeadsManager from '@/components/LeadsManager'
import { Toaster } from '@/components/ui/toaster'

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'history' | 'manager'>('history')
  const [searchType, setSearchType] = useState<'company' | 'name'>('company')

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
              {/* Search Type Tabs */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setSearchType('company')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${searchType === 'company'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    🏢 By Company
                  </button>
                  <button
                    onClick={() => setSearchType('name')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${searchType === 'name'
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    👤 By Name
                  </button>
                </div>
              </div>

              {/* Conditional Search Form */}
              {searchType === 'company' ? <SearchForm /> : <NameSearchForm />}

              {/* Tab Navigation */}
              <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <div className="flex border-b border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('history')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'history'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    Recent Searches
                  </button>
                  <button
                    onClick={() => setActiveTab('manager')}
                    className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'manager'
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                      }`}
                  >
                    Leads Manager
                  </button>
                </div>
              </div>

              {activeTab === 'history' ? (
                <SearchHistory
                  onSelectJob={setSelectedJobId}
                  selectedJobId={selectedJobId}
                />
              ) : (
                <LeadsManager
                  onSelectJob={setSelectedJobId}
                  selectedJobId={selectedJobId}
                />
              )}
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
