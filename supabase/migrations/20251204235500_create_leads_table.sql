-- Create Leads Table
create table leads (
  id uuid primary key default uuid_generate_v4(),
  job_id uuid references jobs(id),
  company_name text,
  full_name text,
  first_name text,
  last_name text,
  job_title text,
  linkedin_url text,
  email text,
  phone text,
  location text,
  created_at timestamptz default now()
);

-- RLS Policies for Leads
alter table leads enable row level security;

create policy "Users can view their own leads via jobs" on leads
  for select using (
    exists (
      select 1 from jobs
      where jobs.id = leads.job_id
      and jobs.user_id = auth.uid()
    )
  );

create policy "Users can insert their own leads via jobs" on leads
  for insert with check (
    exists (
      select 1 from jobs
      where jobs.id = leads.job_id
      and jobs.user_id = auth.uid()
    )
  );
