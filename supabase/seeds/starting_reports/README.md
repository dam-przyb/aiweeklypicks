Seed folder for initial weekly reports

Place JSON files here named with the required pattern:

- YYYY-MM-DDreport.json (e.g., 2025-11-02report.json)

Each file should contain a single report payload shaped like:

```json
{
  "report_id": "e7c8d8c0-2f5d-4c0a-9a79-9d86d7a2a001",
  "published_at": "2025-11-02T00:00:00Z",
  "version": "v1",
  "source_checksum": "optional-sha256",
  "title": "AI Weekly Picks — 2025-11-02",
  "summary": "Krótki opis raportu.",
  "picks": [
    {
      "pick_id": "1f8d4b56-3a65-4c41-bf1f-1c41a8b6b001",
      "ticker": "AAPL",
      "exchange": "NASDAQ",
      "side": "long",
      "target_change_pct": 12.5,
      "rationale": "Powody inwestycyjne…"
    }
  ]
}
```

Import options:
- Use the admin API: POST /api/admin/imports with either multipart/form-data (file) or application/json:
  { "filename": "YYYY-MM-DDreport.json", "payload": <object> }
- Or run the seed script described in the project root README.


