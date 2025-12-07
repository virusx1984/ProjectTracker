$(document).ready(function () {
    // --- Configuration ---
    // CHANGED: Changed from const to let to allow zooming
    let pixelsPerDay = 6;
    const DEFAULT_PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;

    // DEMO DATE
    const CURRENT_DATE = new Date("2025-03-15");

    // --- Data ---
    const rawTrackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025",
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
        for (let i = 0; i < RENDER_MONTHS_COUNT; i++) {
            let targetMonthDate = new Date(TRACKER_START_DATE);
            targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
            let daysFromStart = getDaysDiff(TRACKER_START_DATE, targetMonthDate);
            // USAGE: Use the variable pixelsPerDay
            let leftPos = daysFromStart * pixelsPerDay;
            let monthName = targetMonthDate.toLocaleString('default', { month: 'short' });

            $headerTicks.append(`<div class="time-mark" style="left: ${leftPos}px">${monthName}</div>`);
            totalTimelineWidth = leftPos + 100;
        }
        $headerTicks.css('min-width', totalTimelineWidth + 'px');

        // Render "Past Zone" & "Today Marker"
        const todayOffsetDays = getDaysDiff(TRACKER_START_DATE, CURRENT_DATE);
        if (todayOffsetDays >= 0) {
            // USAGE: Use the variable pixelsPerDay
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
        data.projects.forEach(project => {
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

            project.milestones.forEach(ms => {

                // --- A. Demand Track ---
                const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);

                // USAGE: Use the variable pixelsPerDay
                const demandWidth = Math.max(demandDuration * pixelsPerDay, 2);
                const demandLeft = demandOffset * pixelsPerDay;

                const demandPopover = `Demand: ${ms.name}<br>Due: ${demandEndDate}`;

                $rowContext.append(`
                    <div class="gantt-bar demand-bar" 
                         style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
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

                // USAGE: Use the variable pixelsPerDay
                const planWidth = Math.max(planDuration * pixelsPerDay, 2);
                const planLeft = planOffset * pixelsPerDay;
                const progressPct = Math.round(ms.status_progress * 100);

                const popContent = createPopoverContent(ms, revisedStart, solidBarEnd, statusInfo);

                let innerContent = '';
                // Adjust text threshold based on zoom level (show text earlier if zoomed in)
                if (planWidth > 60) {
                    innerContent = `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${progressPct}%</span></div>`;
                }

                $rowContext.append(`
                    <div class="gantt-bar plan-bar" 
                         style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};"
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
                    // USAGE: Use the variable pixelsPerDay
                    const tailWidth = Math.max(tailDuration * pixelsPerDay, 2);
                    const tailLeft = tailOffset * pixelsPerDay;
                    const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';

                    const tailPopover = tailType === 'late'
                        ? `Delay Segment<br>From: ${tailStart}<br>To: ${tailEnd}`
                        : `Saved Segment<br>Orig End: ${tailEnd}`;

                    $rowContext.append(`<div class="gantt-bar ${tailClass}" 
                        style="left: ${tailLeft}px; width: ${tailWidth}px;"
                        data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-content="${tailPopover}"></div>`);
                }

                currentDemandAnchor = demandEndDate;
            });
        });

        const popoverTriggerList = document.querySelectorAll('[data-bs-toggle="popover"]');
        [...popoverTriggerList].map(popoverTriggerEl => new bootstrap.Popover(popoverTriggerEl));
    }

    // --- NEW: Zoom Control Logic ---
    function initZoomControls(finalData) {
        $('#btn-zoom-in').click(function () {
            pixelsPerDay += 2; // Increase scale
            if (pixelsPerDay > 20) pixelsPerDay = 20; // Max zoom
            renderTracker(finalData);
        });

        $('#btn-zoom-out').click(function () {
            pixelsPerDay -= 2; // Decrease scale
            if (pixelsPerDay < 2) pixelsPerDay = 2; // Min zoom
            renderTracker(finalData);
        });

        $('#btn-zoom-reset').click(function () {
            pixelsPerDay = DEFAULT_PIXELS_PER_DAY;
            renderTracker(finalData);
        });
    }

    // --- Execute ---
    const finalData = reviseProjectData(rawTrackerData);

    // Initialize Renderer
    renderTracker(finalData);

    // Initialize Controls
    initZoomControls(finalData);
});