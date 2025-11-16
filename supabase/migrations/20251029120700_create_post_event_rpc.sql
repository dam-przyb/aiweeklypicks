-- Migration: Create RPC Function for Event Ingestion
-- Purpose: SECURITY DEFINER function to safely insert events with server-controlled metadata
-- Security: Enforces RLS policies and uses auth.uid() for user association
-- Called by: POST /api/events endpoint

-- =============================================================================
-- FUNCTION: admin_post_event
-- =============================================================================
-- Purpose: Insert event with server-controlled metadata and privacy guarantees
-- Security: SECURITY DEFINER allows controlled insert into events table via RLS
-- Returns: UUID of the newly created event
-- Usage: Called by Astro API endpoint to persist client events

create or replace function admin_post_event(
  p_event_type text,
  p_dwell_seconds numeric default null,
  p_report_id uuid default null,
  p_metadata jsonb default null,
  p_user_agent text default null,
  p_ip_hash text default 'unknown'
)
returns jsonb
language plpgsql
security definer  -- Run with privileges of function owner (can insert into events)
set search_path = public, auth  -- Explicit search path for security
as $$
declare
  v_event_id uuid;
  v_user_id uuid;
  v_occurred_at timestamptz;
begin
  -- Validate event_type (additional safety check beyond API validation)
  if p_event_type not in ('registration_complete', 'login', 'report_view', 'table_view') then
    raise exception 'Invalid event_type: %', p_event_type;
  end if;
  
  -- Get current authenticated user (null for anonymous events)
  v_user_id := auth.uid();
  
  -- Capture server timestamp
  v_occurred_at := now();
  
  -- Generate event ID
  v_event_id := gen_random_uuid();
  
  -- Insert event into events table
  -- Triggers will automatically set is_staff_ip and is_bot flags
  insert into events (
    event_id,
    user_id,
    event_type,
    occurred_at,
    user_agent,
    ip_hash,
    dwell_seconds,
    metadata,
    report_id
  ) values (
    v_event_id,
    v_user_id,
    p_event_type,
    v_occurred_at,
    p_user_agent,
    p_ip_hash,
    p_dwell_seconds,
    p_metadata,
    p_report_id
  );
  
  -- Return the event_id as JSONB for API response
  return jsonb_build_object('event_id', v_event_id);
  
exception
  when foreign_key_violation then
    -- Handle FK violation (e.g., invalid report_id)
    raise exception 'Invalid report_id: referenced report does not exist';
  when check_violation then
    -- Handle check constraint violations
    raise exception 'Event data violates table constraints';
  when others then
    -- Re-raise any other errors for logging
    raise;
end;
$$;

-- Grant execute permission to authenticated users (RLS still applies)
grant execute on function admin_post_event(text, numeric, uuid, jsonb, text, text) to authenticated;

-- Grant execute permission to anon role for anonymous event tracking
grant execute on function admin_post_event(text, numeric, uuid, jsonb, text, text) to anon;

-- =============================================================================
-- COMMENTS
-- =============================================================================
-- Add helpful comment for documentation

comment on function admin_post_event(text, numeric, uuid, jsonb, text, text) is 
  'SECURITY DEFINER: Inserts event with server metadata. Uses auth.uid() for user_id. Returns event_id.';

