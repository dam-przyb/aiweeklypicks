-- Migration: Update uniqueness for weekly_reports
-- Goal: Allow multiple reports in the same ISO week but forbid multiple reports on the same date.
-- Change:
--  - Drop unique constraint on (report_week, version)
--  - Add unique index on (published_at::date)

-- Drop previous unique constraint (name from earlier errors/logs)
alter table weekly_reports
  drop constraint if exists weekly_reports_report_week_version_key;

-- Add published_on column (UTC date derived from published_at)
alter table weekly_reports
  add column if not exists published_on date;

-- Backfill published_on for existing rows (UTC date)
update weekly_reports
  set published_on = (published_at at time zone 'UTC')::date
  where published_on is null;

-- Enforce NOT NULL
alter table weekly_reports
  alter column published_on set not null;

-- Unique index on published_on (one report per calendar date)
create unique index if not exists uniq_weekly_reports_published_on
  on weekly_reports (published_on);

comment on index uniq_weekly_reports_published_on is
  'Ensures only one report per calendar date is allowed (UTC).';

-- Trigger to keep published_on in sync with published_at
create or replace function set_published_on()
returns trigger
language plpgsql
as $$
begin
  new.published_on := (new.published_at at time zone 'UTC')::date;
  return new;
end;
$$;

drop trigger if exists trg_set_published_on on weekly_reports;
create trigger trg_set_published_on
  before insert or update of published_at
  on weekly_reports
  for each row
  execute function set_published_on();


