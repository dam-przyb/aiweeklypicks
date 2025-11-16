import type { PicksListQuery, PicksListResponseDTO, PicksHistoryItemDTO } from '@/types';
import type { SupabaseClient } from '@/db/supabase.client';

// Column names for the picks_history view
const COLUMNS = [
	'published_at',
	'report_week',
	'ticker',
	'exchange',
	'side',
	'target_change_pct',
	'report_id',
] as const;

/**
 * Applies common filters to a Supabase query builder.
 * 
 * @param request - Supabase query builder
 * @param q - Query parameters with filter values
 * @param fallbackJoin - Whether this is a fallback join query (affects date filter application)
 * @returns Modified query builder with filters applied
 */
function applyCommonFilters(request: any, q: PicksListQuery, fallbackJoin = false) {
	// Case-insensitive ticker filter
	if (q.ticker) {
		request = request.ilike('ticker', q.ticker);
	}
	
	// Case-insensitive exchange filter
	if (q.exchange) {
		request = request.ilike('exchange', q.exchange);
	}
	
	// Exact side match (enum)
	if (q.side) {
		request = request.eq('side', q.side);
	}
	
	// Date range filters
	// In fallback mode, published_at is in the weekly_reports foreign table
	if (q.date_after) {
		request = fallbackJoin 
			? request.gte('published_at', q.date_after, { foreignTable: 'weekly_reports' })
			: request.gte('published_at', q.date_after);
	}
	
	if (q.date_before) {
		request = fallbackJoin
			? request.lte('published_at', q.date_before, { foreignTable: 'weekly_reports' })
			: request.lte('published_at', q.date_before);
	}
	
	return request;
}

/**
 * Lists stock picks from history with pagination, sorting, and filtering.
 * Prefers the picks_history materialized view for performance.
 * Falls back to joining stock_picks with weekly_reports if the MV doesn't exist.
 * 
 * @param supabase - Supabase client from locals
 * @param query - Validated query parameters
 * @returns Paginated response with picks and metadata
 * @throws Error if unexpected database errors occur
 */
export async function listPicks(
	supabase: SupabaseClient,
	query: PicksListQuery
): Promise<PicksListResponseDTO> {
	const { page = 1, page_size = 20, sort = 'published_at', order = 'desc' } = query;
	const from = (page - 1) * page_size;
	const to = from + page_size - 1;

	try {
		// Try materialized view first (preferred for performance)
		let req = supabase
			.from('picks_history')
			.select(COLUMNS.join(','), { count: 'exact' });

		req = applyCommonFilters(req, query, false);
		req = req.order(sort, { ascending: order === 'asc' }).range(from, to);

		const { data, count, error } = await req;
		
		if (error) {
			throw error;
		}

		const items = (data ?? []) as unknown as PicksHistoryItemDTO[];
		const total_items = count ?? 0;
		const total_pages = Math.max(1, Math.ceil(total_items / page_size));
		
		return { items, page, page_size, total_items, total_pages };
	} catch (e: any) {
		// Check if the error indicates the materialized view doesn't exist
		const relationMissing = typeof e?.message === 'string' && 
			/relation .* does not exist|not found/i.test(e.message);
		
		if (!relationMissing) {
			// Unexpected error - propagate it
			throw e;
		}

		// Fallback: join stock_picks with weekly_reports
		const select = [
			'ticker',
			'exchange',
			'side',
			'target_change_pct',
			'report_id',
			'weekly_reports(published_at,report_week)'
		].join(',');

		let req = supabase
			.from('stock_picks')
			.select(select, { count: 'exact' });

		req = applyCommonFilters(req, query, true);

		// Apply sorting
		// published_at lives in weekly_reports foreign table in fallback mode
		if (sort === 'published_at') {
			req = req.order('published_at', {
				ascending: order === 'asc',
				foreignTable: 'weekly_reports'
			});
		} else {
			req = req.order(sort, { ascending: order === 'asc' });
		}

		req = req.range(from, to);

		const { data, count, error } = await req;
		
		if (error) {
			throw error;
		}

		// Map joined data to PicksHistoryItemDTO format
		const mapped = (data ?? []).map((row: any) => ({
			published_at: row.weekly_reports?.published_at,
			report_week: row.weekly_reports?.report_week,
			ticker: row.ticker,
			exchange: row.exchange,
			side: row.side,
			target_change_pct: row.target_change_pct,
			report_id: row.report_id,
		})) as PicksHistoryItemDTO[];

		const total_items = count ?? 0;
		const total_pages = Math.max(1, Math.ceil(total_items / page_size));
		
		return { items: mapped, page, page_size, total_items, total_pages };
	}
}

