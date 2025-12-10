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
    const { 
      search_type = 'company',
      company_name, 
      location, 
      business_type,
      full_name,
      job_title,
      enrichment_provider = 'contactout'
    } = req.body;

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

    // Create job payload based on search type
    const jobPayload: any = {
      search_type,
      enrichment_provider
    };

    if (search_type === 'name') {
      if (!full_name) {
        return res.status(400).json({
          success: false,
          error: 'Full name is required for name-based searches'
        });
      }
      jobPayload.full_name = full_name;
      jobPayload.job_title = job_title;
      jobPayload.company_name = company_name;
      jobPayload.location = location;
    } else {
      // Company-based search
      if (!company_name && !location && !business_type) {
        return res.status(400).json({
          success: false,
          error: 'Please provide at least one search parameter'
        });
      }
      jobPayload.company_name = company_name;
      jobPayload.location = location;
      jobPayload.business_type = business_type;
    }

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        status: 'queued',
        payload: jobPayload,
        user_id: userId
      })
      .select()
      .single();

    if (jobError) {
      throw new Error(`Failed to create job: ${jobError.message}`);
    }

    // Start background processing based on search type
    if (search_type === 'name') {
      await processNameSearchAsync(job.id, full_name, job_title, company_name, location, userId);
    } else {
      await processJobAsync(job.id, company_name, location, business_type, userId);
    }

    return res.status(200).json({
      success: true,
      job_id: job.id,
      status: 'completed'
    });

  } catch (error: any) {
    console.error('Scrape API error:', error);
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
}

// Helper function to enrich with ContactOut
async function enrichWithContactOut(linkedinUrl: string): Promise<any | null> {
  const contactOutKey = process.env.CONTACTOUT_API_KEY;
  if (!contactOutKey) {
    console.warn('⚠️  CONTACTOUT_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🔄 ContactOut enriching: ${linkedinUrl}`);
    
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

    // Check if this is a demo/sample response
    const isDemoResponse = contactOutData.message?.includes('sample response') || 
                           contactOutData.profile?.full_name === 'Example Person';

    if (contactOutData.status_code === 200 && contactOutData.profile && !isDemoResponse) {
      console.log(`✅ ContactOut enriched: ${contactOutData.profile.full_name}`);
      return contactOutData.profile;
    } else {
      if (isDemoResponse) {
        console.log(`⚠️  ContactOut returned demo data`);
      } else {
        console.log(`❌ ContactOut failed:`, contactOutData.message || contactOutData.error);
      }
      return null;
    }
  } catch (error) {
    console.error(`❌ ContactOut error:`, error);
    return null;
  }
}

// Helper function to enrich with RocketReach
async function enrichWithRocketReach(linkedinUrl: string): Promise<any | null> {
  const rocketReachKey = process.env.ROCKETREACH_API_KEY;
  if (!rocketReachKey) {
    console.warn('⚠️  ROCKETREACH_API_KEY not configured');
    return null;
  }

  try {
    console.log(`🚀 RocketReach enriching: ${linkedinUrl}`);
    
    const response = await fetch('https://api.rocketreach.co/v2/api/lookupProfile', {
      method: 'POST',
      headers: {
        'Api-Key': rocketReachKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        linkedin_url: linkedinUrl
      })
    });

    const data = await response.json();

    if (data && data.name) {
      // Transform RocketReach response to match our format
      const profileData = {
        full_name: data.name || 'Unknown',
        title: data.current_title || 'Unknown',
        company: { name: data.current_employer || 'Unknown' },
        location: data.location || null,
        contact_info: {
          emails: data.emails || [],
          work_emails: data.emails?.filter((e: any) => e.type === 'professional') || [],
          personal_emails: data.emails?.filter((e: any) => e.type === 'personal') || [],
          phones: data.phones || []
        }
      };
      console.log(`✅ RocketReach enriched: ${profileData.full_name}`);
      return profileData;
    } else {
      console.log(`❌ RocketReach failed:`, data.error || 'No data returned');
      return null;
    }
  } catch (error) {
    console.error(`❌ RocketReach error:`, error);
    return null;
  }
}

// Process name-based search
async function processNameSearchAsync(
  jobId: string,
  fullName: string,
  jobTitle: string | undefined,
  companyName: string | undefined,
  location: string | undefined,
  userId: string | undefined
) {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    await supabase.from('jobs').update({ status: 'processing' }).eq('id', jobId);

    // Get enrichment provider from job payload
    const { data: jobData } = await supabase.from('jobs').select('payload').eq('id', jobId).single();
    const enrichmentProvider = (jobData?.payload as any)?.enrichment_provider || 'contactout';

    console.log(`🔧 Using enrichment provider: ${enrichmentProvider}`);
    console.log(`👤 Searching for: ${fullName}`);

    // Step 1: Use SerpAPI to find LinkedIn profile by name
    const serpApiKey = process.env.SERPAPI_KEY;
    if (!serpApiKey) throw new Error('SERPAPI_KEY is not configured');

    // Build search query for name
    let query = `site:linkedin.com/in "${fullName}"`;
    if (jobTitle) query += ` "${jobTitle}"`;
    if (companyName) query += ` "${companyName}"`;
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
      throw new Error('No LinkedIn profiles found for this name');
    }

    // Step 2: Extract LinkedIn URLs
    const linkedinUrls = organicResults
      .map((result: any) => result.link)
      .filter((link: string) => link && link.includes('linkedin.com/in/'));

    console.log(`📋 Extracted ${linkedinUrls.length} LinkedIn URLs`);

    // Step 3: Enrich profiles with selected provider
    const leads = [];

    for (let i = 0; i < linkedinUrls.length; i++) {
      const linkedinUrl = linkedinUrls[i];
      const serpResult = organicResults[i];
      
      try {
        let profileData: any = null;

        // Try enrichment based on selected provider
        if (enrichmentProvider === 'rocketreach') {
          profileData = await enrichWithRocketReach(linkedinUrl);
        } else {
          profileData = await enrichWithContactOut(linkedinUrl);
        }

        // Fallback: Parse from SerpAPI result
        if (!profileData) {
          console.log(`📝 Using fallback for: ${linkedinUrl}`);
          
          const title = serpResult.title || '';
          let parsedName = fullName;
          let parsedJobTitle = jobTitle || 'Unknown';
          let parsedCompany = companyName || 'Unknown';

          if (title) {
            const titleParts = title.replace('| LinkedIn', '').split(' - ');
            if (titleParts.length >= 2) {
              parsedName = titleParts[0].trim();
              const roleCompany = titleParts[1].trim();
              
              if (roleCompany.includes(' at ')) {
                const [role, company] = roleCompany.split(' at ');
                parsedJobTitle = role.trim();
                parsedCompany = company.trim();
              } else {
                parsedJobTitle = roleCompany;
              }
            }
          }

          profileData = {
            full_name: parsedName,
            title: parsedJobTitle,
            company: { name: parsedCompany },
            location: location || null,
            contact_info: {
              emails: [],
              work_emails: [],
              personal_emails: [],
              phones: []
            }
          };
        }

        // Insert lead into database
        const lead = {
          job_id: jobId,
          user_id: userId,
          full_name: profileData.full_name || 'Unknown',
          job_title: profileData.title || profileData.current_title || 'Unknown',
          company_name: profileData.company?.name || profileData.current_employer || 'Unknown',
          location: profileData.location || location || null,
          email: profileData.contact_info?.emails?.[0] || profileData.emails?.[0] || null,
          phone: profileData.contact_info?.phones?.[0] || profileData.phones?.[0] || null,
          linkedin_url: linkedinUrl
        };

        leads.push(lead);
      } catch (error) {
        console.error(`Error processing ${linkedinUrl}:`, error);
      }
    }

    // Batch insert leads
    if (leads.length > 0) {
      const { error: insertError } = await supabase.from('leads').insert(leads);
      if (insertError) throw insertError;
    }

    console.log(`✅ Successfully processed ${leads.length} leads`);

    await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId);
  } catch (error: any) {
    console.error('Name search error:', error);
    await supabase.from('jobs').update({
      status: 'failed',
      error_message: error.message
    }).eq('id', jobId);
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

    // Get enrichment provider from job payload
    const { data: jobData } = await supabase.from('jobs').select('payload').eq('id', jobId).single();
    const enrichmentProvider = (jobData?.payload as any)?.enrichment_provider || 'contactout';

    console.log(`🔧 Using enrichment provider: ${enrichmentProvider}`);

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

    // Step 3: Enrich each profile with selected provider
    const leads = [];

    for (let i = 0; i < linkedinUrls.length; i++) {
      const linkedinUrl = linkedinUrls[i];
      const serpResult = organicResults[i];
      
      try {
        let profileData: any = null;

        // Try enrichment based on selected provider
        if (enrichmentProvider === 'rocketreach') {
          profileData = await enrichWithRocketReach(linkedinUrl);
        } else {
          profileData = await enrichWithContactOut(linkedinUrl);
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
