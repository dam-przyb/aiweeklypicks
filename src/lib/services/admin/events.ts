import type { SupabaseClient } from '../../../db/supabase.client';
import type {
  AdminEventsListQuery,
  AdminEventsListResponseDTO,
  AdminEventDTO,
} from '../../../types';

/**
 * Columns to select from events table for admin view
 * Includes sensitive fields like ip_hash (hashed, not raw IP)
 */
const ADMIN_EVENT_COLUMNS = [
  'event_id',
  'user_id',
  'event_type',
  'occurred_at',
  'user_agent',
  'ip_hash',
  'dwell_seconds',
  'metadata',
  'is_staff_ip',
  'is_bot',
  'report_id',
] as const;

/**
 * Error class for database operation failures
 */
export class DatabaseError extends Error {
  code = 'server_error' as const;

  constructor(message = 'Database operation failed', public cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Lists events with admin-level access and filtering
 * Applies pagination, ordering, and various filters
 * 
 * @param supabase - Authenticated Supabase client (must be admin user)
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated list of events with full admin fields
 * @throws {DatabaseError} When database query fails
 * 
 * @example
 * ```ts
 * const result = await listAdminEvents(supabase, {
 *   page: 1,
 *   page_size: 20,
 *   event_type: ['report_view', 'table_view'],
 *   occurred_after: '2025-01-01T00:00:00Z',
 * });
 * ```
 */
export async function listAdminEvents(
  supabase: SupabaseClient<Database>,
  query: AdminEventsListQuery & { event_type?: string | string[] }
): Promise<AdminEventsListResponseDTO> {
  const {
    page = 1,
    page_size = 20,
    occurred_before,
    occurred_after,
    report_id,
    user_id,
  } = query;

  // Calculate pagination range
  const from = (page - 1) * page_size;
  const to = from + page_size - 1;

  try {
    // Build base query with count
    let req = supabase
      .from('events')
      .select(ADMIN_EVENT_COLUMNS.join(','), { count: 'exact' })
      .order('occurred_at', { ascending: false })
      .range(from, to);

    // Apply event_type filter if provided
    // Normalize to array and filter if present
    const eventTypes = Array.isArray(query.event_type)
      ? query.event_type
      : typeof query.event_type === 'string'
        ? [query.event_type]
        : undefined;

    if (eventTypes && eventTypes.length > 0) {
      req = req.in('event_type', eventTypes);
    }

    // Apply time range filters
    if (occurred_after) {
      req = req.gte('occurred_at', occurred_after);
    }
    if (occurred_before) {
      req = req.lte('occurred_at', occurred_before);
    }

    // Apply entity filters
    if (report_id) {
      req = req.eq('report_id', report_id);
    }
    if (user_id) {
      req = req.eq('user_id', user_id);
    }

    // Execute query
    const { data, count, error } = await req;

    if (error) {
      throw new DatabaseError('Failed to query events', error);
    }

    // Build paginated response
    const items = (data ?? []) as unknown as AdminEventDTO[];
    const total_items = count ?? 0;
    const total_pages = Math.max(1, Math.ceil(total_items / page_size));

    return {
      items,
      page,
      page_size,
      total_items,
      total_pages,
    };
  } catch (error) {
    // Re-throw DatabaseError as-is
    if (error instanceof DatabaseError) {
      throw error;
    }

    // Wrap unexpected errors
    throw new DatabaseError('Unexpected error querying events', error);
  }
}

