-- Migration: Create Indexes
-- Purpose: Create indexes to optimize query performance for common access patterns
-- Affected Tables: profiles, weekly_reports, stock_picks, imports_audit, events partitions
-- Performance: Indexes selected based on default sorts, joins, and lookup patterns

-- =============================================================================
-- INDEXES: profiles
-- =============================================================================
-- Primary key index created automatically on user_id

-- Optional index for admin lookups (uncomment if frequently filtering by is_admin)
-- create index idx_profiles_is_admin on profiles(is_admin) where is_admin = true;

-- =============================================================================
-- INDEXES: weekly_reports
-- =============================================================================
-- Primary key index created automatically on report_id
-- Unique indexes created automatically on (report_week, version) and (slug)

-- Index for default ordering by publication date (most recent first)
create index idx_weekly_reports_published_at on weekly_reports(published_at desc);

-- =============================================================================
-- INDEXES: stock_picks
-- =============================================================================
-- Primary key index created automatically on pick_id
-- Unique index created automatically on (report_id, ticker, side)

-- Index for join performance when loading picks for a report
create index idx_stock_picks_report_id on stock_picks(report_id);

-- Index for historical ticker lookups across all reports
create index idx_stock_picks_ticker on stock_picks(ticker);

-- =============================================================================
-- INDEXES: imports_audit
-- =============================================================================
-- Primary key index created automatically on import_id

-- Index for filtering imports by user
create index idx_imports_audit_user_id on imports_audit(uploaded_by_user_id);

-- Index for default ordering by start time (most recent first)
create index idx_imports_audit_started_at on imports_audit(started_at desc);

-- Optional index for status filtering (uncomment if frequently filtering by status)
-- create index idx_imports_audit_status on imports_audit(status);

-- =============================================================================
-- INDEXES: events (parent table - inherited by all partitions)
-- =============================================================================
-- Note: Primary key index (event_id, occurred_at) created automatically
-- Local indexes on each partition improve query performance within partition boundaries

-- Composite index for event type filtering with time-based sorting
-- Supports queries like: WHERE event_type = 'report_view' ORDER BY occurred_at DESC
create index idx_events_type_occurred on events(event_type, occurred_at desc);

-- Index for report-specific event lookups
-- Supports queries joining events to specific reports
create index idx_events_report_id on events(report_id);

-- Optional GIN index on metadata JSONB column (uncomment if querying JSON fields)
-- create index idx_events_metadata on events using gin(metadata);

-- Index for user event history
create index idx_events_user_id on events(user_id, occurred_at desc);

-- =============================================================================
-- INDEXES: staff_networks
-- =============================================================================
-- Primary key index created automatically on network (CIDR)
-- CIDR data type supports efficient network containment operators (<<, >>, &&)

