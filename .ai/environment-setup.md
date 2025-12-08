# Environment Setup Guide

## Required Environment Variables

The application requires the following environment variables to be configured. Create a `.env` file in the project root with these values:

### Supabase Configuration

```bash
# Supabase Project URL
# Get this from: Supabase Dashboard > Settings > API > Project URL
SUPABASE_URL=https://your-project-ref.supabase.co

# Supabase Anon/Public Key
# Get this from: Supabase Dashboard > Settings > API > Project API keys > anon/public
SUPABASE_KEY=your-anon-public-key-here
```

## Setup Instructions

1. **Create `.env` file**:

   ```bash
   cp .env.example .env
   # Or create manually
   ```

2. **Get Supabase credentials**:
   - Go to [Supabase Dashboard](https://app.supabase.com)
   - Select your project
   - Navigate to Settings > API
   - Copy the Project URL to `SUPABASE_URL`
   - Copy the anon/public key to `SUPABASE_KEY`

3. **Run database migrations**:

   ```bash
   npx supabase db push
   # Or if using Supabase CLI linked to your project:
   npx supabase db reset
   ```

4. **Start development server**:
   ```bash
   npm run dev
   ```

## Security Notes

- **Never commit `.env` files to version control** - they are listed in `.gitignore`
- The `SUPABASE_KEY` is the anon/public key, which is safe to use in client-side code
- Row Level Security (RLS) policies protect sensitive data even with the public key
- For production, ensure `SUPABASE_URL` points to your production Supabase project

## Database Setup

The application requires the following migrations to be applied:

1. `20251029120000_setup_extensions_domains_enums.sql` - Core extensions and enums
2. `20251029120100_create_core_tables.sql` - Main tables (weekly_reports, stock_picks, etc.)
3. `20251029120200_create_audit_events_tables.sql` - Audit and events tables
4. `20251029120300_create_indexes.sql` - Performance indexes
5. `20251029120400_setup_rls_policies.sql` - Row Level Security policies
6. `20251029120500_create_materialized_views_functions.sql` - Materialized views and functions
7. `20251029120600_add_picks_history_rls_policy.sql` - RLS policy for picks_history MV

All migrations are located in `supabase/migrations/` and will be applied in order when running `npx supabase db push`.

## Verification

After setup, verify the API is working:

```bash
# Check health endpoint
curl http://localhost:4321/api/health

# Test picks endpoint (should return empty or paginated data)
curl http://localhost:4321/api/picks

# Test with query parameters
curl "http://localhost:4321/api/picks?page=1&page_size=10&sort=published_at&order=desc"
```

## Troubleshooting

### "relation picks_history does not exist"

- The materialized view hasn't been created yet
- Run: `npx supabase db push` to apply all migrations
- The API will automatically fall back to joining tables if the MV is missing

### "SUPABASE_URL is not defined"

- Ensure `.env` file exists in project root
- Verify environment variables are set correctly
- Restart the dev server after changing `.env`

### Rate limiting in development

- Rate limits are applied per IP address (60 req/min for public endpoints)
- In development, all requests may appear from the same IP ('unknown')
- To reset rate limits during development, restart the server
