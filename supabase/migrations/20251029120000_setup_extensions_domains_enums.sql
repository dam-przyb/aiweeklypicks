-- Migration: Setup Extensions, Domains, and Enums
-- Purpose: Create foundational database objects required for the AI Weekly Picks application
-- Affected Objects: pgcrypto extension, custom domains (pct_change), custom enums (side_enum, import_status_enum)

-- =============================================================================
-- EXTENSIONS
-- =============================================================================

-- Enable pgcrypto extension for UUID generation
-- Required for gen_random_uuid() function used throughout the schema
create extension if not exists pgcrypto;

-- =============================================================================
-- CUSTOM DOMAINS
-- =============================================================================

-- Domain for percentage change values
-- Constrains values to reasonable range of -1000% to +1000% to prevent data entry errors
-- Used in stock_picks.target_change_pct
create domain pct_change as numeric(10,2)
  check (value between -1000 and 1000);

-- =============================================================================
-- ENUMS
-- =============================================================================

-- Enum for trade direction/side
-- Represents whether a stock pick is a long (buy) or short (sell) position
create type side_enum as enum ('long', 'short');

-- Enum for import operation status
-- Tracks whether a report import operation succeeded or failed
create type import_status_enum as enum ('success', 'failed');

