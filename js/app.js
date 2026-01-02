// --- Application Entry Point ---

// Main Pipeline Runner
// Exposed globally so moduls.js can access it
function runPipeline() {
    // 1. Calculate Revised Dates (Logic derivation)
    // rawTrackerData now follows the new structure { meta: ..., data: ... }
    currentRevisedData = reviseProjectData(rawTrackerData);
    
    // 2. NEW: Auto-Scale Timeline based on revised dates
    // This updates CONFIG.TRACKER_START_DATE and CONFIG.RENDER_MONTHS dynamically
    calculateAutoBounds(currentRevisedData);

    // 3. Preprocess for Stats
    const result = preprocessData(currentRevisedData);
    currentProcessedStats = result.counts;
    
    // 4. Render
    renderDashboardStats(currentProcessedStats);
    renderTracker(currentRevisedData);
}

// Global Controls
// Global Controls
function initGlobalControls() {
    // Zoom Logic Update
    $('#btn-zoom-in').click(function () { 
        if (pixelsPerDay < 20) { 
            pixelsPerDay += 2; 
            renderTracker(currentRevisedData); 
        } 
    });

    // [MODIFIED] Allow zooming out further to trigger Quarter View
    $('#btn-zoom-out').click(function () { 
        if (pixelsPerDay > 2) { 
            pixelsPerDay -= 2; 
        } else if (pixelsPerDay > 0.5) {
            // Finer grain zoom when small to allow Quarter View (e.g. 1.0, 0.5)
            pixelsPerDay -= 0.5; 
        }
        renderTracker(currentRevisedData); 
    });

    $('#btn-zoom-reset').click(function () { 
        pixelsPerDay = CONFIG.DEFAULT_PIXELS_PER_DAY; 
        renderTracker(currentRevisedData); 
    });

    // Group Expansion (Use .data)
    $('#btn-expand-all').click(function () { 
        if (currentFilter === 'ALL' && currentRevisedData.data) { 
            currentRevisedData.data.forEach(g => g.is_expanded = true); 
            renderTracker(currentRevisedData); 
        } 
    });
    $('#btn-collapse-all').click(function () { 
        if (currentFilter === 'ALL' && currentRevisedData.data) { 
            currentRevisedData.data.forEach(g => g.is_expanded = false); 
            renderTracker(currentRevisedData); 
        } 
    });
}

// Initialize
$(document).ready(function () {
    // 1. Load Title from Meta (NEW Logic)
    // If the new structure exists, update the page header
    if (rawTrackerData.meta && rawTrackerData.meta.title) {
        $('#tracker-main-title').text(rawTrackerData.meta.title);
    }

    // 2. Initialize Controls
    initGlobalControls();
    
    // 3. Initialize Modals
    initEditHandlers();
    initProjectStructureHandlers();
    initDataManager();
    initCreateProjectHandler();
    initMetaHandler();
    
    // 4. Enable Dragging
    makeModalDraggable('#editMilestoneModal');
    makeModalDraggable('#editProjectStructureModal'); // Optional for table view

    // 5. Initial Run
    runPipeline();
});