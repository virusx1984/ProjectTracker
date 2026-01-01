// --- Application Entry Point ---

// Main Pipeline Runner
// Exposed globally so moduls.js can access it
function runPipeline() {
    // 1. Calculate Revised Dates (Logic derivation)
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
    // Zoom
    $('#btn-zoom-in').click(function () { if (pixelsPerDay < 20) { pixelsPerDay += 2; renderTracker(currentRevisedData); } });
    $('#btn-zoom-out').click(function () { if (pixelsPerDay > 2) { pixelsPerDay -= 2; renderTracker(currentRevisedData); } });
    $('#btn-zoom-reset').click(function () { pixelsPerDay = CONFIG.DEFAULT_PIXELS_PER_DAY; renderTracker(currentRevisedData); });

    // Group Expansion
    $('#btn-expand-all').click(function () { if (currentFilter === 'ALL') { currentRevisedData.groups.forEach(g => g.is_expanded = true); renderTracker(currentRevisedData); } });
    $('#btn-collapse-all').click(function () { if (currentFilter === 'ALL') { currentRevisedData.groups.forEach(g => g.is_expanded = false); renderTracker(currentRevisedData); } });
}

// Initialize
$(document).ready(function () {
    // 1. Initialize Controls
    initGlobalControls();
    
    // 2. Initialize Modals
    initEditHandlers();
    initProjectStructureHandlers();
    initDataManager();
    initCreateProjectHandler();
    
    // 3. Enable Dragging
    makeModalDraggable('#editMilestoneModal');
    makeModalDraggable('#editProjectStructureModal'); // Optional for table view

    // 4. Initial Run
    runPipeline();
});