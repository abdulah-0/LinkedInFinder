import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export default function NameSearchForm() {
    const [fullName, setFullName] = useState('')
    const [jobTitle, setJobTitle] = useState('')
    const [companyName, setCompanyName] = useState('')
    const [location, setLocation] = useState('')
    const [enrichmentProvider, setEnrichmentProvider] = useState<'contactout' | 'rocketreach'>('contactout')
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()

        if (!fullName) {
            toast({
                title: "Validation Error",
                description: "Please provide at least a person's name.",
                variant: "destructive"
            })
            return
        }

        setLoading(true)
        try {
            // Get the current session token
            const { data: { session } } = await supabase.auth.getSession()

            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
                },
                body: JSON.stringify({
                    search_type: 'name',
                    full_name: fullName,
                    job_title: jobTitle,
                    company_name: companyName,
                    location,
                    enrichment_provider: enrichmentProvider
                })
            })

            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Unknown error')
            }

            toast({
                title: "Search Started",
                description: "Your name-based search has been queued.",
            })

            // Clear form
            setFullName('')
            setJobTitle('')
            setCompanyName('')
            setLocation('')

        } catch (error: any) {
            toast({
                title: "Search Failed",
                description: error.message,
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Search by Name</h2>
            <form onSubmit={handleSearch} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Full Name <span className="text-red-500">*</span>
                    </label>
                    <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. John Smith"
                        required
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Job Title</label>
                    <input
                        type="text"
                        value={jobTitle}
                        onChange={(e) => setJobTitle(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. CEO, Marketing Director"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company</label>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. Google"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. New York, USA"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Enrichment Provider</label>
                    <select
                        value={enrichmentProvider}
                        onChange={(e) => setEnrichmentProvider(e.target.value as 'contactout' | 'rocketreach')}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                        <option value="contactout">ContactOut</option>
                        <option value="rocketreach">RocketReach</option>
                    </select>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                        Choose which API to use for finding emails and phone numbers
                    </p>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:opacity-50"
                >
                    {loading ? 'Starting Search...' : 'Search'}
                </button>
            </form>
        </div>
    )
}
