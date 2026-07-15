-- Run in Supabase SQL Editor while signed in as an organization member.
select
  document_type,
  field_name,
  model,
  correction_count,
  affected_documents,
  percent_of_all_corrections,
  poor_lighting_corrections,
  low_resolution_corrections,
  last_seen_at
from public.document_ai_correction_report
order by correction_count desc, document_type, field_name;
