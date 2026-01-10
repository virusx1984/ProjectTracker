// --- Data Manager: Import / Export Logic ---

function initDataManager() {
    const modalEl = document.getElementById('dataSettingsModal');
    const modal = new bootstrap.Modal(modalEl);
    
    // --- 1. Open Modal & Initialize State ---
    $('#btn-open-data').click(function() {
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
    $('#btn-download-json').click(function() {
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
        }
    }

    // Interaction A: Click Zone -> Open File Dialog
    $dropZone.click(function() {
        $fileInput.click();
    });

    // Interaction B: File Input Change
    $fileInput.change(function(e) {
        if (this.files && this.files[0]) {
            handleFileSelection(this.files[0]);
        }
    });

    // Interaction C: Drag Events
    $dropZone.on('dragover dragenter', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).addClass('drag-over');
    });

    $dropZone.on('dragleave dragend drop', function(e) {
        e.preventDefault();
        e.stopPropagation();
        $(this).removeClass('drag-over');
    });

    // Interaction D: Drop Event
    $dropZone.on('drop', function(e) {
        const files = e.originalEvent.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelection(files[0]);
        }
    });

    // Interaction E: Execute Import
    $importBtn.click(function() {
        if (!selectedFile) return;

        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // 1. Parse JSON
                let jsonContent = JSON.parse(e.target.result); // Changed const to let

                // 2. Validate Structure
                if (!jsonContent.data || !Array.isArray(jsonContent.data)) {
                    throw new Error("Invalid file format: Missing 'data' array.");
                }

                // 3. User Confirmation
                if(!confirm(`Load data from "${selectedFile.name}"?\n\nWARNING: Current unsaved changes will be lost.`)) {
                    return;
                }

                // 🟢 [CRITICAL FIX] Hydrate/Sanitize BEFORE assigning to global state
                // This removes 'null' dates that cause getFullYear() crashes
                jsonContent = hydrateImportedData(jsonContent);

                // 4. Update Global Data
                rawTrackerData = {
                    meta: jsonContent.meta || { title: "Imported Project" },
                    data: jsonContent.data
                };

                // Update Title UI
                if (rawTrackerData.meta.title) {
                    $('#tracker-main-title').text(rawTrackerData.meta.title);
                }
                
                // Restore Config
                if (jsonContent.config) {
                    if (jsonContent.config.pixelsPerDay) pixelsPerDay = jsonContent.config.pixelsPerDay;
                    if (jsonContent.config.filter) currentFilter = jsonContent.config.filter;
                }

                // 5. Re-Render Application
                runPipeline();

                // 6. Cleanup
                modal.hide();
                alert("Data loaded successfully!");
                
                // Reset State
                selectedFile = null;
                $fileNameDisplay.empty();
                $importBtn.prop('disabled', true);
                $fileInput.val('');

            } catch (err) {
                console.error(err);
                alert("Error importing file:\n" + err.message);
                $fileNameDisplay.html(`<span class="text-danger">Error parsing file. Check console.</span>`);
            }
        };

        // Start reading
        reader.readAsText(selectedFile);
    });
}