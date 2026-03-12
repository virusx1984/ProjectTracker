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

// ==========================================
// --- [NEW] Global UI Feedback Utilities ---
// ==========================================

// 1. Show Toast Notification (Tier 1)
function showToast(message, type = 'success') {
    const container = document.getElementById('global-toast-container');
    if (!container) return;

    // Map types to Bootstrap semantic classes
    const bgClass = `bg-${type}`;
    const icon = type === 'success' ? 'check-circle' : (type === 'danger' ? 'x-circle' : 'info-circle');
    
    const toastId = 'toast-' + Date.now();
    const toastHtml = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0 mb-2 shadow" role="alert" aria-live="assertive" aria-atomic="true">
            <div class="d-flex">
                <div class="toast-body fw-bold">
                    <i class="bi bi-${icon} me-2"></i>${message}
                </div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
        </div>
    `;
    
    container.insertAdjacentHTML('beforeend', toastHtml);
    const toastEl = document.getElementById(toastId);
    
    // Initialize and show
    const toast = new bootstrap.Toast(toastEl, { delay: 3000 });
    toast.show();
    
    // Auto-remove from DOM after hidden to keep HTML clean
    toastEl.addEventListener('hidden.bs.toast', () => {
        toastEl.remove();
    });
}

// 2. Show Custom Confirm Modal (Tier 3)
// Replaces the synchronous confirm() with an asynchronous callback
function showConfirm(message, onConfirmCallback) {
    // Replace newlines with <br> for HTML rendering
    $('#custom-confirm-msg').html(message.replace(/\n/g, '<br>'));
    
    const modalEl = document.getElementById('customConfirmModal');
    const modal = new bootstrap.Modal(modalEl);
    
    // Unbind previous clicks to prevent multiple firing, then bind new callback
    $('#btn-custom-confirm-yes').off('click').on('click', function() {
        modal.hide();
        if (typeof onConfirmCallback === 'function') {
            onConfirmCallback();
        }
    });
    
    modal.show();
}