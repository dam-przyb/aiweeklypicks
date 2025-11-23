import type { SupabaseClient } from "../../db/supabase.client";
import type { Json } from "../../db/database.types";
import type { AdminImportResponse, AdminImportSuccessResponse, AdminImportFailedResponse } from "../../types";

/**
 * Calls the admin_import_report RPC to import a weekly report
 *
 * @param supabase - Authenticated Supabase client with admin privileges
 * @param payload - The report JSON payload to import
 * @param filename - The filename of the report (must match YYYY-MM-DDreport.json format)
 * @returns Import response with success or failure details
 * @throws Error if RPC call fails unexpectedly
 */
export async function adminImportReport(
  supabase: SupabaseClient<Database>,
  payload: Json,
  filename: string
): Promise<AdminImportResponse> {
  // Call the SECURITY DEFINER RPC function
  const { data, error } = await supabase.rpc("admin_import_report", {
    payload,
    filename,
  });

  // Handle RPC errors
  if (error) {
    throw new Error(`RPC call failed: ${error.message}`);
  }

  // Validate response structure
  if (!data) {
    throw new Error("RPC returned no data");
  }

  // Type guard to check if response is success
  if (isSuccessResponse(data)) {
    return {
      import_id: data.import_id,
      status: "success",
      report_id: data.report_id,
      report_slug: data.report_slug,
    } as AdminImportSuccessResponse;
  }

  // Otherwise, it's a failure response
  if (isFailedResponse(data)) {
    return {
      import_id: data.import_id,
      status: "failed",
      error: data.error,
    } as AdminImportFailedResponse;
  }

  // Unexpected response structure
  throw new Error("Unexpected RPC response structure");
}

/**
 * Type guard to check if RPC response indicates success
 */
function isSuccessResponse(data: any): data is {
  import_id: string;
  status: "success";
  report_id: string;
  report_slug: string;
} {
  return (
    data &&
    typeof data === "object" &&
    "import_id" in data &&
    "status" in data &&
    data.status === "success" &&
    "report_id" in data &&
    "report_slug" in data
  );
}

/**
 * Type guard to check if RPC response indicates failure
 */
function isFailedResponse(data: any): data is {
  import_id: string;
  status: "failed";
  error: string;
} {
  return (
    data &&
    typeof data === "object" &&
    "import_id" in data &&
    "status" in data &&
    data.status === "failed" &&
    "error" in data
  );
}
