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
function initGlobalControls() {
    // [MODIFIED] Smooth Zoom Logic (Multiplicative)
    
    // Zoom In: Increase by 25% each click
    $('#btn-zoom-in').click(function () { 
        if (pixelsPerDay < 50) { 
            pixelsPerDay = pixelsPerDay * 1.25; 
            renderTracker(currentRevisedData); 
        } 
    });

    // Zoom Out: Decrease by 20% each click (Inverse of 1.25)
    // Lower bound set to 0.25 to prevent it from becoming invisible
    $('#btn-zoom-out').click(function () { 
        if (pixelsPerDay > 0.25) { 
            pixelsPerDay = pixelsPerDay * 0.8; 
            renderTracker(currentRevisedData); 
        } 
    });

    // Reset
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