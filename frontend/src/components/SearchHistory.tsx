import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '../types/supabase'
import { Clock, CheckCircle, XCircle, Loader } from 'lucide-react'

type Job = Database['public']['Tables']['jobs']['Row']

interface SearchHistoryProps {
    onSelectJob: (jobId: string | null) => void
    selectedJobId: string | null
}

export default function SearchHistory({ onSelectJob, selectedJobId }: SearchHistoryProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchJobs()

        const subscription = supabase
            .channel('jobs_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
                fetchJobs()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const fetchJobs = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('jobs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) {
                console.error('Error fetching jobs:', error)
            } else {
                if (data) setJobs(data)
            }
        } catch (err) {
            console.error('Exception fetching jobs:', err)
        }
        setLoading(false)
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
                return <CheckCircle className="h-4 w-4 text-green-500" />
            case 'failed':
                return <XCircle className="h-4 w-4 text-red-500" />
            case 'processing':
                return <Loader className="h-4 w-4 text-blue-500 animate-spin" />
            default:
                return <Clock className="h-4 w-4 text-gray-400" />
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden h-full">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Search History</h2>
            </div>
            <div className="overflow-y-auto max-h-[calc(100vh-200px)]">
                {loading && jobs.length === 0 && (
                    <div className="px-4 py-3 text-center text-sm text-gray-500">Loading...</div>
                )}
                {!loading && jobs.length === 0 && (
                    <div className="px-4 py-3 text-center text-sm text-gray-500">No searches yet</div>
                )}
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    <button
                        onClick={() => onSelectJob(null)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${selectedJobId === null ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                            }`}
                    >
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-gray-900 dark:text-white">All Leads</span>
                        </div>
                    </button>
                    {jobs.map((job) => {
                        const payload = job.payload as any
                        const companyName = payload?.company_name || 'Unknown'
                        const location = payload?.location
                        const isSelected = selectedJobId === job.id

                        return (
                            <button
                                key={job.id}
                                onClick={() => onSelectJob(job.id)}
                                className={`w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(job.status)}
                                            <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                                {companyName}
                                            </p>
                                        </div>
                                        {location && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{location}</p>
                                        )}
                                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                            {formatDate(job.created_at || '')}
                                        </p>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
        </div>
    )
}
