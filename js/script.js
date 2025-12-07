$(document).ready(function () {
    // --- Configuration ---
    const PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;
    
    // DEMO DATE: Set to a date visible in your data range
    // Change this to `new Date()` for production
    const CURRENT_DATE = new Date("2025-03-15"); 

    // --- Data (Same as before) ---
    const trackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025",
        "projects": [
            // ... (Use previous project data) ...
            {
                "project_id": "PRJ-001",
                "project_name": "E-Commerce Platform",
                "start_date": "2025-01-05",
                "milestones": [
                    { "name": "UI Design", "status_progress": 1.0, "planned_end": "2025-02-15", "actual_completion_date": "2025-02-10", "color": "#0d6efd" },
                    { "name": "Frontend", "status_progress": 1.0, "planned_end": "2025-03-25", "actual_completion_date": "2025-04-05", "color": "#198754" },
                    { "name": "Backend", "status_progress": 0.2, "planned_end": "2025-05-15", "actual_completion_date": null, "color": "#6f42c1" }
                ]
            },
            {
                "project_id": "PRJ-007",
                "project_name": "Cloud Infra Setup",
                "start_date": "2025-01-20",
                "milestones": [
                    { "name": "AWS Setup", "status_progress": 0.8, "planned_end": "2025-02-15", "actual_completion_date": null, "color": "#fd7e14" },
                    { "name": "K8s Config", "status_progress": 0.0, "planned_end": "2025-04-05", "actual_completion_date": null, "color": "#6f42c1" }
                ]
            },
            {
                "project_id": "PRJ-002",
                "project_name": "Mobile App Launch",
                "start_date": "2025-02-01",
                "milestones": [
                    { "name": "Requirement", "status_progress": 1.0, "planned_end": "2025-02-20", "actual_completion_date": "2025-02-20", "color": "#fd7e14" },
                    { "name": "Alpha Ver.", "status_progress": 0.4, "planned_end": "2025-05-10", "actual_completion_date": null, "color": "#20c997" }
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

    function renderTracker() {
        const $container = $('#projects-container');
        const $headerTicks = $('#header-ticks-container'); 
        const $mainTitle = $('#tracker-main-title'); 

        // 1. Setup
        $mainTitle.html(`${trackerData.tracker_title} <small class="text-muted fs-6">Target vs Actual</small>`);
        $container.empty();
        $headerTicks.empty(); 
        
        // Ensure container is relative for absolute positioning of the line
        $container.css('position', 'relative'); 

        // 2. Render Header
        let totalTimelineWidth = 0;
        for(let i=0; i < RENDER_MONTHS_COUNT; i++) {
            let targetMonthDate = new Date(TRACKER_START_DATE);
            targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
            let daysFromStart = getDaysDiff(TRACKER_START_DATE, targetMonthDate);
            let leftPos = daysFromStart * PIXELS_PER_DAY;
            let monthName = targetMonthDate.toLocaleString('default', { month: 'short' });
            
            $headerTicks.append(`<div class="time-mark" style="left: ${leftPos}px">${monthName}</div>`);
            totalTimelineWidth = leftPos + 100;
        }
        $headerTicks.css('min-width', totalTimelineWidth + 'px');

        // --- NEW: Render "Past Zone" (Gray Background) ---
        const todayOffsetDays = getDaysDiff(TRACKER_START_DATE, CURRENT_DATE);
        
        if (todayOffsetDays >= 0) {
            const todayLeft = todayOffsetDays * PIXELS_PER_DAY;

            // 1. Get Sidebar width
            const sidebarWidth = $('.header-corner-placeholder').outerWidth() || 220;

            // A. Header Marker (Label Only)
            // Stays in header container, relative to timeline start
            $headerTicks.append(`
                <div class="today-header-marker" style="left: ${todayLeft}px;">
                    <span class="today-label">Today</span>
                </div>
            `);

            // B. Past Zone (Gray Background)
            // Instead of a line, we render a box spanning from 0 to Today
            // z-index=5 ensures it sits BEHIND the bars (z=10+) but ABOVE the row background
            $container.append(`
                <div class="past-time-zone" style="width: ${todayLeft + sidebarWidth}px;"></div>
            `);
        }

        // 3. Render Projects
        trackerData.projects.forEach(project => {
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
            let currentPlanAnchor = project.start_date;
            let currentDemandAnchor = project.start_date;

            project.milestones.forEach(ms => {
                // ... (Keep existing Milestone Logic: Demand & Plan & Tails) ...
                
                // --- A. Demand ---
                const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);
                const demandWidth = Math.max(demandDuration * PIXELS_PER_DAY, 2);
                const demandLeft = demandOffset * PIXELS_PER_DAY;

                $rowContext.append(`
                    <div class="gantt-bar demand-bar" 
                         style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
                         title="Demand: ${ms.name}"></div>
                `);

                // --- B. Plan ---
                const actualDate = ms.actual_completion_date;
                const plannedDate = ms.planned_end;
                let solidBarEnd = plannedDate; 
                let tailType = null;
                let tailStart = null;
                let tailEnd = null;
                let effectiveEndDate = plannedDate;

                if (actualDate) {
                    if (new Date(actualDate) > new Date(plannedDate)) {
                        solidBarEnd = plannedDate; tailType = 'late'; tailStart = plannedDate; tailEnd = actualDate; effectiveEndDate = actualDate; 
                    } else if (new Date(actualDate) < new Date(plannedDate)) {
                        solidBarEnd = actualDate; tailType = 'early'; tailStart = actualDate; tailEnd = plannedDate; effectiveEndDate = actualDate; 
                    } else { effectiveEndDate = actualDate; }
                } else {
                    if (CURRENT_DATE > new Date(plannedDate)) {
                        solidBarEnd = plannedDate; tailType = 'late'; tailStart = plannedDate; tailEnd = CURRENT_DATE.toISOString().split('T')[0];
                        effectiveEndDate = tailEnd; 
                    }
                }

                const planDuration = getDaysDiff(currentPlanAnchor, solidBarEnd);
                const planOffset = getDaysDiff(TRACKER_START_DATE, currentPlanAnchor);
                const planWidth = Math.max(planDuration * PIXELS_PER_DAY, 2);
                const planLeft = planOffset * PIXELS_PER_DAY;
                const progressPct = Math.round(ms.status_progress * 100);

                let innerContent = '';
                if (planWidth > 60) {
                    innerContent = `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${progressPct}%</span></div>`;
                }

                $rowContext.append(`
                    <div class="gantt-bar plan-bar" 
                         style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};"
                         title="Plan: ${ms.name}">
                        <div class="progress-overlay" style="width: ${progressPct}%"></div>
                        ${innerContent}
                    </div>
                `);

                // 2. Render Tail (if exists)
                if (tailType) {
                    const tStart = new Date(tailStart);
                    const tEnd = new Date(tailEnd);
                    
                    const tailDuration = (tEnd - tStart) / (1000 * 60 * 60 * 24);
                    const tailOffset = getDaysDiff(TRACKER_START_DATE, tStart);
                    const tailWidth = Math.max(tailDuration * PIXELS_PER_DAY, 2);
                    const tailLeft = tailOffset * PIXELS_PER_DAY;
                    
                    const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                    
                    // Dynamic tooltip based on status
                    let tailTitle = "";
                    if (!actualDate && tailType === 'late') {
                        // "In Progress" Delay Case
                        tailTitle = `Overdue: ${Math.floor(tailDuration)} days (In Progress)`;
                    } else {
                        // Completed Case
                        tailTitle = tailType === 'late' ? `Overrun: ${Math.floor(tailDuration)} days` : `Saved Time: ${Math.floor(tailDuration)} days`;
                    }

                    $rowContext.append(`
                        <div class="gantt-bar ${tailClass}" 
                             style="left: ${tailLeft}px; width: ${tailWidth}px;"
                             title="${tailTitle}">
                        </div>
                    `);
                }

                currentDemandAnchor = demandEndDate;
                currentPlanAnchor = effectiveEndDate;
            });
        });
    }

    renderTracker();
});