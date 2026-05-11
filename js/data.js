// --- Data Manager: Import / Export Logic ---

function initDataManager() {
    const modalEl = document.getElementById('dataSettingsModal');
    const modal = new bootstrap.Modal(modalEl);

    // --- 1. Open Modal & Initialize State ---
    $('#btn-open-data').click(function () {
        // Pre-fill filename with current date
        const dateStr = new Date().toISOString().split('T')[0];
        $('#export-filename').val(`tracker_backup_${dateStr}.json`);

        // [UPDATED] Show summary of current data (Access .data instead of .groups)
        const groups = rawTrackerData.data || [];
        const groupCount = groups.length;
        let projCount = 0;
        groups.forEach(g => projCount += g.projects.length);

        $('#export-summary').text(`${groupCount} Groups, ${projCount} Projects`);

        // Reset Import UI state
        $('#import-file-input').val('');
        $('#import-file-name').empty();
        $('#btn-import-json').prop('disabled', true);
        $('#import-drop-zone').removeClass('drag-over');
        selectedFile = null;

        modal.show();
    });

    // --- 2. Export (Download) Logic ---
    $('#btn-download-json').click(function () {
        const filename = $('#export-filename').val() || 'tracker_backup.json';

        // [UPDATED] Construct Payload matching standard structure
        const payload = {
            meta: {
                ...rawTrackerData.meta, // Preserve title, version, etc.
                last_updated: new Date().toISOString() // Update timestamp
            },
            config: {
                pixelsPerDay: pixelsPerDay, // Save current zoom level
                filter: currentFilter       // Save current filter
            },
            // The core data array
            data: rawTrackerData.data
        };

        // Convert to Blob and Download
        try {
            const jsonStr = JSON.stringify(payload, null, 2);
            const blob = new Blob([jsonStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // Optional: Close modal after download
            modal.hide();
        } catch (err) {
            console.error("Export failed:", err);
            alert("Failed to generate backup file.");
        }
    });

    // --- 3. Import Logic (Drag & Drop + Validation) ---

    const $dropZone = $('#import-drop-zone');
    const $fileInput = $('#import-file-input');
    const $fileNameDisplay = $('#import-file-name');
    const $importBtn = $('#btn-import-json');
    let selectedFile = null;

    // Helper: Handle file validation and UI updates
    function handleFileSelection(file) {
        if (file && file.name.toLowerCase().endsWith('.json')) {
            selectedFile = file;
            // Success Feedback
            $fileNameDisplay.html(`<i class="bi bi-check-circle-fill"></i> Selected: <strong>${file.name}</strong>`);
            $importBtn.prop('disabled', false); // Enable Import Button
        } else {
            selectedFile = null;
            // Error Feedback
            $fileNameDisplay.html(`<span class="text-danger"><i class="bi bi-x-circle"></i> Invalid file. Please select a .json file.</span>`);
            $importBtn.prop('disabled', true);
            showToast("Please select a valid .json file.", "danger"); // 🟢 Replacement for Alert
        }
    }

    // Interaction A: Click Zone -> Open File Dialog
    $dropZone.click(function () {
        $fileInput.click();
    });

    // Interaction B: File Input Change
    $fileInput.change(function (e) {
        if (this.files && this.files[0]) {
            handleFileSelection(this.files[0]);
        }
    });

    // Interaction C: Drag Events
    $dropZone.on('dragover dragenter', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    });

    $dropZone.on('dragleave dragend drop', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });

    // Interaction D: Drop Event
    $dropZone.on('drop', function (e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    // Execution with Async Confirmation and Toast Feedback
    // Complete Import logic for js/data.js
    $importBtn.click(function() {
        if (!selectedFile) return;

        // Use custom async confirm modal instead of native confirm() 
        showConfirm(`⚠️ Overwrite current workspace with data from "${selectedFile.name}"?\n\nThis action will replace all current projects.`, function() {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    // 1. Parse JSON content [cite: 472]
                    let jsonContent = JSON.parse(e.target.result);

                    // 2. Validate structure [cite: 472]
                    if (!jsonContent.data || !Array.isArray(jsonContent.data)) {
                        throw new Error("Invalid file format: Missing 'data' array.");
                    }

                    // 3. Clean and sanitize data before applying to state 
                    jsonContent = hydrateImportedData(jsonContent);

                    // 4. Update Global Data State [cite: 475, 476]
                    rawTrackerData = {
                        meta: jsonContent.meta || { title: "Imported Workspace" },
                        data: jsonContent.data
                    };

                    // 5. Restore configuration if available [cite: 479]
                    if (jsonContent.config) {
                        if (jsonContent.config.pixelsPerDay) pixelsPerDay = jsonContent.config.pixelsPerDay;
                        if (jsonContent.config.filter) currentFilter = jsonContent.config.filter;
                    }

                    // 6. Re-render the application [cite: 480]
                    runPipeline();
                    
                    // 7. Hide Management Modal [cite: 481]
                    const modalEl = document.getElementById('dataSettingsModal');
                    const modal = bootstrap.Modal.getInstance(modalEl);
                    if (modal) modal.hide();
                    
                    // 8. Visual feedback via Toast instead of alert() 
                    showToast("Project data imported successfully!", "success");
                    
                    // 9. Reset local state and UI
                    selectedFile = null;
                    $fileNameDisplay.html('Click or Drag & Drop .json file');
                    $importBtn.prop('disabled', true);
                    $fileInput.val('');

                } catch (err) {
                    console.error("Import Error:", err);
                    // Use Toast for error reporting [cite: 866]
                    showToast("Import failed: " + err.message, "danger");
                    $fileNameDisplay.html(`<span class="text-danger"><i class="bi bi-x-circle"></i> Parsing error</span>`);
                }
            };

            reader.readAsText(selectedFile);
        });
    });
}