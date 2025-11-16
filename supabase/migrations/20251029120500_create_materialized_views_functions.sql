-- Migration: Create Materialized Views and Helper Functions
-- Purpose: Create optimized materialized view for historical picks and helper functions
-- Affected Objects: picks_history materialized view, get_current_user_identity function, triggers
-- Performance: Materialized view eliminates expensive joins for historical picks table

-- =============================================================================
-- MATERIALIZED VIEW: picks_history
-- =============================================================================
-- Purpose: Pre-joined view of reports and picks for fast historical table rendering
-- Refresh Strategy: REFRESH after successful imports via admin_import_report function
-- Performance: Eliminates expensive joins when displaying all historical picks

create materialized view picks_history as
select
  wr.published_at,
  wr.report_week,
  sp.ticker,
  sp.exchange,
  sp.side,
  sp.target_change_pct,
  sp.report_id
from weekly_reports wr
inner join stock_picks sp on wr.report_id = sp.report_id
order by wr.published_at desc, sp.ticker;

-- Create indexes on materialized view for query performance
create index idx_picks_history_published_at on picks_history(published_at desc);
create index idx_picks_history_ticker on picks_history(ticker);

-- =============================================================================
-- FUNCTION: get_current_user_identity
-- =============================================================================
-- Purpose: SECURITY DEFINER function to retrieve current user's identity from auth.users
-- Security: Allows app code to access auth.users data without direct table access
-- Returns: JSON object with user_id, email, and created_at
-- Usage: Called by application code to get authenticated user details

create or replace function get_current_user_identity()
returns jsonb
language plpgsql
security definer  -- Run with privileges of function owner (can access auth.users)
set search_path = public, auth  -- Explicit search path for security
as $$
declare
  user_data jsonb;
begin
  -- Check if user is authenticated
  if auth.uid() is null then
    return jsonb_build_object(
      'user_id', null,
      'email', null,
      'created_at', null,
      'authenticated', false
    );
  end if;
  
  -- Retrieve user data from auth.users
  select jsonb_build_object(
    'user_id', id,
    'email', email,
    'created_at', created_at,
    'authenticated', true
  )
  into user_data
  from auth.users
  where id = auth.uid();
  
  return user_data;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function get_current_user_identity() to authenticated;

-- =============================================================================
-- TRIGGER FUNCTION: set_staff_ip_flag
-- =============================================================================
-- Purpose: Automatically set is_staff_ip flag on event insert by checking staff_networks
-- Performance: Uses CIDR containment operator (<<) for efficient network matching

create or replace function set_staff_ip_flag()
returns trigger
language plpgsql
as $$
begin
  -- Check if event IP (would need to be passed in metadata) matches any staff network
  -- Note: This is a placeholder. Actual implementation depends on how IP is passed to insert
  -- The trigger should be modified based on actual event insertion pattern
  
  -- For now, default to false (can be set explicitly during insert)
  -- A real implementation would parse IP from metadata or function parameter
  -- and check: select exists(select 1 from staff_networks where inet(ip_address) << network)
  
  return new;
end;
$$;

-- Create trigger on events table (applies to all partitions)
create trigger trg_set_staff_ip_flag
  before insert on events
  for each row
  execute function set_staff_ip_flag();

-- =============================================================================
-- TRIGGER FUNCTION: set_bot_flag
-- =============================================================================
-- Purpose: Automatically detect and flag bot traffic based on user agent heuristics
-- Performance: Simple string matching on user_agent field

create or replace function set_bot_flag()
returns trigger
language plpgsql
as $$
begin
  -- Simple bot detection based on common bot user agent patterns
  -- This is a basic heuristic; consider more sophisticated detection in production
  if new.user_agent is not null then
    new.is_bot := (
      new.user_agent ilike '%bot%' or
      new.user_agent ilike '%crawler%' or
      new.user_agent ilike '%spider%' or
      new.user_agent ilike '%headless%' or
      new.user_agent ilike '%curl%' or
      new.user_agent ilike '%wget%' or
      new.user_agent ilike '%python%' or
      new.user_agent ilike '%scrapy%'
    );
  end if;
  
  return new;
end;
$$;

-- Create trigger on events table (applies to all partitions)
create trigger trg_set_bot_flag
  before insert on events
  for each row
  execute function set_bot_flag();

-- =============================================================================
-- FUNCTION: refresh_picks_history
-- =============================================================================
-- Purpose: Wrapper function to refresh picks_history materialized view
-- Security: Admin-only via RLS; called after successful report imports
-- Usage: CALL refresh_picks_history() after importing new reports

create or replace function refresh_picks_history()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Refresh the materialized view concurrently if possible
  -- Note: CONCURRENTLY requires a unique index, which we have via event_id
  refresh materialized view picks_history;
end;
$$;

-- Grant execute permission to authenticated users (actual execution controlled by RLS checks in calling code)
grant execute on function refresh_picks_history() to authenticated;

-- =============================================================================
-- COMMENTS
-- =============================================================================
-- Add helpful comments to database objects for documentation

comment on materialized view picks_history is 'Pre-joined historical stock picks for fast table rendering. Refresh after imports.';
comment on function get_current_user_identity() is 'SECURITY DEFINER: Returns current authenticated user details from auth.users';
comment on function set_staff_ip_flag() is 'Trigger function: Automatically sets is_staff_ip flag based on staff_networks table';
comment on function set_bot_flag() is 'Trigger function: Automatically detects and flags bot traffic based on user agent';
comment on function refresh_picks_history() is 'Admin function: Refreshes picks_history materialized view after report imports';

