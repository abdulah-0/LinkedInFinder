import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/hooks/use-toast'

export default function SearchForm() {
    const [companyName, setCompanyName] = useState('')
    const [location, setLocation] = useState('')
    const [businessType, setBusinessType] = useState('')
    const [enrichmentProvider, setEnrichmentProvider] = useState<'contactout' | 'rocketreach'>('contactout')
    const [loading, setLoading] = useState(false)
    const { toast } = useToast()

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!companyName && !location && !businessType) {
            toast({
                title: "Validation Error",
                description: "Please provide at least one search parameter.",
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
                    company_name: companyName,
                    location,
                    business_type: businessType,
                    enrichment_provider: enrichmentProvider
                })
            })

            const data = await response.json()

            if (!response.ok || !data.success) {
                throw new Error(data.error || 'Unknown error')
            }

            toast({
                title: "Search Started",
                description: "Your search job has been queued.",
            })

            // Clear form
            setCompanyName('')
            setLocation('')
            setBusinessType('')

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
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">New Search</h2>
            <form onSubmit={handleSearch} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Company Name</label>
                    <input
                        type="text"
                        value={companyName}
                        onChange={(e) => setCompanyName(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. OpenAI"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Location</label>
                    <input
                        type="text"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. San Francisco"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Roles (Optional)</label>
                    <input
                        type="text"
                        value={businessType}
                        onChange={(e) => setBusinessType(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="e.g. CEO, CFO, Marketing Manager (Default: Decision Makers)"
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
