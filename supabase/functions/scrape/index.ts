import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import * as cheerio from "https://esm.sh/cheerio@1.0.0-rc.12"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { 
      status: 200,
      headers: corsHeaders 
    })
  }

  try {
    const { company_name, location, business_type } = await req.json()

    if (!company_name && !location && !business_type) {
      throw new Error('Please provide at least one search parameter')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        status: 'queued',
        payload: { company_name, location, business_type },
        user_id: (await supabase.auth.getUser()).data.user?.id
      })
      .select()
      .single()

    if (jobError) throw new Error(`Failed to create job: ${jobError.message}`)

    // Start background processing
    const processJob = async () => {
      try {
        await supabase.from('jobs').update({ status: 'processing' }).eq('id', job.id)

        // Build search query
        let query = `site:linkedin.com/company`
        if (company_name) query += ` ${company_name}`
        if (business_type) query += ` ${business_type}`
        if (location) query += ` in ${location}`

        const serpApiKey = Deno.env.get('SERPAPI_KEY')
        if (!serpApiKey) throw new Error('SERPAPI_KEY is not configured')

        // Call SerpAPI
        const serpUrl = new URL('https://serpapi.com/search')
        serpUrl.searchParams.append('engine', 'google')
        serpUrl.searchParams.append('q', query)
        serpUrl.searchParams.append('api_key', serpApiKey)
        serpUrl.searchParams.append('num', '5')

        const serpRes = await fetch(serpUrl.toString())
        const serpData = await serpRes.json()

        if (serpData.error) throw new Error(`SerpAPI Error: ${serpData.error}`)

        const organicResults = serpData.organic_results || []
        const companies = []

        for (const result of organicResults) {
          const link = result.link
          if (link && link.includes('linkedin.com/company/')) {
            try {
              const pageRes = await fetch(link, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                }
              })
              const html = await pageRes.text()
              const $ = cheerio.load(html)

              const title = $('title').text().replace('| LinkedIn', '').trim() || result.title
              const description = $('meta[name="description"]').attr('content') || result.snippet
              
              let industry = 'Not found'
              let employeeCount = 'Not found'
              let headquarters = 'Not found'
              let website = 'Not found'

              const industryMatch = html.match(/"industry":"([^"]+)"/)
              if (industryMatch) industry = industryMatch[1]

              const employeeMatch = html.match(/([\d,]+(?:-[\d,]+)?)\s*employees/)
              if (employeeMatch) employeeCount = employeeMatch[1]

              const locationMatch = html.match(/"addressLocality":"([^"]+)"/)
              if (locationMatch) headquarters = locationMatch[1]

              const websiteMatch = html.match(/"url":"(https?:\/\/(?!www\.linkedin)[^"]+)"/)
              if (websiteMatch) website = websiteMatch[1]

              const company = {
                company_name: title,
                linkedin_url: link,
                linkedin_id: link.split('/company/')[1]?.split('/')[0] || 'unknown',
                industry,
                employee_count: employeeCount,
                headquarters,
                website,
                description: description?.substring(0, 300),
                search_query: query,
                user_id: job.user_id
              }

              const { data } = await supabase.from('companies').insert(company).select().single()
              if (data) companies.push(data)

            } catch (e) {
              console.error(`Failed to scrape ${link}:`, e)
            }
          }
        }

        // Update job status
        await supabase.from('jobs').update({ 
          status: 'completed', 
          result_id: companies[0]?.id, // Link to first result for now, or store all IDs if we change schema
          // For now, we just mark it completed. The frontend can query companies by search_query or user_id.
        }).eq('id', job.id)

      } catch (error) {
        console.error('Job failed:', error)
        await supabase.from('jobs').update({ 
          status: 'failed', 
          error_message: error.message 
        }).eq('id', job.id)
      }
    }

    // Use EdgeRuntime.waitUntil to keep the function alive
    // @ts-ignore
    EdgeRuntime.waitUntil(processJob())

    return new Response(
      JSON.stringify({ success: true, job_id: job.id, status: 'queued' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
