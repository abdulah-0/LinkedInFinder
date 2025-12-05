import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import * as cheerio from 'cheerio';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  try {
    const { company_name, location, business_type } = req.body;

    if (!company_name && !location && !business_type) {
      return res.status(400).json({
        success: false,
        error: 'Please provide at least one search parameter'
      });
    }

    // Initialize Supabase client with service role key
    const supabase = createClient(
      process.env.VITE_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user from authorization header
    const authHeader = req.headers.authorization;
    let userId: string | undefined;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        status: 'queued',
        payload: { company_name, location, business_type },
        user_id: userId
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Start background processing - AWAIT to ensure it runs on Vercel
    await processJobAsync(job.id, company_name, location, business_type, userId);

    return res.status(200).json({
      success: true,
      job_id: job.id,
      status: 'completed' // Since we await, it's completed
    });

  } catch (error: any) {
    console.error('Scrape API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

async function processJobAsync(
  jobId: string,
  companyName: string | undefined,
  location: string | undefined,
  businessType: string | undefined,
  userId: string | undefined
) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await supabase.from('jobs').update({ status: 'processing' }).eq('id', jobId);

    // Step 1: Find company LinkedIn URL using SerpAPI
    let companyLinkedInUrl = '';
    
    if (companyName) {
      const serpApiKey = process.env.SERPAPI_KEY;
      if (!serpApiKey) throw new Error('SERPAPI_KEY is not configured');

      // Search for company page
      const companyQuery = `site:linkedin.com/company "${companyName}"`;
      const serpUrl = new URL('https://serpapi.com/search');
      serpUrl.searchParams.append('engine', 'google');
      serpUrl.searchParams.append('q', companyQuery);
      serpUrl.searchParams.append('api_key', serpApiKey);
      serpUrl.searchParams.append('num', '1');

      const serpRes = await fetch(serpUrl.toString());
      const serpData = await serpRes.json();

      if (serpData.error) throw new Error(`SerpAPI Error: ${serpData.error}`);

      const organicResults = serpData.organic_results || [];
      if (organicResults.length > 0 && organicResults[0].link) {
        companyLinkedInUrl = organicResults[0].link;
      }
    }

    if (!companyLinkedInUrl) {
      throw new Error('Could not find company LinkedIn URL');
    }

    // Step 2: Call ContactOut Decision Makers API
    const contactOutKey = process.env.CONTACTOUT_API_KEY;
    if (!contactOutKey) throw new Error('CONTACTOUT_API_KEY is not configured');

    const contactOutUrl = new URL('https://api.contactout.com/v1/people/decision-makers');
    contactOutUrl.searchParams.append('reveal_info', 'true');
    contactOutUrl.searchParams.append('linkedin_url', companyLinkedInUrl);

    const contactOutRes = await fetch(contactOutUrl.toString(), {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': contactOutKey
      }
    });

    const contactOutData = await contactOutRes.json();

    if (contactOutData.status_code !== 200) {
      throw new Error(`ContactOut API Error: ${contactOutData.message || 'Unknown error'}`);
    }

    const profiles = contactOutData.profiles || {};
    const leads = [];

    // Step 3: Parse ContactOut response and store leads
    for (const [linkedinUrl, profile] of Object.entries(profiles)) {
      try {
        const profileData = profile as any;

        // Extract emails
        const workEmails = profileData.contact_info?.work_emails || [];
        const personalEmails = profileData.contact_info?.personal_emails || [];
        const allEmails = profileData.contact_info?.emails || [];
        
        const primaryEmail = workEmails[0] || personalEmails[0] || allEmails[0] || null;

        // Extract phones
        const phones = profileData.contact_info?.phones || [];
        const primaryPhone = phones[0] || null;

        // Split name
        const fullName = profileData.full_name || 'Unknown';
        const nameParts = fullName.split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ');

        const lead = {
          job_id: jobId,
          company_name: profileData.company?.name || companyName || 'Unknown',
          full_name: fullName,
          first_name: firstName,
          last_name: lastName,
          job_title: profileData.title || 'Unknown',
          linkedin_url: linkedinUrl,
          location: profileData.location || location || null,
          email: primaryEmail,
          phone: primaryPhone
        };

        const { data } = await supabase.from('leads').insert(lead).select().single();
        if (data) leads.push(data);

      } catch (e) {
        console.error(`Failed to process profile ${linkedinUrl}:`, e);
      }
    }

    // Update job status
    await supabase.from('jobs').update({
      status: 'completed',
      result_id: leads[0]?.id 
    }).eq('id', jobId);

  } catch (error: any) {
    console.error('Job failed:', error);
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: error.message
    }).eq('id', jobId);
  }
}
