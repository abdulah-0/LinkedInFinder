# CORS Fix Deployment Guide

## What Was Fixed

The CORS (Cross-Origin Resource Sharing) error was occurring because the Edge Functions weren't properly handling preflight OPTIONS requests from your Vercel deployment.

### Changes Made

Updated both Edge Functions (`scrape` and `job-status`) to return proper OPTIONS responses:

```typescript
if (req.method === 'OPTIONS') {
  return new Response(null, {
    status: 200,
    headers: corsHeaders
  })
}
```

**CORS Headers Included:**
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Headers: authorization, x-client-info, apikey, content-type`
- `Access-Control-Allow-Methods: POST, OPTIONS` (for scrape) / `GET, OPTIONS` (for job-status)

## Deployment Steps

### 1. Deploy Edge Functions to Supabase

```bash
cd "c:\Users\snake\OneDrive\Desktop\linkedin scrapper"

# Deploy both functions with the CORS fix
supabase functions deploy scrape
supabase functions deploy job-status
```

### 2. Verify Deployment

After deploying, you should see output like:
```
Deploying function scrape...
Function deployed successfully.
```

### 3. Test Your Application

1. Open your Vercel app: `https://linked-in-finder-pink.vercel.app`
2. Sign in to your account
3. Try performing a search with:
   - Company Name: e.g., "OpenAI"
   - Location: e.g., "San Francisco"
   - Business Type: e.g., "Software"
4. The CORS error should be gone and the search should work

## Troubleshooting

### If CORS Error Persists

1. **Check deployment logs:**
   ```bash
   supabase functions list
   ```

2. **Verify the functions were deployed:**
   - Go to your Supabase dashboard
   - Navigate to Edge Functions
   - Confirm both `scrape` and `job-status` are listed and active

3. **Check browser console:**
   - Open DevTools (F12)
   - Look for any new error messages
   - Share them if the issue continues

### If You See "SERPAPI_KEY is not configured"

This means the secret wasn't set. Run:
```bash
supabase secrets set SERPAPI_KEY=3c1f8176da06076a39099dd2cb42faa7f603bae7ccd078a146fbc549d1d8f3a5
```

Then redeploy:
```bash
supabase functions deploy scrape
```

## Expected Behavior After Fix

✅ No CORS errors in browser console
✅ Search form submits successfully
✅ Job status updates in real-time
✅ Results appear in the table
✅ CSV export works

## Next Steps After Successful Deployment

1. Test all features thoroughly
2. Monitor the scraping results
3. Check the Supabase database for stored companies
4. Verify real-time updates are working

## Need Help?

If you encounter any issues:
1. Check the browser console for errors
2. Check Supabase Edge Function logs
3. Verify all environment variables are set correctly
4. Ensure your Supabase project is linked correctly
