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

    // Step 1: Use SerpAPI to find LinkedIn profiles
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) throw new Error('SERPAPI_KEY is not configured');

    // Build search query
    let query = `site:linkedin.com/in`;
    if (companyName) query += ` "${companyName}"`;
    
    // Add target roles
    const roles = businessType || "CEO OR CFO OR Founder OR Owner OR Manager OR Director";
    query += ` (${roles})`;
    
    if (location) query += ` ${location}`;

    console.log('🔍 SerpAPI search query:', query);

    // Call SerpAPI
    const serpUrl = new URL('https://serpapi.com/search');
    serpUrl.searchParams.append('engine', 'google');
    serpUrl.searchParams.append('q', query);
    serpUrl.searchParams.append('api_key', serpApiKey);
    serpUrl.searchParams.append('num', '10');

    const serpRes = await fetch(serpUrl.toString());
    const serpData = await serpRes.json();

    if (serpData.error) throw new Error(`SerpAPI Error: ${serpData.error}`);

    const organicResults = serpData.organic_results || [];
    console.log(`✓ SerpAPI found ${organicResults.length} results`);

    if (organicResults.length === 0) {
      throw new Error('No LinkedIn profiles found');
    }

    // Step 2: Extract LinkedIn URLs
    const linkedinUrls = organicResults
      .map((result: any) => result.link)
      .filter((link: string) => link && link.includes('linkedin.com/in/'));

    console.log(`📋 Extracted ${linkedinUrls.length} LinkedIn URLs`);

    // Step 3: Enrich each profile with ContactOut
    const contactOutKey = process.env.CONTACTOUT_API_KEY;
    if (!contactOutKey) {
      console.warn('⚠️  CONTACTOUT_API_KEY not configured');
    }

    const leads = [];

    for (let i = 0; i < linkedinUrls.length; i++) {
      const linkedinUrl = linkedinUrls[i];
      const serpResult = organicResults[i];
      
      try {
        let profileData: any = null;

        // Try ContactOut enrichment
        if (contactOutKey) {
          try {
            console.log(`🔄 Enriching: ${linkedinUrl}`);
            
            const contactOutUrl = new URL('https://api.contactout.com/v1/linkedin/enrich');
            contactOutUrl.searchParams.append('profile', linkedinUrl);

            const contactOutRes = await fetch(contactOutUrl.toString(), {
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'token': contactOutKey
              }
            });

            const contactOutData = await contactOutRes.json();

            console.log(`📥 ContactOut response for ${linkedinUrl}:`, JSON.stringify(contactOutData, null, 2));

            if (contactOutData.status_code === 200 && contactOutData.profile) {
              profileData = contactOutData.profile;
              console.log(`✅ Enriched: ${profileData.full_name} | Email: ${profileData.contact_info?.emails?.[0] || 'none'} | Phone: ${profileData.contact_info?.phones?.[0] || 'none'}`);
            } else {
              console.log(`❌ ContactOut failed:`, contactOutData.message || contactOutData.error);
            }
          } catch (enrichError) {
            console.error(`❌ ContactOut error:`, enrichError);
          }
        }

        // Fallback: Parse from SerpAPI result
        if (!profileData) {
          console.log(`📝 Using fallback for: ${linkedinUrl}`);
          
          const title = serpResult.title || '';
          let fullName = 'Unknown';
          let jobTitle = 'Unknown';
          let currentCompany = companyName || 'Unknown';

          if (title) {
            const titleParts = title.replace('| LinkedIn', '').split(' - ');
            if (titleParts.length >= 2) {
              fullName = titleParts[0].trim();
              const roleCompany = titleParts[1].trim();
              
              if (roleCompany.includes(' at ')) {
                const [role, company] = roleCompany.split(' at ');
                jobTitle = role.trim();
                currentCompany = company.trim();
              } else {
                jobTitle = roleCompany;
              }
            }
          }

          profileData = {
            full_name: fullName,
            title: jobTitle,
            company: { name: currentCompany },
            location: location || null,
            contact_info: {
              emails: [],
              work_emails: [],
              personal_emails: [],
              phones: []
            }
          };
        }

        // Extract contact info
        const workEmails = profileData.contact_info?.work_emails || [];
        const personalEmails = profileData.contact_info?.personal_emails || [];
        const allEmails = profileData.contact_info?.emails || [];
        const primaryEmail = workEmails[0] || personalEmails[0] || allEmails[0] || null;

        const phones = profileData.contact_info?.phones || [];
        const primaryPhone = phones[0] || null;

        // Parse name
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
        console.error(`❌ Failed to process ${linkedinUrl}:`, e);
      }
    }

    console.log(`✅ Successfully processed ${leads.length} leads`);

    // Update job status
    await supabase.from('jobs').update({
      status: 'completed',
      result_id: leads[0]?.id 
    }).eq('id', jobId);

  } catch (error: any) {
    console.error('❌ Job failed:', error);
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: error.message
    }).eq('id', jobId);
  }
}
