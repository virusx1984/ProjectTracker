// --- Application Entry Point ---

// Main Pipeline Runner
// Exposed globally so moduls.js can access it
function runPipeline() {
    currentRevisedData = reviseProjectData(rawTrackerData);
    const result = preprocessData(currentRevisedData);
    currentProcessedStats = result.counts;
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
    
    // 3. Enable Dragging
    makeModalDraggable('#editMilestoneModal');
    // makeModalDraggable('#editProjectStructureModal'); // Optional for table view

    // 4. Initial Run
    runPipeline();
});