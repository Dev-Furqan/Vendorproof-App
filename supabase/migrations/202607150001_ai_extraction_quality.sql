alter table public.documents add column if not exists business_name text;
alter table public.documents add column if not exists policy_number text;
alter table public.documents add column if not exists issuing_authority text;
alter table public.documents add column if not exists ai_extraction_status text default 'not_started';
alter table public.documents add column if not exists ai_extraction_model text;
alter table public.documents add column if not exists ai_extraction_raw jsonb;
alter table public.documents add column if not exists ai_extraction_confidence numeric;
alter table public.documents add column if not exists ai_extraction_flags text[] default '{}';
alter table public.documents add column if not exists ai_extraction_usage jsonb;
alter table public.documents add column if not exists ai_extraction_error text;
alter table public.documents add column if not exists ai_extraction_completed_at timestamptz;
alter table public.documents add column if not exists ai_extraction_confirmed_at timestamptz;
alter table public.documents add column if not exists ai_extraction_confirmed_by uuid references auth.users(id);
alter table public.documents add column if not exists ai_extraction_corrected_fields jsonb;
alter table public.documents add column if not exists ai_extracted_document_type text;
alter table public.documents add column if not exists ai_extracted_business_name text;
alter table public.documents add column if not exists ai_extracted_policy_number text;
alter table public.documents add column if not exists ai_extracted_effective_date date;
alter table public.documents add column if not exists ai_extracted_expiration_date date;
alter table public.documents add column if not exists ai_extracted_issuing_authority text;

create table if not exists public.document_ai_corrections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  document_version_id uuid references public.document_versions(id) on delete set null,
  reviewer_id uuid references auth.users(id) on delete set null default auth.uid(),
  document_type text not null,
  selected_document_type text,
  detected_document_type text,
  field_name text not null,
  ai_value text,
  corrected_value text,
  model text,
  image_quality jsonb,
  created_at timestamptz not null default now(),
  constraint document_ai_corrections_changed check (ai_value is distinct from corrected_value)
);

create index if not exists document_ai_corrections_org_created_idx
  on public.document_ai_corrections (organization_id, created_at desc);
create index if not exists document_ai_corrections_field_idx
  on public.document_ai_corrections (organization_id, document_type, field_name);
create index if not exists document_ai_corrections_document_idx
  on public.document_ai_corrections (document_id);

alter table public.document_ai_corrections enable row level security;

drop policy if exists "Members can read AI corrections" on public.document_ai_corrections;
create policy "Members can read AI corrections"
on public.document_ai_corrections for select
using (
  exists (
    select 1 from public.memberships membership
    where membership.organization_id = document_ai_corrections.organization_id
      and membership.user_id = auth.uid()
  )
);

drop policy if exists "Members can create AI corrections" on public.document_ai_corrections;
create policy "Members can create AI corrections"
on public.document_ai_corrections for insert
with check (
  reviewer_id = auth.uid()
  and exists (
    select 1 from public.memberships membership
    where membership.organization_id = document_ai_corrections.organization_id
      and membership.user_id = auth.uid()
  )
);

create or replace view public.document_ai_correction_report
with (security_invoker = true)
as
select
  organization_id,
  document_type,
  field_name,
  model,
  count(*) as correction_count,
  count(distinct document_id) as affected_documents,
  round(
    count(*) * 100.0 / nullif(sum(count(*)) over (partition by organization_id), 0),
    1
  ) as percent_of_all_corrections,
  count(*) filter (where image_quality ->> 'contrastNormalized' = 'true') as poor_lighting_corrections,
  count(*) filter (
    where greatest(
      coalesce((image_quality ->> 'outputWidth')::integer, 0),
      coalesce((image_quality ->> 'outputHeight')::integer, 0)
    ) < 1200
  ) as low_resolution_corrections,
  min(created_at) as first_seen_at,
  max(created_at) as last_seen_at
from public.document_ai_corrections
group by organization_id, document_type, field_name, model;

grant select, insert on public.document_ai_corrections to authenticated;
grant select on public.document_ai_correction_report to authenticated;

