import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    // Extract ID from path or query param. 
    // If invoked as /job-status/ID, we need to parse path.
    // If invoked as /job-status?id=ID, we use searchParams.
    // Let's support both or just query param for simplicity in Edge Functions unless we use a router.
    // The prompt asked for /api/job/:id. In Supabase, this maps to functions/v1/job-status/ID if we configure it, 
    // but default is functions/v1/job-status.
    // We'll assume the client calls /functions/v1/job-status?id=... OR we parse the last segment.
    
    let jobId = url.searchParams.get('id')
    if (!jobId) {
      const pathParts = url.pathname.split('/')
      jobId = pathParts[pathParts.length - 1]
    }

    if (!jobId || jobId === 'job-status') {
      throw new Error('Job ID is required')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: job, error } = await supabase
      .from('jobs')
      .select('*, result:companies(*)')
      .eq('id', jobId)
      .single()

    if (error) throw new Error(error.message)

    return new Response(
      JSON.stringify({ success: true, job }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
