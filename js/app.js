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
function initGlobalControls() {
    
    // ==========================================
    // 1. View & Zoom Controls
    // ==========================================
    $('#btn-expand-all').click(function() {
        $('.project-row:not(.group-row)').show();
        $('.bi-chevron-right').removeClass('bi-chevron-right').addClass('bi-chevron-down');
    });

    $('#btn-collapse-all').click(function() {
        $('.project-row:not(.group-row)').hide();
        $('.bi-chevron-down').removeClass('bi-chevron-down').addClass('bi-chevron-right');
    });

    $('#btn-zoom-in').click(function() {
        ZOOM_LEVEL = Math.min(ZOOM_LEVEL + 0.2, 2.0);
        runPipeline();
    });

    $('#btn-zoom-out').click(function() {
        ZOOM_LEVEL = Math.max(ZOOM_LEVEL - 0.2, 0.5);
        runPipeline();
    });

    $('#btn-zoom-reset').click(function() {
        ZOOM_LEVEL = 1.0;
        runPipeline();
    });

    // ==========================================
    // 2. Search & Filter Controls
    // ==========================================
    $('#btn-search-clear').click(function() {
        $('#project-search-input').val('');
        $(this).addClass('d-none');
        runPipeline();
    });

    $('#project-search-input').on('input', function() {
        if ($(this).val().length > 0) {
            $('#btn-search-clear').removeClass('d-none');
        } else {
            $('#btn-search-clear').addClass('d-none');
        }
        runPipeline();
    });

    $('#btn-search-regex').click(function() {
        $(this).toggleClass('active');
        // Toggle visual state of the regex button
        if ($(this).hasClass('active')) {
            $(this).removeClass('btn-outline-secondary').addClass('btn-primary');
        } else {
            $(this).removeClass('btn-primary').addClass('btn-outline-secondary');
        }
        runPipeline();
    });

    // ==========================================
    // 3. Workspace Level Controls (Level 1)
    // ==========================================
    
    // Action: Return Home / Close Workspace securely
    $('#btn-return-home').off('click').on('click', function() {
        if (!rawTrackerData) return;
        
        showConfirm("⚠️ Close current workspace?\nAny unsaved changes will be lost.", function() {
            rawTrackerData = null; // Clear memory
            runPipeline();         // Re-render UI to zero-state
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
        const newTitle = $('#meta-title-input').val().trim();
        
        if (!rawTrackerData) {
            rawTrackerData = { meta: {}, data: [] };
        }
        if (!rawTrackerData.meta) {
            rawTrackerData.meta = {};
        }
        
        // Update the data model
        rawTrackerData.meta.title = newTitle || "Untitled Workspace";
        rawTrackerData.meta.version = $('#meta-version-input').val().trim();
        rawTrackerData.meta.last_updated = $('#meta-date-input').val().trim();
        
        // Trigger UI refresh to show the new title instantly
        runPipeline(); 
        
        // Close modal and show success feedback
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