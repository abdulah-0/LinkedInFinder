import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Database } from '../types/supabase'
import { Download } from 'lucide-react'

type Company = Database['public']['Tables']['companies']['Row']

export default function ResultsTable() {
    const [companies, setCompanies] = useState<Company[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        fetchCompanies()

        const subscription = supabase
            .channel('companies_channel')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'companies' }, () => {
                fetchCompanies()
            })
            .subscribe()

        return () => {
            subscription.unsubscribe()
        }
    }, [])

    const fetchCompanies = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('companies')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50)

        if (data) setCompanies(data)
        setLoading(false)
    }

    const downloadCSV = () => {
        const headers = ['Company Name', 'LinkedIn URL', 'Industry', 'Employees', 'Headquarters', 'Website', 'Description']
        const csvContent = [
            headers.join(','),
            ...companies.map(c => [
                `"${c.company_name}"`,
                `"${c.linkedin_url}"`,
                `"${c.industry}"`,
                `"${c.employee_count}"`,
                `"${c.headquarters}"`,
                `"${c.website}"`,
                `"${c.description?.replace(/"/g, '""')}"`
            ].join(','))
        ].join('\n')

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob)
            link.setAttribute('href', url)
            link.setAttribute('download', 'linkedin_companies.csv')
            link.style.visibility = 'hidden'
            document.body.appendChild(link)
            link.click()
            document.body.removeChild(link)
        }
    }

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Results</h2>
                <button
                    onClick={downloadCSV}
                    disabled={companies.length === 0}
                    className="flex items-center space-x-2 bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded text-sm disabled:opacity-50"
                >
                    <Download className="h-4 w-4" />
                    <span>Export CSV</span>
                </button>
            </div>
            <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Company</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Industry</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Employees</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Location</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Website</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                        {loading && companies.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">Loading...</td></tr>
                        )}
                        {!loading && companies.length === 0 && (
                            <tr><td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">No results found.</td></tr>
                        )}
                        {companies.map((company) => (
                            <tr key={company.id}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="flex items-center">
                                        <div>
                                            <div className="text-sm font-medium text-gray-900 dark:text-white">{company.company_name}</div>
                                            <a href={company.linkedin_url || '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-500 hover:underline">LinkedIn</a>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{company.industry}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{company.employee_count}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">{company.headquarters}</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-500 hover:underline">
                                    {company.website && <a href={company.website} target="_blank" rel="noopener noreferrer">Visit</a>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
