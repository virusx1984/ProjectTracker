// --- Data Manager: Import / Export Logic ---

function initDataManager() {
    const modalEl = document.getElementById('dataSettingsModal');
    const modal = new bootstrap.Modal(modalEl);

    // 1. Open Modal Handler
    $('#btn-open-data').click(function() {
        // Pre-fill filename with date
        const dateStr = new Date().toISOString().split('T')[0];
        $('#export-filename').val(`tracker_backup_${dateStr}.json`);
        
        // Show summary
        const groupCount = rawTrackerData.groups.length;
        let projCount = 0;
        rawTrackerData.groups.forEach(g => projCount += g.projects.length);
        $('#export-summary').text(`${groupCount} Groups, ${projCount} Projects`);
        
        modal.show();
    });

    // 2. Export (Download) Handler
    $('#btn-download-json').click(function() {
        const filename = $('#export-filename').val() || 'tracker_backup.json';
        
        // Construct Payload
        const payload = {
            meta: {
                version: "1.0",
                app: "ProjectTracker Pro",
                export_date: new Date().toISOString()
            },
            config: {
                pixelsPerDay: pixelsPerDay, // Save current zoom level
                filter: currentFilter
            },
            data: rawTrackerData // The source of truth
        };

        // Convert to Blob
        const jsonStr = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        // Trigger Download
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        
        // Cleanup
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        modal.hide();
    });

    // 3. Import Handler
    $('#btn-import-json').click(function() {
        const fileInput = document.getElementById('import-file-input');
        const file = fileInput.files[0];

        if (!file) {
            alert("Please select a JSON file first.");
            return;
        }

        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                // Parse JSON
                const jsonContent = JSON.parse(e.target.result);

                // Basic Validation
                if (!jsonContent.meta || !jsonContent.data || !Array.isArray(jsonContent.data.groups)) {
                    throw new Error("Invalid file format: Missing core structure.");
                }

                // Confirm Overwrite
                if(!confirm(`Load data from "${file.name}"? Unsaved changes will be lost.`)) {
                    return;
                }

                // HYDRATION: Overwrite Global Variables
                rawTrackerData = jsonContent.data; // Update Data
                
                // Optional: Restore Config
                if (jsonContent.config) {
                    if (jsonContent.config.pixelsPerDay) {
                        pixelsPerDay = jsonContent.config.pixelsPerDay;
                    }
                    if (jsonContent.config.filter) {
                        currentFilter = jsonContent.config.filter;
                    }
                }

                // Re-run Pipeline
                runPipeline();
                
                // Success Feedback
                alert("Data loaded successfully!");
                modal.hide();
                // Reset input
                fileInput.value = '';

            } catch (err) {
                console.error(err);
                alert("Error importing file: " + err.message);
            }
        };

        reader.readAsText(file);
    });
}