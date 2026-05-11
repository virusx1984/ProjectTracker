// --- Application Entry Point ---

// [MODIFIED] Helper: Toggle between Welcome Canvas and Main Workspace
function toggleWorkspaceState() {
    // 1. Rigorously check if there is any REAL data
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

    // If the structure is empty, reset to null
    if (!hasData) {
        rawTrackerData = null;
    }

    const $titleWrapper = $('.workspace-title-wrapper');

    // 2. Toggle UI based on data existence
    if (hasData) {
        $('#welcome-canvas').addClass('d-none');
        $('#main-workspace').removeClass('d-none').addClass('d-flex');
        
        $('#btn-return-home').removeClass('d-none');
        
        let wsTitle = "Untitled Workspace";
        if (rawTrackerData && rawTrackerData.meta && rawTrackerData.meta.title) {
            wsTitle = rawTrackerData.meta.title;
        }
        $('#tracker-workspace-title').text(wsTitle);

        // ENABLE editing: Restore click events, hover effects, and tooltip
        $titleWrapper.css('pointer-events', 'auto');
        $titleWrapper.attr('title', 'Edit Workspace Settings');
        
    } else {
        $('#welcome-canvas').removeClass('d-none');
        $('#main-workspace').addClass('d-none').removeClass('d-flex');
        
        $('#btn-return-home').addClass('d-none');
        
        $('#tracker-workspace-title').text("Untitled Workspace");

        // DISABLE editing: Block click events and hover effects on Home Canvas
        $titleWrapper.css('pointer-events', 'none');
        $titleWrapper.removeAttr('title');
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


/**
 * Initialize all global UI controls (Zoom, Search, Workspace Management)
 */
/**
 * Initialize all global UI controls (Zoom, Search, Workspace Management)
 */
function initGlobalControls() {
    
    // ==========================================
    // 1. View & Zoom Controls (Multiplicative Logic)
    // ==========================================

    // Add this to initGlobalControls() in js/app.js
    $('#btn-sync-today').click(function () {
        // 1. Refresh the core reference time
        CONFIG.CURRENT_DATE = new Date();
        
        // 2. Re-run the full pipeline (re-calculate waterfall and re-render UI)
        runPipeline();
        
        // 3. UI Feedback
        showToast("Timeline synchronized to current time.", "info");

        // 4. [UX Detail] Smooth scroll to the 'Today' marker position
        // Calculate position based on current zoom and start date
        const todayOffsetDays = getDaysDiff(CONFIG.TRACKER_START_DATE, CONFIG.CURRENT_DATE);
        const scrollPos = todayOffsetDays * pixelsPerDay;

        $('#tracker-wrapper').animate({
            scrollLeft: scrollPos
        }, 400); // 400ms smooth transition
    });
    
    // Zoom In: Increase by 25% each click
    $('#btn-zoom-in').click(function () {
        if (pixelsPerDay < 50) {
            pixelsPerDay = pixelsPerDay * 1.25;
            // Use renderTracker directly for immediate visual feedback
            renderTracker(currentRevisedData);
        }
    });

    // Zoom Out: Decrease by 20% each click (Inverse of 1.25)
    $('#btn-zoom-out').click(function () {
        if (pixelsPerDay > 0.15) {
            pixelsPerDay = pixelsPerDay * 0.8;
            renderTracker(currentRevisedData);
        }
    });

    // Reset Zoom to Default (currently 6px/day)
    $('#btn-zoom-reset').click(function () {
        pixelsPerDay = CONFIG.DEFAULT_PIXELS_PER_DAY;
        renderTracker(currentRevisedData);
    });

    // Group Expansion: Toggle all is_expanded states in raw data
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

    // ==========================================
    // 2. Search & Filter Controls
    // ==========================================
    
    // Clear search input and trigger UI refresh
    $('#btn-search-clear').click(function() {
        $('#project-search-input').val('');
        $(this).addClass('d-none');
        runPipeline();
    });

    // ==========================================
    // 3. Workspace Level Controls (Home & Metadata)
    // ==========================================
    
    // Action: Return Home / Close Workspace securely
    $('#btn-return-home').off('click').on('click', function() {
        if (!rawTrackerData) return;
        
        showConfirm("⚠️ Close current workspace?\nAny unsaved changes will be lost.", function() {
            rawTrackerData = null; // Clear memory state
            runPipeline();         // Re-render UI to welcome-canvas
            showToast("Workspace closed securely.", "info");
        });
    });

    // Action: Populate Workspace Settings Modal when opened
    $('#workspaceSettingsModal').on('show.bs.modal', function () {
        if (rawTrackerData && rawTrackerData.meta) {
            $('#meta-title-input').val(rawTrackerData.meta.title || "");
            $('#meta-version-input').val(rawTrackerData.meta.version || "");
            $('#meta-date-input').val(rawTrackerData.meta.last_updated || ""); 
        }
    });

    // Action: Save changes from Workspace Settings Modal
    $('#btn-save-workspace-meta').click(function() {
        if (!rawTrackerData) {
            rawTrackerData = { meta: {}, data: [] };
        }
        if (!rawTrackerData.meta) {
            rawTrackerData.meta = {};
        }
        
        rawTrackerData.meta.title = $('#meta-title-input').val().trim() || "Untitled Workspace";
        rawTrackerData.meta.version = $('#meta-version-input').val().trim();
        rawTrackerData.meta.last_updated = $('#meta-date-input').val().trim();
        
        runPipeline(); 
        
        const modalEl = document.getElementById('workspaceSettingsModal');
        const modalInstance = bootstrap.Modal.getInstance(modalEl) || new bootstrap.Modal(modalEl);
        modalInstance.hide();
        showToast("Workspace settings updated.", "success");
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
    initDataSyncHandlers();

    // 4. Enable Dragging
    makeModalDraggable('#editMilestoneModal');
    makeModalDraggable('#editProjectStructureModal');

    // 🟢 [FIX] Register the new modals for dragging
    makeModalDraggable('#dataSettingsModal');
    makeModalDraggable('#createProjectModal');

    // 5. Initial Run
    runPipeline();
});