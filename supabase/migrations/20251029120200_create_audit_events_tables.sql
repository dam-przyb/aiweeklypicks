-- Migration: Create Audit and Events Tables
-- Purpose: Create tables for import auditing, event tracking, and staff network management
-- Affected Tables: imports_audit, events (partitioned), staff_networks
-- Dependencies: auth.users, weekly_reports, import_status_enum

-- =============================================================================
-- TABLE: imports_audit
-- =============================================================================
-- Purpose: Audit trail for all report import operations
-- Tracks import metadata, status, errors, and source JSON for debugging
-- Relationship: Optional foreign key to auth.users (nulled on user deletion)

create table imports_audit (
  -- Primary key
  import_id uuid primary key not null default gen_random_uuid(),
  
  -- Optional reference to user who performed the import (null if user deleted)
  uploaded_by_user_id uuid null references auth.users(id) on delete set null,
  
  -- Source file metadata
  filename text not null,
  source_checksum text null,
  schema_version text not null,  -- e.g., 'v1'
  
  -- Import operation status and error details
  status import_status_enum not null,
  error_message text null,
  
  -- Full source JSON for debugging and reprocessing
  -- Constrained to ≤ 5MB to prevent excessive storage usage
  source_json jsonb null,
  
  -- Import operation timestamps
  started_at timestamptz not null default now(),
  finished_at timestamptz null,
  
  -- Enforce 5MB limit on source JSON
  check (octet_length(source_json::text) <= 5 * 1024 * 1024)
);

-- Enable Row Level Security
alter table imports_audit enable row level security;

-- =============================================================================
-- TABLE: events (Range Partitioned by occurred_at)
-- =============================================================================
-- Purpose: Track user events (registrations, logins, page views) for analytics
-- Partitioning: Monthly range partitions on occurred_at for efficient querying and retention management
-- Privacy: IP addresses are hashed with salt; staff IPs and bots are flagged

-- Create parent table (partitioned)
create table events (
  -- Primary key
  event_id uuid not null default gen_random_uuid(),
  
  -- Optional reference to authenticated user (null for anonymous events or if user deleted)
  user_id uuid null references auth.users(id) on delete set null,
  
  -- Event type with check constraint for valid values
  event_type text not null check (event_type in (
    'registration_complete',
    'login',
    'report_view',
    'table_view'
  )),
  
  -- Event timestamp (partition key)
  occurred_at timestamptz not null,
  
  -- Request metadata for analytics
  user_agent text null,
  ip_hash text not null,  -- salted SHA-256 of IP address for privacy
  
  -- Event-specific metrics
  dwell_seconds numeric null,  -- time spent on page
  metadata jsonb null,  -- flexible JSON for event-specific data
  
  -- Classification flags set by triggers
  is_staff_ip boolean not null default false,  -- set by trigger checking staff_networks
  is_bot boolean not null default false,  -- set by trigger analyzing user_agent
  
  -- Optional reference to related report (null if report deleted)
  report_id uuid null references weekly_reports(report_id) on delete set null,
  
  -- Composite primary key including partition key
  primary key (event_id, occurred_at)
) partition by range (occurred_at);

-- Enable Row Level Security on parent table (inherited by partitions)
alter table events enable row level security;

-- Create initial partitions for current and upcoming months
-- Partition for October 2025
create table events_2025_10 partition of events
  for values from ('2025-10-01') to ('2025-11-01');

-- Partition for November 2025
create table events_2025_11 partition of events
  for values from ('2025-11-01') to ('2025-12-01');

-- Partition for December 2025
create table events_2025_12 partition of events
  for values from ('2025-12-01') to ('2026-01-01');

-- =============================================================================
-- TABLE: staff_networks
-- =============================================================================
-- Purpose: Maintain list of IP networks belonging to staff/internal systems
-- Used by triggers to automatically flag events from staff IPs
-- CIDR format allows efficient network range matching

create table staff_networks (
  -- CIDR notation for IP network (e.g., '192.168.1.0/24')
  network cidr primary key,
  
  -- Optional human-readable label for the network
  label text null,
  
  -- Record creation timestamp
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table staff_networks enable row level security;

