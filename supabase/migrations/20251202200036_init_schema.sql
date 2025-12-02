-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Companies Table
create table companies (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  company_name text not null,
  linkedin_url text,
  linkedin_id text,
  industry text,
  employee_count text,
  headquarters text,
  website text,
  description text,
  search_query text,
  scraped_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Jobs Table
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id),
  status text check (status in ('queued', 'processing', 'completed', 'failed')) default 'queued',
  payload jsonb,
  result_id uuid references companies(id),
  error_message text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Scrape Logs Table
create table scrape_logs (
  id uuid primary key default uuid_generate_v4(),
  request_payload jsonb,
  response_status integer,
  error text,
  created_at timestamptz default now()
);

-- RLS Policies
alter table companies enable row level security;
alter table jobs enable row level security;
alter table scrape_logs enable row level security;

create policy "Users can view their own companies" on companies
  for select using (auth.uid() = user_id);

create policy "Users can insert their own companies" on companies
  for insert with check (auth.uid() = user_id);

create policy "Users can view their own jobs" on jobs
  for select using (auth.uid() = user_id);

create policy "Users can insert their own jobs" on jobs
  for insert with check (auth.uid() = user_id);

-- Allow service role to do everything (for edge functions)
-- Note: Service role bypasses RLS, but good to be explicit if needed.
