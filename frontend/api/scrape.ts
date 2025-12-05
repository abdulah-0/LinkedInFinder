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

    // Use ContactOut People Search API directly
    const contactOutKey = process.env.CONTACTOUT_API_KEY;
    if (!contactOutKey) throw new Error('CONTACTOUT_API_KEY is not configured');

    // Build search payload
    const searchPayload: any = {
      page: 1,
      reveal_info: true,
      data_types: ['personal_email', 'work_email', 'phone']
    };

    // Add company filter
    if (companyName) {
      searchPayload.company = [companyName];
      searchPayload.company_filter = 'current'; // Only current employees
    }

    // Add job title filter (use businessType as roles if provided)
    if (businessType) {
      // User provided custom roles
      const roles = businessType.split(',').map((r: string) => r.trim());
      searchPayload.job_title = roles;
    } else {
      // Default to decision makers
      searchPayload.job_title = ['CEO', 'CFO', 'CTO', 'Founder', 'Owner', 'President', 'VP', 'Director', 'Manager'];
    }

    // Add location filter
    if (location) {
      searchPayload.location = [location];
    }

    console.log('ContactOut search payload:', JSON.stringify(searchPayload));

    // Call ContactOut People Search API
    const contactOutRes = await fetch('https://api.contactout.com/v1/people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'token': contactOutKey
      },
      body: JSON.stringify(searchPayload)
    });

    const contactOutData = await contactOutRes.json();

    console.log('ContactOut response status:', contactOutData.status_code);

    if (contactOutData.status_code !== 200) {
      throw new Error(`ContactOut API Error: ${contactOutData.message || 'Unknown error'}`);
    }

    const profiles = contactOutData.profiles || {};
    const leads = [];

    // Parse ContactOut response and store leads
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

    console.log(`Processed ${leads.length} leads`);

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
