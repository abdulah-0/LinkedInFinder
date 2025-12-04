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

    // Build search query
    let query = `site:linkedin.com/company`;
    if (companyName) query += ` ${companyName}`;
    if (businessType) query += ` ${businessType}`;
    if (location) query += ` in ${location}`;

    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) throw new Error('SERPAPI_KEY is not configured');

    // Call SerpAPI
    const serpUrl = new URL('https://serpapi.com/search');
    serpUrl.searchParams.append('engine', 'google');
    serpUrl.searchParams.append('q', query);
    serpUrl.searchParams.append('api_key', serpApiKey);
    serpUrl.searchParams.append('num', '3'); // Reduced to 3 to avoid timeout

    const serpRes = await fetch(serpUrl.toString());
    const serpData = await serpRes.json();

    if (serpData.error) throw new Error(`SerpAPI Error: ${serpData.error}`);

    const organicResults = serpData.organic_results || [];
    const companies = [];

    for (const result of organicResults) {
      const link = result.link;
      if (link && link.includes('linkedin.com/company/')) {
        try {
          const pageRes = await fetch(link, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
            }
          });
          const html = await pageRes.text();
          const $ = cheerio.load(html);

          const title = $('title').text().replace('| LinkedIn', '').trim() || result.title;
          const description = $('meta[name="description"]').attr('content') || result.snippet;

          let industry = 'Not found';
          let employeeCount = 'Not found';
          let headquarters = 'Not found';
          let website = 'Not found';

          const industryMatch = html.match(/"industry":"([^"]+)"/);
          if (industryMatch) industry = industryMatch[1];

          const employeeMatch = html.match(/([\d,]+(?:-[\d,]+)?)\s*employees/);
          if (employeeMatch) employeeCount = employeeMatch[1];

          const locationMatch = html.match(/"addressLocality":"([^"]+)"/);
          if (locationMatch) headquarters = locationMatch[1];

          const websiteMatch = html.match(/"url":"(https?:\/\/(?!www\.linkedin)[^"]+)"/);
          if (websiteMatch) website = websiteMatch[1];

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
            user_id: userId
          };

          const { data } = await supabase.from('companies').insert(company).select().single();
          if (data) companies.push(data);

        } catch (e) {
          console.error(`Failed to scrape ${link}:`, e);
        }
      }
    }

    // Update job status
    await supabase.from('jobs').update({
      status: 'completed',
      result_id: companies[0]?.id
    }).eq('id', jobId);

  } catch (error: any) {
    console.error('Job failed:', error);
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: error.message
    }).eq('id', jobId);
  }
}
