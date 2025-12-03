- **Scraping**: Uses SerpAPI to find LinkedIn pages and extracts data (employees, industry, etc.).
- **Async Processing**: Handles long-running scrapes via background jobs.
- **Results**: View results in a table and export to CSV.
- **Auth**: Secure access via Supabase Auth.

## Tech Stack

- **Frontend**: React, Vite, Tailwind CSS, Radix UI
- **Backend**: Supabase (Postgres, Auth, Edge Functions)
- **Scraping**: SerpAPI, Cheerio

## Setup

### Prerequisites

- Node.js 18+
- Supabase CLI
- Docker (for local Supabase)
- SerpAPI Key

### Environment Variables

Create `frontend/.env.local`:
```
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

Configure Supabase Edge Functions secrets:
```bash
supabase secrets set SERPAPI_KEY=your_serpapi_key
supabase secrets set SUPABASE_URL=your_project_url
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

### Local Development

1. **Start Supabase**:
   ```bash
   supabase start
   ```

2. **Deploy Edge Functions**:
   ```bash
   supabase functions serve --no-verify-jwt # For local testing
   # OR
   supabase functions deploy scrape
   supabase functions deploy job-status
   ```

3. **Start Frontend**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

## Deployment

1. **Supabase**:
   - Link your project: `supabase link --project-ref your-project-ref`
   - Push migrations: `supabase db push`
   - Deploy functions: `supabase functions deploy`

2. **Frontend**:
   - Build: `npm run build`
   - Deploy to Vercel/Netlify (set env vars in dashboard).

## Testing

Run unit tests (if implemented):
```bash
npm test
```
