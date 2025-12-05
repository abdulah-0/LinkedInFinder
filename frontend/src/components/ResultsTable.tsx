import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '../types/supabase'
import { Download, User, Briefcase, MapPin, Building2 } from 'lucide-react'

type Lead = Database['public']['Tables']['leads']['Row']

export default function ResultsTable() {
    const [leads, setLeads] = useState<Lead[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchLeads()

        const subscription = supabase
            .channel('leads_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
                fetchLeads()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const fetchLeads = async () => {
        setLoading(true)
        try {
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50)

            if (error) {
                console.error('Error fetching leads:', error)
            } else {
                console.log('Fetched leads:', data?.length || 0)
                if (data) {
                    setLeads(data)
                    console.log('Leads state updated, first lead:', data[0])
                }
            }
        } catch (err) {
            console.error('Exception fetching leads:', err)
        }
        setLoading(false)
    }

    const downloadCSV = () => {
        const headers = ['Full Name', 'Job Title', 'Company', 'Location', 'Email', 'Phone', 'LinkedIn URL']
        const csvContent = [
            headers.join(','),
            ...leads.map(l => [
                `"${l.full_name}"`,
                `"${l.job_title}"`,
                `"${l.company_name}"`,
                `"${l.location || ''}"`,
                `"${l.email || ''}"`,
                `"${l.phone || ''}"`,
                `"${l.linkedin_url}"`
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'linkedin_leads.csv')
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Leads Found ({leads.length})</h2>
                <div className="flex gap-2">
                    <button
                        onClick={fetchLeads}
                        className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded text-sm"
                    >
                        <span>Refresh</span>
                    </button>
                    <button
                        onClick={downloadCSV}
                        disabled={leads.length === 0}
                        className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                    >
                        <Download className="h-4 w-4" />
                        <span>Export CSV</span>
                    </button>
                </div>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Role</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading && leads.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td></tr>
                        )}
                        {!loading && leads.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No leads found yet.</td></tr>
                        )}
                        {leads.map((lead) => (
                            <tr key={lead.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
                                            <User size={16} />
                                        </div>
                                        <div className="ml-3">
                                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{lead.full_name}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                        <Briefcase className="mr-1.5 h-4 w-4 text-gray-400" />
                                        {lead.job_title}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                        <Building2 className="mr-1.5 h-4 w-4 text-gray-400" />
                                        {lead.company_name}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                                        <MapPin className="mr-1.5 h-4 w-4 text-gray-400" />
                                        {lead.location || 'Unknown'}
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400 hover:underline">
                                    {lead.linkedin_url && (
                                        <a href={lead.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center">
                                            View Profile
                                        </a>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
