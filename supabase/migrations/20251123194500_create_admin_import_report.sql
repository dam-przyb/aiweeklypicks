-- Migration: Create SECURITY DEFINER RPC for admin report import
-- Function: admin_import_report(payload JSONB, filename TEXT) RETURNS JSONB
-- Purpose: Atomically insert a weekly report and its stock picks with admin privileges
-- Notes:
-- - Minimal validation; assumes payload contains required fields per app contract
-- - Generates a slug based on published_at date and a fixed base
-- - Refreshes picks_history materialized view on success

create or replace function admin_import_report(payload jsonb, filename text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_import_id uuid := gen_random_uuid();
  v_report_id uuid;
  v_published_at timestamptz;
  v_version text;
  v_checksum text;
  v_title text;
  v_summary text;
  v_slug text;
  v_pick jsonb;
begin
  -- Extract and validate required fields
  v_report_id := (payload->>'report_id')::uuid;
  if v_report_id is null then
    raise exception 'report_id is required';
  end if;

  v_published_at := (payload->>'published_at')::timestamptz;
  if v_published_at is null then
    raise exception 'published_at is required';
  end if;

  v_version := coalesce(payload->>'version', 'v1');
  v_checksum := nullif(payload->>'source_checksum', '');
  v_title := payload->>'title';
  v_summary := payload->>'summary';
  if v_title is null or v_summary is null then
    raise exception 'title and summary are required';
  end if;

  -- Generate a deterministic slug (YYYY-MM-DD-us-market-report)
  v_slug := to_char(v_published_at::date, 'YYYY-MM-DD') || '-us-market-report';

  -- Insert or update report
  insert into weekly_reports (
    report_id, published_at, version, source_checksum, title, summary, slug
  ) values (
    v_report_id, v_published_at, v_version, v_checksum, v_title, v_summary, v_slug
  )
  on conflict (report_id) do update
    set published_at = excluded.published_at,
        version = excluded.version,
        source_checksum = excluded.source_checksum,
        title = excluded.title,
        summary = excluded.summary,
        slug = excluded.slug;

  -- Insert or upsert picks
  for v_pick in
    select * from jsonb_array_elements(coalesce(payload->'picks', '[]'::jsonb))
  loop
    insert into stock_picks (
      pick_id, report_id, ticker, exchange, side, target_change_pct, rationale
    ) values (
      (v_pick->>'pick_id')::uuid,
      v_report_id,
      v_pick->>'ticker',
      v_pick->>'exchange',
      (v_pick->>'side')::side_enum,
      (v_pick->>'target_change_pct')::numeric,
      v_pick->>'rationale'
    )
    on conflict (report_id, ticker, side) do update
      set target_change_pct = excluded.target_change_pct,
          rationale = excluded.rationale;
  end loop;

  -- Refresh materialized view (best effort)
  perform refresh_picks_history();

  return jsonb_build_object(
    'import_id', v_import_id,
    'status', 'success',
    'report_id', v_report_id,
    'report_slug', v_slug
  );
exception
  when others then
    return jsonb_build_object(
      'import_id', v_import_id,
      'status', 'failed',
      'error', SQLERRM
    );
end;
$$;

comment on function admin_import_report(jsonb, text) is
'SECURITY DEFINER: Imports a weekly report and its stock picks from JSON payload. Returns import result JSON.';


