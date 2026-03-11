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
// Initialize as null to trigger the Welcome Canvas (Zero State)
var rawTrackerData = null;