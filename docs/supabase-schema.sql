create table if not exists public.docflow_users (
  user_id text primary key,
  email text not null unique,
  display_name text not null,
  password_hash text,
  external_provider text check (external_provider in ('logto', 'google')),
  external_subject text unique,
  account_type text not null check (account_type in ('individual', 'team')),
  team_name text,
  default_workspace_id text,
  created_at_utc timestamptz not null default timezone('utc', now()),
  last_login_at_utc timestamptz
);

alter table public.docflow_users
  add column if not exists onboarding_completed_at timestamptz,
  add column if not exists onboarding_state jsonb not null default '{}'::jsonb;

create table if not exists public.workspaces (
  workspace_id text primary key,
  name text not null,
  slug text not null unique,
  account_type text not null check (account_type in ('individual', 'team')),
  created_at_utc timestamptz not null default timezone('utc', now()),
  updated_at_utc timestamptz not null default timezone('utc', now()),
  created_by_user_id text not null
);

alter table public.workspaces
  add column if not exists github_installation_id bigint,
  add column if not exists github_connected_at_utc timestamptz,
  add column if not exists github_account_login text;

create table if not exists public.workspace_members (
  workspace_id text not null references public.workspaces(workspace_id) on delete cascade,
  user_id text not null references public.docflow_users(user_id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('owner', 'admin', 'editor')),
  joined_at_utc timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create table if not exists public.workspace_invitations (
  invitation_id text primary key,
  workspace_id text not null references public.workspaces(workspace_id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin', 'editor')),
  invited_by_user_id text not null,
  invited_at_utc timestamptz not null default timezone('utc', now()),
  accepted_at_utc timestamptz,
  status text not null check (status in ('pending', 'accepted', 'revoked', 'expired'))
);

create index if not exists idx_docflow_users_default_workspace
  on public.docflow_users(default_workspace_id);

create index if not exists idx_docflow_users_external_identity
  on public.docflow_users(external_provider, external_subject);

create index if not exists idx_workspace_members_user_id
  on public.workspace_members(user_id);

create index if not exists idx_workspace_invitations_workspace_id
  on public.workspace_invitations(workspace_id);

create table if not exists public.github_connections (
  user_id text primary key references public.docflow_users(user_id) on delete cascade,
  provider text not null check (provider in ('manual-token', 'oauth')),
  github_username text,
  access_token text not null,
  connected_at_utc timestamptz not null default timezone('utc', now())
);

create table if not exists public.workspace_repo_selections (
  workspace_id text not null references public.workspaces(workspace_id) on delete cascade,
  repository_id text not null,
  full_name text not null,
  owner_login text not null,
  default_branch text,
  private boolean not null default false,
  html_url text not null,
  selected_at_utc timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, repository_id)
);

create index if not exists idx_workspace_repo_selections_workspace_id
  on public.workspace_repo_selections(workspace_id);

create table if not exists public.test_plans (
  plan_id text primary key,
  workspace_id text not null references public.workspaces(workspace_id) on delete cascade,
  name text not null,
  description text,
  repository_full_name text,
  branch text,
  target_environment text,
  status text not null check (status in ('draft', 'ready', 'archived')),
  created_at_utc timestamptz not null default timezone('utc', now()),
  created_by text not null,
  last_modified_at_utc timestamptz,
  test_case_ids jsonb not null default '[]'::jsonb
);

create index if not exists idx_test_plans_workspace_id
  on public.test_plans(workspace_id);

create table if not exists public.test_plan_runs (
  run_id text primary key,
  plan_id text not null references public.test_plans(plan_id) on delete cascade,
  workspace_id text not null references public.workspaces(workspace_id) on delete cascade,
  status text not null check (status in ('queued', 'running', 'passed', 'failed', 'cancelled')),
  trigger text not null check (trigger in ('manual')),
  source text not null check (source in ('docflow')),
  branch text,
  target_environment text,
  notes text,
  created_at_utc timestamptz not null default timezone('utc', now()),
  created_by text not null,
  started_at_utc timestamptz,
  completed_at_utc timestamptz,
  total_tests integer,
  passed_tests integer,
  failed_tests integer,
  skipped_tests integer
);

create index if not exists idx_test_plan_runs_plan_id
  on public.test_plan_runs(plan_id, created_at_utc desc);

create table if not exists public.recordings (
  recording_id text primary key,
  recording_name text not null,
  product_area text not null,
  metadata jsonb not null,
  events jsonb not null default '[]'::jsonb,
  speech_transcripts jsonb not null default '[]'::jsonb,
  screenshots jsonb not null default '[]'::jsonb,
  user_id text not null references public.docflow_users(user_id),
  workspace_id text references public.workspaces(workspace_id),
  uploaded_at_utc timestamptz not null default timezone('utc', now()),
  last_modified_at_utc timestamptz,
  event_count integer not null default 0,
  transcript_count integer not null default 0,
  screenshot_count integer not null default 0
);

create index if not exists idx_recordings_uploaded_at_utc
  on public.recordings(uploaded_at_utc desc);

create index if not exists idx_recordings_user_id
  on public.recordings(user_id);

create index if not exists idx_recordings_product_area
  on public.recordings(product_area);

create table if not exists public.documents (
  document_id text primary key,
  recording_id text not null references public.recordings(recording_id) on delete restrict,
  document_type text not null,
  document_title text not null,
  content text not null,
  locale text not null default 'en-AU',
  created_at_utc timestamptz not null default timezone('utc', now()),
  created_by text not null,
  created_by_name text,
  last_modified_at_utc timestamptz,
  last_modified_by text,
  recording_name text not null,
  product_area text not null,
  folder text,
  workspace_id text references public.workspaces(workspace_id)
);

create index if not exists idx_documents_created_at_utc
  on public.documents(created_at_utc desc);

create index if not exists idx_documents_created_by
  on public.documents(created_by);

create index if not exists idx_documents_recording_id
  on public.documents(recording_id);

create index if not exists idx_documents_document_type
  on public.documents(document_type);

create table if not exists public.system_config (
  config_type text primary key,
  global_system_prompt text not null,
  document_types jsonb not null default '[]'::jsonb,
  folder_configs jsonb not null default '[]'::jsonb,
  last_modified_at_utc timestamptz not null default timezone('utc', now()),
  last_modified_by text not null
);

create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  action text not null,
  user_id text not null,
  user_email text not null,
  resource_type text not null,
  resource_id text,
  details jsonb,
  timestamp timestamptz not null default timezone('utc', now())
);

create index if not exists idx_audit_log_timestamp
  on public.audit_log(timestamp desc);

create table if not exists public.extension_releases (
  version text primary key,
  download_url text not null,
  notes text,
  published_by text,
  published_at_utc timestamptz not null default timezone('utc', now())
);

create table if not exists public.notification_reads (
  user_id text not null,
  audit_log_id bigint not null references public.audit_log(id) on delete cascade,
  read_at_utc timestamptz not null default timezone('utc', now()),
  primary key (user_id, audit_log_id)
);

create index if not exists idx_notification_reads_user_id
  on public.notification_reads(user_id);

create index if not exists idx_notification_reads_audit_log_id
  on public.notification_reads(audit_log_id);

-- ────────────────────────────────────────────────────────────
-- Migrations: relax cascade deletes so deleting a user preserves data
-- ────────────────────────────────────────────────────────────

-- Recordings: keep recordings when the creator deletes their account
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'recordings_user_id_fkey'
  ) then
    alter table public.recordings drop constraint recordings_user_id_fkey;
    alter table public.recordings
      add constraint recordings_user_id_fkey
      foreign key (user_id) references public.docflow_users(user_id);
  end if;
end $$;

-- Documents: keep documents when the author deletes their account
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'documents_created_by_fkey'
  ) then
    alter table public.documents drop constraint documents_created_by_fkey;
    alter table public.documents
      add constraint documents_created_by_fkey
      foreign key (created_by) references public.docflow_users(user_id);
  end if;
end $$;

-- Test plan runs: keep run history when a user deletes their account
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'test_plan_runs_created_by_fkey'
  ) then
    alter table public.test_plan_runs drop constraint test_plan_runs_created_by_fkey;
    alter table public.test_plan_runs
      add constraint test_plan_runs_created_by_fkey
      foreign key (created_by) references public.docflow_users(user_id);
  end if;
end $$;

-- ────────────────────────────────────────────────────────────
-- Migrations: remove 'viewer' role
-- ────────────────────────────────────────────────────────────

alter table public.workspace_members
  drop constraint if exists workspace_members_role_check,
  add constraint workspace_members_role_check check (role in ('owner', 'admin', 'editor'));

alter table public.workspace_invitations
  drop constraint if exists workspace_invitations_role_check,
  add constraint workspace_invitations_role_check check (role in ('admin', 'editor'));

-- Migrate existing 'viewer' members to 'editor'
update public.workspace_members set role = 'editor' where role = 'viewer';
update public.workspace_invitations set role = 'editor' where role = 'viewer';

-- ────────────────────────────────────────────────────────────
-- Migrations: add workspace_id to recordings and documents
-- ────────────────────────────────────────────────────────────

alter table public.recordings
  add column if not exists workspace_id text references public.workspaces(workspace_id);

alter table public.documents
  add column if not exists workspace_id text references public.workspaces(workspace_id);

-- Backfill workspace_id from the user's default workspace for existing rows
do $$
declare
  r record;
  ws_id text;
begin
  for r in select user_id from public.docflow_users loop
    select default_workspace_id into ws_id from public.docflow_users where user_id = r.user_id;
    if ws_id is not null then
      update public.recordings set workspace_id = ws_id where user_id = r.user_id and workspace_id is null;
      update public.documents set workspace_id = ws_id where created_by = r.user_id and workspace_id is null;
    end if;
  end loop;
end $$;
