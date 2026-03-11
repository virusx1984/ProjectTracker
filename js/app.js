// --- Application Entry Point ---

// [MODIFIED] Helper: Toggle between Welcome Canvas and Main Workspace
function toggleWorkspaceState() {
    // 1. Rigorously check if there is any REAL data (Scheme 3: Auto-return)
    let hasData = false;
    if (rawTrackerData && rawTrackerData.data) {
        // Iterate through groups to see if any project exists
        for (let g of rawTrackerData.data) {
            if (g.projects && g.projects.length > 0) {
                hasData = true;
                break;
            }
        }
    }

    // 🟢 [FIX] If the structure is empty (e.g., user deleted all projects), reset to null
    if (!hasData) {
        rawTrackerData = null;
    }

    // 2. Toggle UI based on data existence
    if (hasData) {
        $('#welcome-canvas').addClass('d-none');
        $('#main-workspace').removeClass('d-none').addClass('d-flex');

        // Update Main Title
        if (rawTrackerData.meta && rawTrackerData.meta.title) {
            $('#tracker-main-title').text(rawTrackerData.meta.title);
        }
    } else {
        $('#welcome-canvas').removeClass('d-none');
        $('#main-workspace').addClass('d-none').removeClass('d-flex');
        $('#tracker-main-title').text("ProjectTracker Pro");
    }
}

// Main Pipeline Runner
function runPipeline() {
    // 1. Check State First
    toggleWorkspaceState();

    // 2. Abort rendering if no data exists (stay on Welcome Canvas)
    if (!rawTrackerData || !rawTrackerData.data || rawTrackerData.data.length === 0) {
        return;
    }

    // 3. Normal Rendering Pipeline
    currentRevisedData = reviseProjectData(rawTrackerData);
    calculateAutoBounds(currentRevisedData);

    const result = preprocessData(currentRevisedData);
    currentProcessedStats = result.counts;

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
        if (pixelsPerDay > 0.15) {
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

    // 🟢 [NEW] Scheme 2: Return to Home by clicking the main title
    $('#tracker-main-title')
        .css('cursor', 'pointer')
        .attr('title', 'Return to Welcome Screen')
        .click(function () {
            // If already on welcome screen (rawTrackerData is null), do nothing
            if (!rawTrackerData) return;

            if (confirm("⚠️ Return to Welcome Screen?\nAny unsaved changes in your current workspace will be lost.")) {
                rawTrackerData = null; // Clear data
                runPipeline();         // Trigger re-render to show Welcome Canvas
            }
        });
}

// Initialize
$(document).ready(function () {
    // Remove the old Title loading logic here, it's now handled in toggleWorkspaceState()


    // 2. Initialize Controls
    initGlobalControls();

    // 3. Initialize Modals
    initEditHandlers();
    initProjectStructureHandlers();
    initDataManager();
    initCreateProjectHandler();
    initMetaHandler();
    initDataSyncHandlers();

    // 4. Enable Dragging
    makeModalDraggable('#editMilestoneModal');
    makeModalDraggable('#editProjectStructureModal');

    // 🟢 [FIX] Register the new modals for dragging
    makeModalDraggable('#dataSettingsModal');
    makeModalDraggable('#projectSettingsModal');
    makeModalDraggable('#createProjectModal');

    // 5. Initial Run
    runPipeline();
});