$(document).ready(function () {
    // --- Configuration ---
    let pixelsPerDay = 6;
    const DEFAULT_PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;

    // DEMO DATE: Fixed for demonstration (Use new Date() in production)
    const CURRENT_DATE = new Date("2025-03-15");

    // --- Data Source (Global State) ---
    // This is the source of truth. We update THIS object when editing.
    const rawTrackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025 (Editable)",
        "projects": [
            {
                "project_id": "PRJ-001",
                "project_name": "E-Commerce Platform",
                "start_date": "2025-01-05",
                "milestones": [
                    { "name": "UI Design", "status_progress": 1.0, "planned_end": "2025-02-15", "actual_completion_date": "2025-02-10", "demand_due_date": "2025-02-15", "color": "#0d6efd" },
                    { "name": "Frontend", "status_progress": 1.0, "planned_end": "2025-03-25", "actual_completion_date": "2025-04-05", "demand_due_date": "2025-03-25", "color": "#198754" },
                    { "name": "Backend", "status_progress": 0.0, "planned_end": "2025-05-15", "actual_completion_date": null, "demand_due_date": "2025-05-01", "color": "#6f42c1" }
                ]
            },
            {
                "project_id": "PRJ-007",
                "project_name": "Cloud Infra Setup",
                "start_date": "2025-01-20",
                "milestones": [
                    { "name": "AWS Setup", "status_progress": 0.8, "planned_end": "2025-02-15", "actual_completion_date": null, "demand_due_date": "2025-02-15", "color": "#fd7e14" },
                    { "name": "K8s Config", "status_progress": 0.0, "planned_end": "2025-04-05", "actual_completion_date": null, "demand_due_date": "2025-03-30", "color": "#6f42c1" }
                ]
            },
            {
                "project_id": "PRJ-002",
                "project_name": "Mobile App Launch",
                "start_date": "2025-02-01",
                "milestones": [
                    { "name": "Requirement", "status_progress": 1.0, "planned_end": "2025-02-20", "actual_completion_date": "2025-02-20", "demand_due_date": "2025-02-25", "color": "#fd7e14" },
                    { "name": "Alpha Ver.", "status_progress": 0.4, "planned_end": "2025-05-10", "actual_completion_date": null, "demand_due_date": "2025-05-10", "color": "#20c997" }
                ]
            }
        ]
    };

    // --- Helpers ---
    function getDaysDiff(start, end) {
        const s = new Date(start);
        const e = new Date(end);
        return (e - s) / (1000 * 60 * 60 * 24);
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    // --- CORE LOGIC: Dynamic Schedule Revision ---
    function reviseProjectData(originalData) {
        const revisedData = JSON.parse(JSON.stringify(originalData));
        revisedData.projects.forEach(project => {
            let chainCursor = new Date(project.start_date);
            let previousOriginalPlanEnd = new Date(project.start_date);

            project.milestones.forEach(ms => {
                const originalPlanEnd = new Date(ms.planned_end);
                const durationDays = Math.max(1, getDaysDiff(previousOriginalPlanEnd, originalPlanEnd));

                const revisedStart = new Date(chainCursor);
                const revisedEnd = addDays(revisedStart, durationDays);

                ms.revised_start_date = revisedStart.toISOString().split('T')[0];
                ms.revised_end_date = revisedEnd.toISOString().split('T')[0];
                ms.duration_days = Math.floor(durationDays);

                if (ms.actual_completion_date) {
                    chainCursor = new Date(ms.actual_completion_date);
                } else {
                    if (CURRENT_DATE > revisedEnd) {
                        chainCursor = new Date(CURRENT_DATE);
                    } else {
                        chainCursor = new Date(revisedEnd);
                    }
                }
                previousOriginalPlanEnd = originalPlanEnd;
            });
        });
        return revisedData;
    }

    // --- Popover Content Generator ---
    function createPopoverContent(ms, startDate, endDate, status) {
        let badgeClass = 'bg-secondary';
        let statusText = 'Pending';

        if (ms.status_progress === 1.0) {
            badgeClass = 'bg-success';
            statusText = 'Done';
        } else if (status.isOverdue) {
            badgeClass = 'bg-danger';
            statusText = 'Overdue';
        } else if (ms.status_progress > 0) {
            badgeClass = 'bg-primary';
            statusText = 'In Progress';
        }

        const progressPct = Math.round(ms.status_progress * 100);

        return `
            <div class="popover-body-content">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong style="color:${ms.color}">${ms.name}</strong>
                    <span class="badge ${badgeClass}">${statusText}</span>
                </div>
                <div class="info-row">
                    <span class="icon">📅</span> 
                    <span>${startDate} ➝ ${endDate}</span>
                </div>
                <div class="info-row">
                    <span class="icon">⏱️</span> 
                    <span>Duration: <b>${ms.duration_days} Days</b></span>
                </div>
                <div class="info-row">
                    <span class="icon">📊</span> 
                    <span>Progress: <b>${progressPct}%</b></span>
                </div>
                ${status.extraInfo ? `<div class="info-row text-danger mt-1 border-top pt-1"><small>${status.extraInfo}</small></div>` : ''}
                <div class="mt-2 text-center text-muted" style="font-size:10px; border-top:1px solid #eee; padding-top:4px;">
                    <i>(Click bar to edit)</i>
                </div>
            </div>
        `;
    }

    function renderTracker(data) {
        const $container = $('#projects-container');
        const $headerTicks = $('#header-ticks-container');
        const $mainTitle = $('#tracker-main-title');

        // Cleanup old popovers
        $('.gantt-bar').each(function () {
            const popover = bootstrap.Popover.getInstance(this);
            if (popover) popover.dispose();
        });

        // 1. Setup
        $mainTitle.html(`${data.tracker_title} <small class="text-muted fs-6">Target vs Actual</small>`);
        $container.empty();
        $headerTicks.empty();
        $container.css('position', 'relative');

        // 2. Render Header
        let totalTimelineWidth = 0;
        const SHOW_DAYS_THRESHOLD = 4;

        for(let i=0; i < RENDER_MONTHS_COUNT; i++) {
            let targetMonthDate = new Date(TRACKER_START_DATE);
            targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
            let daysFromStart = getDaysDiff(TRACKER_START_DATE, targetMonthDate);
            let leftPos = daysFromStart * pixelsPerDay;
            let monthName = targetMonthDate.toLocaleString('default', { month: 'short' });
            
            $headerTicks.append(`<div class="time-mark" style="left: ${leftPos}px">${monthName}</div>`);
            
            // Get the total number of days in the current month (28, 30, or 31)
            let daysInMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();

            // --- Daily Ticks Logic ---
            if (pixelsPerDay >= SHOW_DAYS_THRESHOLD) {
                let step;
                if (pixelsPerDay >= 18) { step = 1; } 
                else if (pixelsPerDay >= 10) { step = 5; } 
                else { step = 15; }

                for (let d = 1; d <= daysInMonth; d++) {
                    if (d % step === 0 && d !== 1) {
                        if (step > 1 && d >= 30) continue;

                        let dayDate = new Date(targetMonthDate);
                        dayDate.setDate(d);
                        let dayOffset = getDaysDiff(TRACKER_START_DATE, dayDate);
                        let dayLeft = dayOffset * pixelsPerDay;
                        $headerTicks.append(`<div class="day-tick" style="left: ${dayLeft}px">${d}</div>`);
                    }
                }
            }
            
            // --- FIX: Correctly calculate total width ---
            // Logic: Month Start Position + (Days in Month * Pixels Per Day)
            // This ensures the container fully wraps the last month regardless of the zoom level
            let monthWidth = daysInMonth * pixelsPerDay;
            totalTimelineWidth = leftPos + monthWidth; 
        }
        
        // Add a small buffer (e.g., 20px) to prevent text from hitting the browser edge
        $headerTicks.css('min-width', (totalTimelineWidth + 0) + 'px');

        // Past Zone & Today Marker
        const todayOffsetDays = getDaysDiff(TRACKER_START_DATE, CURRENT_DATE);
        if (todayOffsetDays >= 0) {
            const todayLeft = todayOffsetDays * pixelsPerDay;
            const sidebarWidth = $('.header-corner-placeholder').outerWidth() || 220;

            $headerTicks.append(`
                <div class="today-header-marker" style="left: ${todayLeft}px;">
                    <span class="today-label">Today</span>
                </div>
            `);
            $container.append(`
                <div class="past-time-zone" style="width: ${todayLeft + sidebarWidth}px;"></div>
            `);
        }

        // 3. Render Projects
        // Note the addition of index 'pIndex'
        data.projects.forEach((project, pIndex) => {
            let projectHTML = `
                <div class="project-row">
                    <div class="project-name-label">
                        <div class="fw-bold text-dark">${project.project_name}</div>
                        <div style="font-size:10px; color:#6c757d; margin-top:4px;">
                            ID: ${project.project_id}
                        </div>
                    </div>
                    <div class="milestone-container" id="milestones-${project.project_id}" style="min-width: ${totalTimelineWidth}px"></div>
                </div>
            `;
            $container.append(projectHTML);

            const $rowContext = $(`#milestones-${project.project_id}`);
            let currentDemandAnchor = project.start_date;

            // Note the addition of index 'mIndex'
            project.milestones.forEach((ms, mIndex) => {

                // --- A. Demand Track ---
                const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);
                const demandWidth = Math.max(demandDuration * pixelsPerDay, 2);
                const demandLeft = demandOffset * pixelsPerDay;
                const demandPopover = `Demand: ${ms.name}<br>Due: ${demandEndDate}`;

                // ADDED: data-p-idx and data-m-idx attributes
                $rowContext.append(`
                    <div class="gantt-bar demand-bar clickable" 
                         style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
                         data-p-idx="${pIndex}" data-m-idx="${mIndex}"
                         data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top"
                         data-bs-content="${demandPopover}"></div>
                `);

                // --- B. Plan Track ---
                const revisedStart = ms.revised_start_date;
                const revisedEnd = ms.revised_end_date;
                const actualDate = ms.actual_completion_date;

                let solidBarEnd = revisedEnd;
                let tailType = null;
                let tailStart = null;
                let tailEnd = null;
                let statusInfo = { isOverdue: false, extraInfo: '' };

                if (actualDate) {
                    if (new Date(actualDate) > new Date(revisedEnd)) {
                        solidBarEnd = revisedEnd; tailType = 'late'; tailStart = revisedEnd; tailEnd = actualDate;
                        const diff = Math.floor(getDaysDiff(revisedEnd, actualDate));
                        statusInfo.extraInfo = `⚠️ Late by ${diff} days`;
                    } else if (new Date(actualDate) < new Date(revisedEnd)) {
                        solidBarEnd = actualDate; tailType = 'early'; tailStart = actualDate; tailEnd = revisedEnd;
                        const diff = Math.floor(getDaysDiff(actualDate, revisedEnd));
                        statusInfo.extraInfo = `✅ Early by ${diff} days`;
                    } else {
                        solidBarEnd = actualDate;
                        statusInfo.extraInfo = `✅ On Time`;
                    }
                } else {
                    if (CURRENT_DATE > new Date(revisedEnd)) {
                        solidBarEnd = revisedEnd; tailType = 'late'; tailStart = revisedEnd; tailEnd = CURRENT_DATE.toISOString().split('T')[0];
                        statusInfo.isOverdue = true;
                        const diff = Math.floor(getDaysDiff(revisedEnd, CURRENT_DATE));
                        statusInfo.extraInfo = `🔥 Overdue: ${diff} days so far`;
                    }
                }

                const planDuration = getDaysDiff(revisedStart, solidBarEnd);
                const planOffset = getDaysDiff(TRACKER_START_DATE, revisedStart);
                const planWidth = Math.max(planDuration * pixelsPerDay, 2);
                const planLeft = planOffset * pixelsPerDay;
                const progressPct = Math.round(ms.status_progress * 100);
                const popContent = createPopoverContent(ms, revisedStart, solidBarEnd, statusInfo);

                let innerContent = '';
                if (planWidth > 60) {
                    innerContent = `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${progressPct}%</span></div>`;
                }

                // ADDED: data-p-idx and data-m-idx attributes
                $rowContext.append(`
                    <div class="gantt-bar plan-bar clickable" 
                         style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};"
                         data-p-idx="${pIndex}" data-m-idx="${mIndex}"
                         data-bs-toggle="popover" 
                         data-bs-trigger="hover focus" 
                         data-bs-html="true" 
                         data-bs-placement="top"
                         data-bs-content='${popContent}'>
                        <div class="progress-overlay" style="width: ${progressPct}%"></div>
                        ${innerContent}
                    </div>
                `);

                if (tailType) {
                    const tStart = new Date(tailStart);
                    const tEnd = new Date(tailEnd);
                    const tailDuration = (tEnd - tStart) / (1000 * 60 * 60 * 24);
                    const tailOffset = getDaysDiff(TRACKER_START_DATE, tStart);
                    const tailWidth = Math.max(tailDuration * pixelsPerDay, 2);
                    const tailLeft = tailOffset * pixelsPerDay;
                    const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                    const tailPopover = tailType === 'late'
                        ? `Delay Segment<br>From: ${tailStart}<br>To: ${tailEnd}`
                        : `Saved Segment<br>Orig End: ${tailEnd}`;

                    // ADDED: data-p-idx and data-m-idx attributes (Clicking tail also edits)
                    $rowContext.append(`<div class="gantt-bar ${tailClass} clickable" 
                        style="left: ${tailLeft}px; width: ${tailWidth}px;"
                        data-p-idx="${pIndex}" data-m-idx="${mIndex}"
                        data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-content="${tailPopover}"></div>`);
                }

                currentDemandAnchor = demandEndDate;
            });
        });

        // Initialize Popovers
        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
        [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    }

    // --- Edit & Interaction Logic (Updated with Fix) ---
    function initEditHandlers() {
        const modalEl = document.getElementById('editMilestoneModal');
        // UPDATE: Add options to prevent accidental closing
        const modal = new bootstrap.Modal(modalEl, {
            backdrop: 'static', // Clicking outside won't close it
            keyboard: false     // Pressing ESC won't close it
        });
        const $errorMsg = $('#edit-error-msg'); // 错误提示框

        // --- FIX: Ensure error is cleared whenever modal is closed ---
        // 无论是点击关闭按钮、点击背景还是按 ESC 关闭，都会触发这个事件
        $(modalEl).on('hidden.bs.modal', function () {
            $errorMsg.addClass('d-none').text('');
        });

        // 1. Click on Bar to Open Modal
        $('#projects-container').on('click', '.clickable', function () {
            // Hide active popovers
            const popover = bootstrap.Popover.getInstance(this);
            if (popover) popover.hide();

            // Clear previous errors (Double insurance)
            $errorMsg.addClass('d-none').text('');

            const pIdx = $(this).data('p-idx');
            const mIdx = $(this).data('m-idx');
            const msData = rawTrackerData.projects[pIdx].milestones[mIdx];

            // Populate Form
            $('#edit-p-index').val(pIdx);
            $('#edit-m-index').val(mIdx);
            $('#edit-name').val(msData.name);
            $('#edit-planned-end').val(msData.planned_end);
            $('#edit-actual-date').val(msData.actual_completion_date || '');
            $('#edit-demand-date').val(msData.demand_due_date || '');
            $('#edit-progress').val(msData.status_progress);
            $('#edit-progress-val').text(Math.round(msData.status_progress * 100) + '%');

            modal.show();
        });

        // 2. Slider Update
        $('#edit-progress').on('input', function () {
            $('#edit-progress-val').text(Math.round($(this).val() * 100) + '%');
        });

        // 3. Save Changes (With Strict Validation)
        $('#btn-save-changes').click(function () {
            // Hide error first
            $errorMsg.addClass('d-none');

            const pIdx = parseInt($('#edit-p-index').val());
            const mIdx = parseInt($('#edit-m-index').val());

            // Get Inputs
            const inputName = $('#edit-name').val().trim();
            const inputPlannedEnd = $('#edit-planned-end').val();
            const inputDemandDate = $('#edit-demand-date').val();
            const inputActualDate = $('#edit-actual-date').val();
            const inputProgress = parseFloat($('#edit-progress').val());

            // Get Context Data for Validation
            const project = rawTrackerData.projects[pIdx];
            const milestones = project.milestones;
            const projectStart = project.start_date;

            // --- VALIDATION START ---
            let errorText = null;

            // Rule 2 & 3: Non-Empty Checks
            if (!inputName) errorText = "Task Name cannot be empty.";
            else if (!inputPlannedEnd) errorText = "Original Planned End cannot be empty.";
            else if (!inputDemandDate) errorText = "Demand / Target Date cannot be empty.";

            // Rule 1: Actual Date vs Progress Consistency
            else if (inputProgress < 1.0 && inputActualDate) {
                errorText = "Cannot set Actual Completion Date if progress is less than 100%.";
            }
            else if (inputProgress === 1.0 && !inputActualDate) {
                errorText = "Must set Actual Completion Date if progress is 100%.";
            }

            // Rule 5: Project Boundaries
            else if (inputPlannedEnd < projectStart) {
                errorText = `Planned End (${inputPlannedEnd}) cannot be earlier than Project Start (${projectStart}).`;
            }
            else if (inputActualDate && inputActualDate < projectStart) {
                errorText = `Actual Date (${inputActualDate}) cannot be earlier than Project Start (${projectStart}).`;
            }

            // Rule 4: Milestone Chain Consistency (Strict Waterfall)
            else {
                // 4.1 & 4.3: Check against Previous Milestone
                if (mIdx > 0) {
                    const prevMs = milestones[mIdx - 1];

                    if (inputPlannedEnd < prevMs.planned_end) {
                        errorText = `Planned End cannot be earlier than previous task's Planned End (${prevMs.planned_end}).`;
                    }
                    else if (inputDemandDate < prevMs.demand_due_date) {
                        errorText = `Demand Date cannot be earlier than previous task's Demand Date (${prevMs.demand_due_date}).`;
                    }
                    else if (prevMs.status_progress < 1.0 && inputProgress === 1.0) {
                        errorText = `Cannot mark this task as 100% complete because the previous task ("${prevMs.name}") is not finished yet.`;
                    }
                }

                // 4.2 & 4.4: Check against Next Milestone
                if (!errorText && mIdx < milestones.length - 1) {
                    const nextMs = milestones[mIdx + 1];

                    if (inputPlannedEnd > nextMs.planned_end) {
                        errorText = `Planned End cannot be later than next task's Planned End (${nextMs.planned_end}).`;
                    }
                    else if (inputDemandDate > nextMs.demand_due_date) {
                        errorText = `Demand Date cannot be later than next task's Demand Date (${nextMs.demand_due_date}).`;
                    }
                    else if (nextMs.status_progress === 1.0 && inputProgress < 1.0) {
                        errorText = `Cannot reduce progress below 100% because the next task ("${nextMs.name}") is already finished.`;
                    }
                }
            }

            // Check Result
            if (errorText) {
                $errorMsg.text(errorText).removeClass('d-none');
                $('.modal-content').addClass('shake-animation');
                setTimeout(() => $('.modal-content').removeClass('shake-animation'), 500);
                return; // STOP SAVE
            }
            // --- VALIDATION END ---

            // --- UPDATE DATA ---
            const msData = rawTrackerData.projects[pIdx].milestones[mIdx];

            msData.name = inputName;
            msData.planned_end = inputPlannedEnd;
            msData.demand_due_date = inputDemandDate;
            msData.actual_completion_date = inputActualDate ? inputActualDate : null;
            msData.status_progress = inputProgress;

            // Re-calc and Render
            const newFinalData = reviseProjectData(rawTrackerData);

            // Update shared state for zoom
            currentRevisedData = newFinalData;

            renderTracker(newFinalData);
            modal.hide();
        });
    }

    // --- Zoom Controls ---
    // Shared variable to hold currently displayed data
    let currentRevisedData = null;

    function initZoomControls() {
        $('#btn-zoom-in').click(function () {
            pixelsPerDay += 2;
            if (pixelsPerDay > 20) pixelsPerDay = 20;
            renderTracker(currentRevisedData);
        });

        $('#btn-zoom-out').click(function () {
            pixelsPerDay -= 2;
            if (pixelsPerDay < 2) pixelsPerDay = 2;
            renderTracker(currentRevisedData);
        });

        $('#btn-zoom-reset').click(function () {
            pixelsPerDay = DEFAULT_PIXELS_PER_DAY;
            renderTracker(currentRevisedData);
        });
    }

    // --- NEW: Make Modal Draggable Logic (Fixed Width Issue) ---
    function makeModalDraggable(modalId) {
        const $modal = $(modalId);
        const $dialog = $modal.find('.modal-dialog');
        const $header = $modal.find('.modal-header');

        let isDragging = false;
        let startX, startY, startLeft, startTop;

        $header.on('mousedown', function (e) {
            if (e.which !== 1) return;

            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            // 1. 关键修复：在改变定位之前，先获取当前的实际宽度
            const currentWidth = $dialog.outerWidth();

            const offset = $dialog.offset();
            startLeft = offset.left;
            startTop = offset.top;

            // 2. 关键修复：在设置 absolute 的同时，锁死 width
            $dialog.css({
                'width': currentWidth + 'px', // <--- 加上这一行，锁死宽度
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

            $dialog.css({
                'left': (startLeft + dx) + 'px',
                'top': (startTop + dy) + 'px'
            });
        });

        $(document).on('mouseup', function () {
            isDragging = false;
        });

        $modal.on('hidden.bs.modal', function () {
            $dialog.css({
                'left': '',
                'top': '',
                'margin': '',
                'position': '',
                'width': '' // <--- 3. 关闭时清除固定宽度，恢复 Bootstrap 的响应式能力
            });
        });
    }

    // --- Execution Flow ---
    // 1. Initial Calc
    currentRevisedData = reviseProjectData(rawTrackerData);

    // 2. Initial Render
    renderTracker(currentRevisedData);

    // 3. Init Handlers
    initZoomControls();
    initEditHandlers();

    // 4. Init Draggable Modal (别忘了这句，不然弹窗不能拖动)
    makeModalDraggable('#editMilestoneModal');
});