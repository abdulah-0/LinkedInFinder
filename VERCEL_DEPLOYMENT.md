# Vercel API Routes Deployment Guide

## Overview

The application has been migrated from Supabase Edge Functions to Vercel API Routes to resolve CORS issues. The scraping logic now runs as Vercel serverless functions on the same domain as your frontend.

## What Changed

### Backend
- ✅ Created `/api/scrape.ts` - Handles scraping requests
- ✅ Created `/api/job-status.ts` - Returns job status
- ✅ Added `cheerio` dependency for HTML parsing
- ✅ Added `@vercel/node` for TypeScript types

### Frontend
- ✅ Updated `SearchForm.tsx` to call `/api/scrape` instead of Supabase Edge Functions
- ✅ Added Vite proxy configuration for local development
- ✅ Created `vercel.json` for deployment configuration

## Environment Variables Setup

### Required Environment Variables in Vercel

You need to set these in your Vercel project settings (Settings → Environment Variables):

1. **VITE_SUPABASE_URL**
   - Value: Your Supabase project URL
   - Example: `https://yvapagblknnmeyuytrzl.supabase.co`

2. **VITE_SUPABASE_ANON_KEY**
   - Value: Your Supabase anon/public key
   - Find in: Supabase Dashboard → Settings → API

3. **SUPABASE_SERVICE_ROLE_KEY**
   - Value: Your Supabase service role key (secret!)
   - Find in: Supabase Dashboard → Settings → API
   - ⚠️ **Important**: This is a secret key, never commit it to Git

4. **SERPAPI_KEY**
   - Value: `3c1f8176da06076a39099dd2cb42faa7f603bae7ccd078a146fbc549d1d8f3a5`

## Deployment Steps

### 1. Commit and Push Changes

```bash
cd "c:\Users\snake\OneDrive\Desktop\linkedin scrapper"

git add .
git commit -m "Migrate to Vercel API routes to fix CORS"
git push
```

### 2. Deploy to Vercel

#### Option A: Via Vercel Dashboard (Recommended)

1. Go to [vercel.com](https://vercel.com)
2. Click "Add New Project"
3. Import your GitHub repository: `abdulah-0/LinkedInFinder`
4. Configure project:
   - **Framework Preset**: Vite
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
5. Add environment variables (see above)
6. Click "Deploy"

#### Option B: Via Vercel CLI

```bash
cd "c:\Users\snake\OneDrive\Desktop\linkedin scrapper\frontend"

# Install Vercel CLI if not already installed
npm install -g vercel

# Login to Vercel
vercel login

# Deploy
vercel --prod
```

When prompted, set the environment variables or add them via the dashboard.

### 3. Verify Deployment

After deployment:

1. Open your Vercel deployment URL
2. Sign in to your account
3. Try a search:
   - Company Name: "OpenAI"
   - Location: "San Francisco"
   - Business Type: "Software"
4. Check browser console - **NO CORS errors!** ✅
5. Verify job status updates
6. Check results appear in table

## Local Development

To test locally before deploying:

### Option 1: Using Vercel CLI (Recommended)

```bash
cd "c:\Users\snake\OneDrive\Desktop\linkedin scrapper\frontend"

# Create .env.local file with your environment variables
# (see .env.local.example)

# Run Vercel dev server
vercel dev
```

This will start a local server that mimics Vercel's production environment.

### Option 2: Using Vite Dev Server

The Vite proxy is configured, but you'll need to run the API functions separately. Vercel CLI is recommended instead.

## Troubleshooting

### API Routes Not Found (404)

- Ensure the `api/` folder is in the `frontend/` directory
- Check that `vercel.json` is in the `frontend/` directory
- Verify the root directory is set to `frontend` in Vercel settings

### Environment Variables Not Working

- Double-check all environment variables are set in Vercel dashboard
- Redeploy after adding environment variables
- Check the deployment logs for errors

### SERPAPI_KEY Error

If you see "SERPAPI_KEY is not configured":
- Verify the environment variable is set in Vercel
- Check the spelling matches exactly: `SERPAPI_KEY`
- Redeploy the project

### Job Processing Timeout

Vercel Hobby plan has a 10-second timeout. If scraping takes longer:
- The job will be marked as "processing" in the database
- Consider upgrading to Vercel Pro for 60-second timeout
- Or implement a queue system with a separate worker

## Expected Behavior

✅ No CORS errors in browser console
✅ Search form submits successfully
✅ Job created in Supabase database
✅ Results appear after processing
✅ Real-time updates work
✅ CSV export functions

## Architecture

```
Frontend (Vercel)
  ↓
/api/scrape (Vercel Serverless Function)
  ↓
SerpAPI → LinkedIn Pages → Cheerio Parsing
  ↓
Supabase Database (companies, jobs tables)
  ↓
Frontend (Real-time updates via Supabase)
```

## Next Steps

1. Deploy to Vercel
2. Test the complete flow
3. Monitor for any errors
4. Consider adding error tracking (e.g., Sentry)
5. Optimize scraping performance if needed

## Need Help?

If you encounter issues:
1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Test the API routes directly using curl or Postman
