# Vercel Deployment Guide

## Prerequisites
- GitHub repository: https://github.com/abdulah-0/LinkedInFinder.git ✅
- Vercel account
- Supabase project with deployed Edge Functions

## Step 1: Configure Supabase

1. **Create a Supabase project** at https://supabase.com
2. **Run migrations**:
   ```bash
   supabase link --project-ref your-project-ref
   supabase db push
   ```
3. **Deploy Edge Functions**:
   ```bash
   supabase functions deploy scrape
   supabase functions deploy job-status
   ```
4. **Set Edge Function secrets**:
   ```bash
   supabase secrets set SERPAPI_KEY=your_serpapi_key
   supabase secrets set SUPABASE_URL=your_supabase_url
   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## Step 2: Deploy to Vercel

1. **Go to Vercel**: https://vercel.com/new
2. **Import Git Repository**: 
   - Select "Import Git Repository"
   - Choose `abdulah-0/LinkedInFinder`
3. **Configure Project**:
   - Framework Preset: **Vite**
   - Root Directory: **frontend**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. **Add Environment Variables**:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key
5. **Deploy**: Click "Deploy"

## Step 3: Get Supabase Credentials

### Supabase URL and Anon Key
1. Go to your Supabase project dashboard
2. Click "Settings" → "API"
3. Copy:
   - **Project URL** → Use for `VITE_SUPABASE_URL`
   - **anon public** key → Use for `VITE_SUPABASE_ANON_KEY`
   - **service_role** key → Use for `SUPABASE_SERVICE_ROLE_KEY` (Edge Functions)

### SerpAPI Key
1. Sign up at https://serpapi.com
2. Get your API key from the dashboard
3. Use for `SERPAPI_KEY` in Edge Functions

## Step 4: Verify Deployment

1. Visit your Vercel deployment URL
2. Sign up for an account
3. Test a search (e.g., "OpenAI" in San Francisco)
4. Verify results appear and CSV export works

## Troubleshooting

### Build Fails
- Ensure Root Directory is set to `frontend`
- Check that all environment variables are set
- Verify Node.js version (18+)

### Edge Functions Not Working
- Verify functions are deployed: `supabase functions list`
- Check secrets are set: `supabase secrets list`
- Review function logs in Supabase dashboard

### No Results Appearing
- Check SerpAPI key is valid and has quota
- Verify Supabase RLS policies allow user access
- Check browser console for errors

## Environment Variables Summary

**Vercel (Frontend)**:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

**Supabase Edge Functions**:
- `SERPAPI_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Post-Deployment

1. **Enable Realtime** in Supabase:
   - Go to Database → Replication
   - Enable replication for `companies` and `jobs` tables

2. **Monitor Usage**:
   - SerpAPI quota (free tier: 100 searches/month)
   - Supabase Edge Function invocations
   - Database storage

3. **Optional Enhancements**:
   - Add custom domain in Vercel
   - Configure CORS if needed
   - Set up monitoring/analytics
