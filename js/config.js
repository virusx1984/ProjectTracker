// --- Configuration & Constants ---
const CONFIG = {
    DEFAULT_PIXELS_PER_DAY: 6,
    RENDER_MONTHS: 12, // Default fallback
    TRACKER_START_DATE: new Date(), // Default fallback (will be overridden)
    CURRENT_DATE: new Date()
};

// Predefined Colors for Dropdown
const PREDEFINED_COLORS = [
    { name: "Blue", code: "#0d6efd" },
    { name: "Green", code: "#198754" },
    { name: "Purple", code: "#6f42c1" },
    { name: "Orange", code: "#fd7e14" },
    { name: "Teal", code: "#20c997" },
    { name: "Red", code: "#dc3545" },
    { name: "Gray", code: "#6c757d" }
];

// --- Global State Variables ---
// These are accessed and modified by other files
let pixelsPerDay = CONFIG.DEFAULT_PIXELS_PER_DAY;
let currentFilter = 'ALL'; 
let currentRevisedData = null; 
let currentProcessedStats = null; 

// --- Data Source (Source of Truth) ---
// [UPDATED STRUCTURE]
// 1. 'meta' holds title and version info
// 2. 'data' holds the array of groups (previously named 'groups')
var rawTrackerData = {
    "meta": {
        "title": "Fab 2 Expansion - Q1 2026 Status Update",
        "last_updated": "2026-01-02", 
        "version": "1.0"
    },
    "data": [
      {
        "group_id": "GRP-LITHO",
        "group_name": "Lithography (Critical Path)",
        "is_expanded": true,
        "projects": [
          {
            "project_id": "LIT-205",
            "project_name": "EUV Scanner (ASML-NXE)",
            "description": "Main exposure tool. Delayed due to lens supply issue.",
            "start_date": "2025-09-01",
            "milestones": [
              {
                "name": "PO Issued",
                "description": "Long lead time item",
                "status_progress": 1.0,
                "planned_end": "2025-09-15",
                "actual_completion_date": "2025-09-15",
                "demand_due_date": "2025-09-15",
                "color": "#fd7e14"
              },
              {
                "name": "Production",
                "description": "Assembly & Calibration",
                "status_progress": 0.95,
                "planned_end": "2025-12-25",
                "actual_completion_date": null,
                "demand_due_date": "2025-12-20",
                "color": "#6610f2"
              },
              {
                "name": "Shipping",
                "description": "Requires special air charter",
                "status_progress": 0.0,
                "planned_end": "2026-01-15",
                "actual_completion_date": null,
                "demand_due_date": "2026-01-10",
                "color": "#6f42c1"
              },
              {
                "name": "Install",
                "description": "Cleanroom move-in",
                "status_progress": 0.0,
                "planned_end": "2026-02-28",
                "actual_completion_date": null,
                "demand_due_date": "2026-02-25",
                "color": "#20c997"
              }
            ]
          }
        ]
      },
      {
        "group_id": "GRP-ETCH",
        "group_name": "Dry Etch Department",
        "is_expanded": true,
        "projects": [
          {
            "project_id": "ETCH-003",
            "project_name": "Conductor Etch (LAM-Flex)",
            "description": "Standard capacity expansion.",
            "start_date": "2025-10-15",
            "milestones": [
              {
                "name": "PO Process",
                "description": "Order confirmed",
                "status_progress": 1.0,
                "planned_end": "2025-11-10",
                "actual_completion_date": "2025-11-08",
                "demand_due_date": "2025-11-10",
                "color": "#fd7e14"
              },
              {
                "name": "Production",
                "description": "On track for Jan delivery",
                "status_progress": 0.65,
                "planned_end": "2026-01-20",
                "actual_completion_date": null,
                "demand_due_date": "2026-01-20",
                "color": "#6610f2"
              },
              {
                "name": "Shipping",
                "description": "Sea freight",
                "status_progress": 0.0,
                "planned_end": "2026-02-15",
                "actual_completion_date": null,
                "demand_due_date": "2026-02-15",
                "color": "#6f42c1"
              },
              {
                "name": "Qual.",
                "description": "Process qualification",
                "status_progress": 0.0,
                "planned_end": "2026-03-30",
                "actual_completion_date": null,
                "demand_due_date": "2026-03-30",
                "color": "#198754"
              }
            ]
          }
        ]
      }
    ]
};