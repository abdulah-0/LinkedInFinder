import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '../types/supabase'
import { Download, Trash2, Eye, Calendar, MapPin, Building2 } from 'lucide-react'

type Job = Database['public']['Tables']['jobs']['Row']

interface LeadsManagerProps {
    onSelectJob: (jobId: string | null) => void
    selectedJobId: string | null
}

export default function LeadsManager({ onSelectJob, selectedJobId }: LeadsManagerProps) {
    const [jobs, setJobs] = useState<Job[]>([])
    const [leadCounts, setLeadCounts] = useState<Record<string, number>>({})
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchJobsWithLeadCounts()

        const subscription = supabase
            .channel('leads_manager_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
                fetchJobsWithLeadCounts()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchJobsWithLeadCounts()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const fetchJobsWithLeadCounts = async () => {
        setLoading(true)
        try {
            const { data: jobsData, error: jobsError } = await supabase
                .from('jobs')
                .select('*')
                .order('created_at', { ascending: false })

            if (jobsError) throw jobsError

            if (jobsData) {
                setJobs(jobsData)

                // Fetch lead counts for each job
                const counts: Record<string, number> = {}
                for (const job of (jobsData as Job[])) {
                    const { count } = await supabase
                        .from('leads')
                        .select('*', { count: 'exact', head: true })
                        .eq('job_id', job.id)

                    counts[job.id] = count || 0
                }
                setLeadCounts(counts)
            }
        } catch (err) {
            console.error('Error fetching jobs:', err)
        }
        setLoading(false)
    }

    const handleDelete = async (jobId: string) => {
        if (!confirm('Are you sure you want to delete this search and all its leads?')) {
            return
        }

        try {
            const { error } = await supabase
                .from('jobs')
                .delete()
                .eq('id', jobId)

            if (error) throw error

            // If the deleted job was selected, clear selection
            if (selectedJobId === jobId) {
                onSelectJob(null)
            }

            fetchJobsWithLeadCounts()
        } catch (err) {
            console.error('Error deleting job:', err)
            alert('Failed to delete search')
        }
    }

    const handleExport = async (jobId: string) => {
        try {
            const { data: leads, error } = await supabase
                .from('leads')
                .select('*')
                .eq('job_id', jobId)
                .order('created_at', { ascending: false })

            if (error) throw error

            if (!leads || leads.length === 0) {
                alert('No leads found for this search')
                return
            }

            const headers = ['Full Name', 'Job Title', 'Company', 'Location', 'Email', 'Phone', 'LinkedIn URL']
            const csvContent = [
                headers.join(','),
                ...leads.map((l: any) => [
                    `"${l.full_name}"`,
                    `"${l.job_title}"`,
                    `"${l.company_name}"`,
                    `"${l.location || ''}"`,
                    `"${l.email || ''}"`,
                    `"${l.phone || ''}"`,
                    `"${l.linkedin_url}"`
                ].join(','))
            ].join('\n')

            const blob = new Blob([csvContent], { type: 'text/csv' })
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `leads-${jobId.slice(0, 8)}-${Date.now()}.csv`
            a.click()
            window.URL.revokeObjectURL(url)
        } catch (err) {
            console.error('Error exporting leads:', err)
            alert('Failed to export leads')
        }
    }

    const formatDate = (dateString: string) => {
        const date = new Date(dateString)
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    const getStatusBadge = (status: string) => {
        const styles = {
            completed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
            processing: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
            failed: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
            pending: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
        }
        return (
            <span className={`px-2 py-1 text-xs font-medium rounded ${styles[status as keyof typeof styles] || styles.pending}`}>
                {status}
            </span>
        )
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leads Manager</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage all your searches and exports</p>
            </div>

            {loading && jobs.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">Loading...</div>
            ) : jobs.length === 0 ? (
                <div className="px-6 py-8 text-center text-gray-500">No searches yet. Start a search to see results here.</div>
            ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                    {jobs.map((job) => {
                        const payload = job.payload as any
                        const companyName = payload?.company_name || 'Unknown Company'
                        const location = payload?.location
                        const leadCount = leadCounts[job.id] || 0
                        const isSelected = selectedJobId === job.id

                        return (
                            <div
                                key={job.id}
                                className={`px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-3 mb-2">
                                            <Building2 className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                            <h3 className="text-lg font-medium text-gray-900 dark:text-white truncate">
                                                {companyName}
                                            </h3>
                                            {getStatusBadge(job.status)}
                                        </div>

                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500 dark:text-gray-400 mb-3">
                                            {location && (
                                                <div className="flex items-center gap-1">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{location}</span>
                                                </div>
                                            )}
                                            <div className="flex items-center gap-1">
                                                <Calendar className="h-4 w-4" />
                                                <span>{formatDate(job.created_at || '')}</span>
                                            </div>
                                            <div className="font-medium text-gray-700 dark:text-gray-300">
                                                {leadCount} {leadCount === 1 ? 'lead' : 'leads'}
                                            </div>
                                        </div>

                                        {job.error_message && (
                                            <div className="text-sm text-red-600 dark:text-red-400 mb-2">
                                                Error: {job.error_message}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => onSelectJob(isSelected ? null : job.id)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                                            title="View leads"
                                        >
                                            <Eye className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => handleExport(job.id)}
                                            disabled={leadCount === 0}
                                            className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                            title="Export to CSV"
                                        >
                                            <Download className="h-5 w-5" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(job.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                                            title="Delete search"
                                        >
                                            <Trash2 className="h-5 w-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
