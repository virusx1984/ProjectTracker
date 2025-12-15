// --- Helper Functions ---

// Calculate difference in days between two dates
function getDaysDiff(start, end) {
    const s = new Date(start);
    const e = new Date(end);
    // Reset times to avoid Daylight Saving Time issues
    s.setHours(12, 0, 0, 0);
    e.setHours(12, 0, 0, 0);
    return Math.round((e - s) / (1000 * 60 * 60 * 24));
}

// Add days to a date object
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Make a Bootstrap Modal draggable via its header
function makeModalDraggable(modalId) {
    const $modal = $(modalId);
    const $dialog = $modal.find('.modal-dialog');
    const $header = $modal.find('.modal-header');
    let isDragging = false;
    let startX, startY, startLeft, startTop;

    $header.on('mousedown', function (e) {
        if (e.which !== 1) return; // Only left click
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        
        // Lock width/position to prevent jumping
        const currentWidth = $dialog.outerWidth();
        const offset = $dialog.offset();
        startLeft = offset.left;
        startTop = offset.top;
        
        $dialog.css({ 
            'width': currentWidth + 'px', 
            'margin': '0', 
            'position': 'absolute', 
            'left': startLeft + 'px', 
            'top': startTop + 'px' 
        });
        e.preventDefault();
    });

    $(document).on('mousemove', function (e) {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        $dialog.css({ 'left': (startLeft + dx) + 'px', 'top': (startTop + dy) + 'px' });
    });

    $(document).on('mouseup', function () { isDragging = false; });
    
    // Reset on close
    $modal.on('hidden.bs.modal', function () { 
        $dialog.css({ 'left': '', 'top': '', 'margin': '', 'position': '', 'width': '' }); 
    });
}