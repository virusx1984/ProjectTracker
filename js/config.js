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
const rawTrackerData = {
    "tracker_title": "Enterprise IT Roadmap 2025 (Dashboard)",
    "groups": [
        {
            "group_id": "GRP-01",
            "group_name": "Digital Transformation",
            "is_expanded": true, 
            "projects": [
                {
                    "project_id": "PRJ-001",
                    "project_name": "E-Commerce Platform",
                    "description": "Key initiative for Q1 revenue growth.",
                    "start_date": "2025-01-05",
                    "milestones": [
                        { "name": "UI Design", "description": "Finalize Figma prototypes.", "status_progress": 1.0, "planned_end": "2025-02-15", "actual_completion_date": "2025-02-10", "demand_due_date": "2025-02-15", "color": "#0d6efd" },
                        { "name": "Frontend", "description": "React framework implementation.", "status_progress": 0.6, "planned_end": "2025-03-25", "actual_completion_date": null, "demand_due_date": "2025-03-25", "color": "#198754" },
                        { "name": "Backend", "description": "API development and DB setup.", "status_progress": 0.0, "planned_end": "2025-05-15", "actual_completion_date": null, "demand_due_date": "2025-05-01", "color": "#6f42c1" }
                    ]
                },
                {
                    "project_id": "PRJ-002",
                    "project_name": "Mobile App Launch",
                    "description": "iOS and Android MVP.",
                    "start_date": "2025-02-01",
                    "milestones": [
                        { "name": "Requirement", "description": "", "status_progress": 1.0, "planned_end": "2025-02-20", "actual_completion_date": "2025-02-20", "demand_due_date": "2025-02-25", "color": "#fd7e14" },
                        { "name": "Alpha Ver.", "description": "", "status_progress": 0.4, "planned_end": "2025-05-10", "actual_completion_date": null, "demand_due_date": "2025-05-10", "color": "#20c997" }
                    ]
                }
            ]
        },
        {
            "group_id": "GRP-02",
            "group_name": "Infrastructure Upgrade",
            "is_expanded": true,
            "projects": [
                {
                    "project_id": "PRJ-007",
                    "project_name": "Cloud Infra Setup",
                    "description": "Migration to AWS.",
                    "start_date": "2025-01-20",
                    "milestones": [
                        { "name": "AWS Setup", "description": "VPC and EC2 config.", "status_progress": 0.8, "planned_end": "2025-02-15", "actual_completion_date": null, "demand_due_date": "2025-02-15", "color": "#fd7e14" },
                        { "name": "K8s Config", "description": "", "status_progress": 0.0, "planned_end": "2025-04-05", "actual_completion_date": null, "demand_due_date": "2025-03-30", "color": "#6f42c1" }
                    ]
                }
            ]
        }
    ]
};