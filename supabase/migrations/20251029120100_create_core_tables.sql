-- Migration: Create Core Tables
-- Purpose: Create the main application tables for user profiles, weekly reports, and stock picks
-- Affected Tables: profiles, weekly_reports, stock_picks
-- Dependencies: auth.users (Supabase managed), pgcrypto extension, side_enum, pct_change domain

-- =============================================================================
-- TABLE: profiles
-- =============================================================================
-- Purpose: Application-managed extension of auth.users for storing user roles and flags
-- Relationship: 1:1 with auth.users
-- Note: Do NOT duplicate email or credentials here; auth.users is the single source of truth

create table profiles (
  -- Primary key and foreign key to Supabase Auth user
  user_id uuid primary key references auth.users(id) on delete cascade not null,
  
  -- Admin flag for role-based access control
  is_admin boolean not null default false,
  
  -- Timestamp of profile creation
  created_at timestamptz not null default now()
);

-- Enable Row Level Security
alter table profiles enable row level security;

-- =============================================================================
-- TABLE: weekly_reports
-- =============================================================================
-- Purpose: Store weekly AI stock pick reports with metadata
-- Unique Constraints: (report_week, version) ensures one report per week per version
-- Unique Constraints: (slug) ensures unique permalinks

create table weekly_reports (
  -- Primary key
  report_id uuid primary key not null default gen_random_uuid(),
  
  -- Publication timestamp (source of truth for week calculation)
  published_at timestamptz not null,
  
  -- ISO week format (YYYY-"W"WW) - auto-set by trigger from published_at to prevent drift
  -- Example: "2025-W43"
  report_week text not null,
  
  -- Version identifier for potential report revisions
  version text not null default 'v1',
  
  -- SHA-256 checksum of source JSON file for integrity verification
  source_checksum text null,
  
  -- Report metadata
  title text not null,
  summary text not null,
  
  -- URL-friendly slug derived from report_week and title
  -- Treat as immutable after creation for permalink stability
  slug text not null unique,
  
  -- Record creation timestamp
  created_at timestamptz not null default now(),
  
  -- Ensure one report per week per version
  unique (report_week, version)
);

-- Enable Row Level Security
alter table weekly_reports enable row level security;

-- =============================================================================
-- TRIGGER FUNCTION: set_report_week
-- =============================================================================
-- Purpose: Automatically calculate and set report_week from published_at
-- This trigger ensures report_week is always in sync with published_at

create or replace function set_report_week()
returns trigger
language plpgsql
as $$
begin
  -- Calculate ISO week format from published_at
  new.report_week := to_char(new.published_at, 'IYYY-"W"IW');
  return new;
end;
$$;

-- Create trigger to auto-set report_week on insert and update
create trigger trg_set_report_week
  before insert or update of published_at
  on weekly_reports
  for each row
  execute function set_report_week();

-- =============================================================================
-- TABLE: stock_picks
-- =============================================================================
-- Purpose: Store individual stock picks associated with weekly reports
-- Relationship: Many-to-One with weekly_reports (cascading delete)
-- Unique Constraint: (report_id, ticker, side) prevents duplicate picks within a report

create table stock_picks (
  -- Primary key
  pick_id uuid primary key not null default gen_random_uuid(),
  
  -- Foreign key to parent weekly report (cascades on delete)
  report_id uuid not null references weekly_reports(report_id) on delete cascade,
  
  -- Stock identification
  ticker text not null,
  exchange text not null,
  
  -- Trade direction (long/short)
  side side_enum not null,
  
  -- Target percentage change (constrained by pct_change domain: -1000 to 1000)
  target_change_pct pct_change not null,
  
  -- Investment rationale/reasoning
  rationale text not null,
  
  -- Record creation timestamp
  created_at timestamptz not null default now(),
  
  -- Prevent duplicate picks for same ticker and side within a report
  unique (report_id, ticker, side)
);

-- Enable Row Level Security
alter table stock_picks enable row level security;

