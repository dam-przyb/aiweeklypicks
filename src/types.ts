import type { Tables, TablesInsert, TablesUpdate, Enums, Json } from "./db/database.types";

// Primitive aliases for clarity across the app
export type UUID = string;
export type ISODateString = string;

// Common enums derived directly from the database definition to guarantee consistency
export type Side = Enums<"side_enum">; // "long" | "short"
export type ImportStatus = Enums<"import_status_enum">; // "success" | "failed"

// Generic pagination envelope used by many GET endpoints
export interface Paginated<TItem> {
  items: TItem[];
  page: number;
  page_size: number;
  total_items: number;
  total_pages: number;
}

export type SortOrder = "asc" | "desc";

// =============================
// Entities (typed from database)
// =============================

export type WeeklyReportEntity = Tables<"weekly_reports">;
export type StockPickEntity = Tables<"stock_picks">;
export type ImportAuditEntity = Tables<"imports_audit">;
export type ProfileEntity = Tables<"profiles">;
export type EventEntity = Tables<"events">;
export type StaffNetworkEntity = Tables<"staff_networks">;
export type PicksHistoryEntity = Tables<"picks_history">; // View

// =============================
// DTOs: Weekly Reports
// =============================

export type ReportListItemDTO = Pick<
  WeeklyReportEntity,
  "report_id" | "slug" | "report_week" | "published_at" | "version" | "title" | "summary" | "created_at"
>;

export type ReportDTO = ReportListItemDTO;

export type ReportsListResponseDTO = Paginated<ReportListItemDTO>;

// =============================
// DTOs: Stock Picks
// =============================

export type StockPickDTO = Pick<
  StockPickEntity,
  "pick_id" | "report_id" | "ticker" | "exchange" | "side" | "target_change_pct" | "rationale" | "created_at"
>;

export interface ReportWithPicksDTO {
  report: ReportDTO;
  picks: StockPickDTO[];
}

// =============================
// DTOs: Picks History (historical view)
// =============================

export type PicksHistoryItemDTO = Pick<
  PicksHistoryEntity,
  "published_at" | "report_week" | "ticker" | "exchange" | "side" | "target_change_pct" | "report_id"
>;

export type PicksListResponseDTO = Paginated<PicksHistoryItemDTO>;

// =============================
// DTOs: Admin - Imports
// =============================

export type ImportsAuditDTO = Pick<
  ImportAuditEntity,
  | "import_id"
  | "uploaded_by_user_id"
  | "filename"
  | "source_checksum"
  | "schema_version"
  | "status"
  | "error_message"
  | "started_at"
  | "finished_at"
>;

export type AdminImportsListResponseDTO = Paginated<ImportsAuditDTO>;

// Extended DTO for import detail view with optional report linkage
export type ImportAuditDetailDTO = ImportsAuditDTO & {
  report_id?: UUID;
  report_slug?: string;
};

// Command model for JSON upload variant
export interface AdminImportJsonCommand {
  filename: string;
  payload: Json;
}

export interface AdminImportSuccessResponse {
  import_id: UUID;
  status: Extract<ImportStatus, "success">;
  report_id: UUID;
  report_slug: string;
}

export interface AdminImportFailedResponse {
  import_id: UUID;
  status: Extract<ImportStatus, "failed">;
  error: string;
}

export type AdminImportResponse = AdminImportSuccessResponse | AdminImportFailedResponse;

// =============================
// DTOs: Admin - Profiles
// =============================

export type ProfileDTO = Pick<ProfileEntity, "user_id" | "is_admin" | "created_at">;
export type AdminProfilesListResponseDTO = Paginated<ProfileDTO>;

export interface AdminGrantRevokeParams {
  user_id: UUID;
}

export interface AdminGrantRevokeResponseDTO {
  user_id: UUID;
  is_admin: boolean;
}

// =============================
// DTOs: Events
// =============================

// Narrow input set for public ingestion while database stores a broader string union
export type PublicEventType = "registration_complete" | "login" | "report_view" | "table_view";

export interface PostEventCommand {
  event_type: PublicEventType;
  // Required for "report_view" and must be >= 10 (validated at runtime)
  dwell_seconds?: number;
  report_id?: UUID;
  metadata?: Json;
}

export interface PostEventAcceptedDTO {
  event_id: UUID;
  accepted: true;
}

export type AdminEventDTO = Pick<
  EventEntity,
  | "event_id"
  | "user_id"
  | "event_type"
  | "occurred_at"
  | "user_agent"
  | "ip_hash"
  | "dwell_seconds"
  | "metadata"
  | "is_staff_ip"
  | "is_bot"
  | "report_id"
>;

export type AdminEventsListResponseDTO = Paginated<AdminEventDTO>;

// =============================
// DTOs: Admin - Staff Networks
// =============================

// The database stores network as unknown; API expresses this as a CIDR string.
// We narrow the field for DTOs while keeping linkage to the entity via Pick and override.
export type StaffNetworkDTO = {
  network: string;
} & Pick<StaffNetworkEntity, "label" | "created_at">;

export type StaffNetworksListResponseDTO = Paginated<StaffNetworkDTO>;

export interface CreateStaffNetworkCommand {
  network: string; // CIDR
  label: string;
}

export interface DeleteStaffNetworkParams {
  network: string; // URL-encoded CIDR in path
}

// =============================
// DTOs: Auth (REST facades)
// =============================

export interface RegisterCommand {
  email: string;
  password: string;
}

export interface RegisterResponseDTO {
  user_id: UUID;
}

export interface LoginCommand {
  email: string;
  password: string;
}

export interface LoginResponseDTO {
  access_token: string;
  refresh_token: string;
  user_id: UUID;
}

// Logout has no body and returns 204; define an empty command for symmetry
export type LogoutCommand = Record<never, never>;

// =============================
// DTOs: Health
// =============================

export interface HealthDTO {
  status: "ok";
}

// =============================
// Request Query DTOs (for handlers)
// =============================

export interface ReportsListQuery {
  page?: number;
  page_size?: number;
  sort?: "published_at" | "report_week" | "title";
  order?: SortOrder;
  week?: string; // ISO week e.g., "2025-W42"
  version?: string;
  published_before?: ISODateString;
  published_after?: ISODateString;
}

export interface PicksListQuery {
  page?: number;
  page_size?: number;
  sort?: "published_at" | "ticker" | "exchange" | "side" | "target_change_pct";
  order?: SortOrder;
  ticker?: string;
  exchange?: string;
  side?: Side;
  date_before?: ISODateString;
  date_after?: ISODateString;
}

export interface AdminImportsListQuery {
  page?: number;
  page_size?: number;
  status?: ImportStatus;
  started_before?: ISODateString;
  started_after?: ISODateString;
  uploader?: UUID; // uploaded_by_user_id
}

export interface AdminEventsListQuery {
  page?: number;
  page_size?: number;
  event_type?: string | string[];
  occurred_before?: ISODateString;
  occurred_after?: ISODateString;
  report_id?: UUID;
  user_id?: UUID;
}

export interface AdminProfilesListQuery {
  page?: number;
  page_size?: number;
  is_admin?: boolean;
}

export interface StaffNetworksListQuery {
  page?: number;
  page_size?: number;
}

// =============================
// Request Path Param DTOs
// =============================

export interface ReportSlugParams {
  slug: string;
}
export interface ReportIdParams {
  report_id: UUID;
}
export interface AdminImportIdParams {
  import_id: UUID;
}

// =============================
// View Models (Frontend-only)
// =============================

export interface ReportListItemViewModel {
  reportId: string; // UUID
  slug: string;
  title: string;
  reportWeek: string; // e.g., 2025-W42
  publishedAtIso: string; // UTC ISO YYYY-MM-DD
  publishedAtLocalTooltip: string; // localized datetime string for tooltip
  version: string;
  summary: string;
}

export interface SortStateViewModel {
  sort: "published_at" | "report_week" | "title";
  order: "asc" | "desc";
}

export type URLSearchParamsLike = Record<string, string | string[] | undefined>;

// View models for report detail page (/reports/[slug])
export interface ReportMetaVM {
  reportId: UUID;
  slug: string;
  title: string;
  summary: string;
  reportWeek: string; // e.g., 2025-W42
  publishedAtUtc: string; // ISO
  publishedDateDisplay: string; // YYYY-MM-DD
  publishedAtLocalTooltip: string; // localized datetime string for tooltip
  version: string;
}

export interface PickItemVM {
  pickId: UUID;
  ticker: string;
  exchange: string;
  side: "long" | "short";
  targetChangePct: number; // raw
  targetChangePctDisplay: string; // e.g., +12.34%
  rationale: string;
}

export interface ReportWithPicksVM {
  report: ReportMetaVM;
  picks: PickItemVM[];
}

// View models for picks history table page (/picks)
export interface PicksRowVM {
  publishedDateISO: string; // YYYY-MM-DD formatted
  reportWeek: string;
  ticker: string;
  exchange: string;
  side: Side;
  targetChangePctDisplay: string; // e.g., +12.34%
  reportLinkHref: string; // link to report detail page
  reportId: string; // UUID for future use
}

export interface ErrorViewModel {
  code?: string;
  message: string;
}
