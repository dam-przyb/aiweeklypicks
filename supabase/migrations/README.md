# Database Migrations

This directory contains all database migrations for the AI Weekly Picks project.

## Migration Order

Migrations are executed in chronological order based on their timestamp prefix:

1. `20251029120000_setup_extensions_domains_enums.sql` - Extensions, domains, and enums
2. `20251029120100_create_core_tables.sql` - Core tables (weekly_reports, stock_picks, profiles)
3. `20251029120200_create_audit_events_tables.sql` - Audit and events tables (partitioned)
4. `20251029120300_create_indexes.sql` - Performance indexes
5. `20251029120400_setup_rls_policies.sql` - Row Level Security policies
6. `20251029120500_create_materialized_views_functions.sql` - Views, functions, triggers
7. `20251029120600_add_picks_history_rls_policy.sql` - Additional RLS for picks_history
8. **`20251029120700_create_post_event_rpc.sql`** - RPC for event ingestion (NEW)
9. **`20251029120701_update_events_rls_for_anon.sql`** - Update events RLS for anonymous users (NEW)

## Recently Added (POST /api/events Implementation)

### Migration 20251029120700: Create POST Event RPC

**Purpose:** Creates the `admin_post_event` SECURITY DEFINER function for secure event ingestion.

**What it does:**
- Creates RPC function that accepts event data from API endpoint
- Uses `auth.uid()` to automatically associate authenticated users
- Returns `event_id` as JSON
- Grants execute permissions to both `authenticated` and `anon` roles

**Dependencies:**
- `events` table (created in 20251029120200)
- `weekly_reports` table (for FK constraint on report_id)

### Migration 20251029120701: Update Events RLS for Anonymous Users

**Purpose:** Updates RLS policies to allow anonymous event tracking.

**What it does:**
- Drops old `events_insert_service` policy
- Creates new `events_insert_via_rpc` policy allowing both authenticated and anon users
- INSERT operations still controlled via SECURITY DEFINER RPC

## Applying Migrations

### Local Development

If you have a local Supabase instance:

```bash
npx supabase db reset  # Reset and apply all migrations
# or
npx supabase db push   # Apply new migrations only
```

### Remote/Production

To apply to your hosted Supabase project:

```bash
# Link to your project (first time only)
npx supabase link --project-ref your-project-ref

# Push migrations
npx supabase db push --remote
```

### Manual Application

If you need to apply migrations manually via Supabase Dashboard:

1. Go to **SQL Editor** in your Supabase Dashboard
2. Copy the contents of each migration file
3. Execute them in order
4. Verify success by checking the schema browser

## Rollback (if needed)

There are no automatic rollback scripts. To rollback:

1. Identify the changes made by the migration
2. Write and execute appropriate DROP/ALTER statements
3. Test thoroughly before applying to production

For the POST /api/events migrations:

```sql
-- Rollback 20251029120701
DROP POLICY IF EXISTS "events_insert_via_rpc" ON events;
CREATE POLICY "events_insert_service"
  ON events FOR insert TO authenticated
  WITH CHECK (true);

-- Rollback 20251029120700
DROP FUNCTION IF EXISTS admin_post_event(text, numeric, uuid, jsonb, text, text);
```

## Verifying Migrations

Check applied migrations:

```sql
SELECT * FROM supabase_migrations.schema_migrations 
ORDER BY version DESC;
```

Check the events RPC exists:

```sql
SELECT 
  proname as function_name,
  proargnames as arguments,
  prosecdef as is_security_definer
FROM pg_proc 
WHERE proname = 'admin_post_event';
```

Expected result:
- `function_name`: admin_post_event
- `arguments`: {p_event_type, p_dwell_seconds, p_report_id, p_metadata, p_user_agent, p_ip_hash}
- `is_security_definer`: true

## Creating New Migrations

To create a new migration:

```bash
# Generate a timestamp-based migration file
npx supabase migration new your_migration_name

# This creates: supabase/migrations/YYYYMMDDHHMMSS_your_migration_name.sql
```

## Best Practices

1. **Test locally first** - Always test migrations on local Supabase before production
2. **Backup before migration** - Take a database backup before applying to production
3. **Review carefully** - Review all SQL statements for correctness
4. **Check dependencies** - Ensure all dependent objects exist
5. **Version control** - Commit migrations to git before applying
6. **Document changes** - Add comments explaining what the migration does
7. **One purpose per migration** - Keep migrations focused and atomic

## Maintenance Tasks

### Events Table Partitioning

The `events` table is partitioned by month. Create new partitions proactively:

```sql
-- Create partition for next month (example: February 2026)
CREATE TABLE events_2026_02 PARTITION OF events
  FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');
```

### Data Retention

Archive or drop old partitions according to your retention policy:

```sql
-- Example: Archive events older than 12 months
-- First, export if needed, then:
DROP TABLE events_2024_11;
```

## Troubleshooting

### Issue: Permission Denied

**Cause:** User lacks privileges to execute migration.

**Solution:** Ensure you're connected with a role that has `CREATE` and `ALTER` privileges.

### Issue: Object Already Exists

**Cause:** Migration was partially applied or run multiple times.

**Solution:** Check if objects exist before creating them, or use `CREATE OR REPLACE` for functions.

### Issue: Foreign Key Constraint Violation

**Cause:** Migration tries to create FK to non-existent table/column.

**Solution:** Ensure all dependent tables are created in earlier migrations.

## Schema Version

Current schema version after all migrations: **20251029120701**

Last updated: 2025-11-16

