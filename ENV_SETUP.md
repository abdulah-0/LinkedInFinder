# Environment Variables Setup Guide

## SerpAPI Key Configuration

**IMPORTANT:** Never commit API keys to GitHub!

### For Supabase Edge Functions (Backend)

Set the SerpAPI key as a Supabase secret:

```bash
# Login to Supabase CLI
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Set the SerpAPI key as a secret
supabase secrets set SERPAPI_KEY=3c1f8176da06076a39099dd2cb42faa7f603bae7ccd078a146fbc549d1d8f3a5

# Also set these secrets:
supabase secrets set SUPABASE_URL=your_supabase_project_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### For Vercel (Frontend)

The frontend doesn't need the SerpAPI key directly. Only set:

1. Go to your Vercel project settings
2. Navigate to "Environment Variables"
3. Add:
   - `VITE_SUPABASE_URL` = Your Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = Your Supabase anon key

### Local Development

For local testing, you can create a `.env.local` file in the `frontend` directory (this file is gitignored):

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Security Notes

- ✅ API keys stored in Supabase secrets (encrypted)
- ✅ Environment variables in Vercel (not in code)
- ✅ `.env.local` is gitignored
- ❌ Never commit `.env` files with real keys
- ❌ Never hardcode API keys in source code

## Next Steps

1. **Set Supabase secrets** using the commands above
2. **Deploy Edge Functions**: `supabase functions deploy`
3. **Configure Vercel** environment variables in the dashboard
4. **Test the application** after deployment
