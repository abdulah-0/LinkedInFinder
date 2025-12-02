import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '../types/supabase'

type Job = Database['public']['Tables']['jobs']['Row']

export default function JobList() {
    const [jobs, setJobs] = useState<Job[]>([])

    useEffect(() => {
        fetchJobs()

        const subscription = supabase
            .channel('jobs_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (_payload) => {
                fetchJobs()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const fetchJobs = async () => {
        const { data } = await supabase
            .from('jobs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5)

        if (data) setJobs(data)
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
            <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white">Recent Jobs</h2>
            <div className="space-y-4">
                {jobs.length === 0 && (
                    <p className="text-gray-500 dark:text-gray-400 text-sm">No recent jobs.</p>
                )}
                {jobs.map((job) => (
                    <div key={job.id} className="border-b border-gray-200 dark:border-gray-700 pb-4 last:border-0 last:pb-0">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white">
                                    {/* @ts-ignore */}
                                    {job.payload?.company_name || job.payload?.location || 'Search'}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(job.created_at!).toLocaleString()}
                                </p>
                            </div>
                            <span className={`px-2 py-1 text-xs rounded-full ${job.status === 'completed' ? 'bg-green-100 text-green-800' :
                                job.status === 'failed' ? 'bg-red-100 text-red-800' :
                                    'bg-blue-100 text-blue-800'
                                }`}>
                                {job.status}
                            </span>
                        </div>
                        {job.error_message && (
                            <p className="text-xs text-red-600 mt-1">{job.error_message}</p>
                        )}
                    </div>
                ))}
            </div>
        </div>
    )
}
