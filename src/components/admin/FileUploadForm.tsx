import { useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface UploadState {
  file: File | null;
  uploading: boolean;
  progress: number;
  error: string | null;
  success: string | null;
}

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB in bytes
const FILENAME_REGEX = /^\d{4}-\d{2}-\d{2}report\.json$/;

export default function FileUploadForm() {
  const [state, setState] = useState<UploadState>({
    file: null,
    uploading: false,
    progress: 0,
    error: null,
    success: null,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = useCallback((file: File): string | null => {
    // Check file extension
    if (!file.name.endsWith(".json")) {
      return "File must have a .json extension";
    }

    // Check filename format
    if (!FILENAME_REGEX.test(file.name)) {
      return "Filename must match format: YYYY-MM-DDreport.json (e.g., 2025-11-25report.json)";
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return `File size must be less than ${MAX_FILE_SIZE / (1024 * 1024)}MB`;
    }

    return null;
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) {
        setState((prev) => ({ ...prev, file: null, error: null, success: null }));
        return;
      }

      const file = files[0];
      const error = validateFile(file);

      if (error) {
        setState((prev) => ({ ...prev, file: null, error, success: null }));
        return;
      }

      setState((prev) => ({ ...prev, file, error: null, success: null }));
    },
    [validateFile]
  );

  const handleUpload = useCallback(async () => {
    if (!state.file) {
      setState((prev) => ({ ...prev, error: "Please select a file to upload" }));
      return;
    }

    // Re-validate before upload
    const validationError = validateFile(state.file);
    if (validationError) {
      setState((prev) => ({ ...prev, error: validationError }));
      return;
    }

    setState((prev) => ({ ...prev, uploading: true, progress: 0, error: null, success: null }));

    try {
      // Create FormData
      const formData = new FormData();
      formData.append("file", state.file);

      // Upload with progress simulation (XHR doesn't give real progress for uploads in most cases)
      const response = await fetch("/api/admin/imports", {
        method: "POST",
        body: formData,
        credentials: "include", // Include cookies for auth
      });

      const result = await response.json();

      if (!response.ok) {
        // Map API errors to user-friendly messages
        let errorMessage = result.message || "Upload failed";

        if (response.status === 409) {
          errorMessage = `This report has already been imported. ${result.message || ""}`;
        } else if (response.status === 413) {
          errorMessage = `File is too large. ${result.message || ""}`;
        } else if (response.status === 422) {
          errorMessage = `Invalid report format. ${result.message || ""}`;
        } else if (response.status === 401 || response.status === 403) {
          errorMessage = "You don't have permission to upload reports.";
        }

        throw new Error(errorMessage);
      }

      // Success
      const successMessage =
        result.status === "success"
          ? `Successfully imported report: ${state.file.name}`
          : `Upload completed with warnings: ${result.error || ""}`;

      setState({
        file: null,
        uploading: false,
        progress: 100,
        error: null,
        success: successMessage,
      });

      // Clear the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Show link to report if successful
      if (result.status === "success" && result.report_slug) {
        // Reload page after 2 seconds to show new import in table
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        uploading: false,
        progress: 0,
        error: error instanceof Error ? error.message : "An unexpected error occurred",
      }));
    }
  }, [state.file, validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        const file = files[0];
        const error = validateFile(file);

        if (error) {
          setState((prev) => ({ ...prev, file: null, error, success: null }));
          return;
        }

        setState((prev) => ({ ...prev, file, error: null, success: null }));

        // Update file input
        if (fileInputRef.current) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInputRef.current.files = dataTransfer.files;
        }
      }
    },
    [validateFile]
  );

  return (
    <div className="space-y-4">
      {/* Error Alert */}
      {state.error && (
        <div
          role="alert"
          className="bg-red-50 border-l-4 border-red-600 rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-red-600"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-900 mb-1">Upload Error</h3>
              <p className="text-sm text-red-800">{state.error}</p>
            </div>
            <button
              onClick={() => setState((prev) => ({ ...prev, error: null }))}
              className="flex-shrink-0 text-red-700 hover:text-red-900 transition-colors"
              aria-label="Dismiss error"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {state.success && (
        <div
          role="alert"
          className="bg-green-50 border-l-4 border-green-600 rounded-lg p-4 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg
                className="w-5 h-5 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-green-900 mb-1">Upload Successful</h3>
              <p className="text-sm text-green-800">{state.success}</p>
              <p className="text-xs text-green-700 mt-1">Page will refresh to show the new import...</p>
            </div>
            <button
              onClick={() => setState((prev) => ({ ...prev, success: null }))}
              className="flex-shrink-0 text-green-700 hover:text-green-900 transition-colors"
              aria-label="Dismiss success message"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Dropzone */}
      <div
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-lg p-6 transition-colors ${
          state.file
            ? "border-green-400 bg-green-50"
            : "border-gray-300 bg-gray-50 hover:border-gray-400"
        }`}
      >
        <div className="space-y-4">
          <div className="flex flex-col items-center justify-center gap-2">
            <svg
              className="w-12 h-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
            <div className="text-center">
              <Label htmlFor="file-upload" className="cursor-pointer">
                <span className="text-blue-600 hover:text-blue-700 font-medium">
                  Choose a file
                </span>
                <span className="text-gray-600"> or drag and drop</span>
              </Label>
              <p className="text-xs text-gray-500 mt-1">
                JSON file, max 2MB, format: YYYY-MM-DDreport.json
              </p>
            </div>
          </div>

          <Input
            ref={fileInputRef}
            id="file-upload"
            type="file"
            accept=".json"
            onChange={handleFileChange}
            disabled={state.uploading}
            className="hidden"
            aria-describedby="file-upload-description"
          />

          {/* Selected File Display */}
          {state.file && (
            <div className="flex items-center justify-between p-3 bg-white border border-green-300 rounded-md">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">{state.file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(state.file.size / 1024).toFixed(2)} KB
                  </p>
                </div>
              </div>
              {!state.uploading && (
                <button
                  onClick={() => {
                    setState((prev) => ({ ...prev, file: null }));
                    if (fileInputRef.current) {
                      fileInputRef.current.value = "";
                    }
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label="Remove file"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      {state.uploading && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm text-gray-700">
            <span>Uploading...</span>
            <span>{state.progress}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${state.progress}%` }}
              role="progressbar"
              aria-valuenow={state.progress}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
        </div>
      )}

      {/* Upload Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleUpload}
          disabled={!state.file || state.uploading}
          className="px-6"
        >
          {state.uploading ? (
            <>
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Uploading...
            </>
          ) : (
            "Upload Report"
          )}
        </Button>
      </div>

      {/* Accessibility description */}
      <p id="file-upload-description" className="sr-only">
        Upload a JSON file with filename format YYYY-MM-DDreport.json, maximum size 2MB
      </p>
    </div>
  );
}

