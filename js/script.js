$(document).ready(function () {
    // --- Configuration ---
    const PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;
    
    // DEMO DATE: Fixed to March 15, 2025 to demonstrate the dynamic delay logic
    // In production, change this to: const CURRENT_DATE = new Date();
    const CURRENT_DATE = new Date("2025-03-15"); 

    // --- Original Data ---
    const rawTrackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025 (Dynamic Revision)",
        "projects": [
            {
                "project_id": "PRJ-001",
                "project_name": "E-Commerce Platform",
                "start_date": "2025-01-05",
                "milestones": [
                    { 
                        "name": "UI Design", 
                        "status_progress": 1.0, 
                        "planned_end": "2025-02-15", 
                        "actual_completion_date": "2025-02-10", // Done: Early (-5 days)
                        "demand_due_date": "2025-02-14", 
                        "color": "#0d6efd" 
                    },
                    { 
                        "name": "Frontend", 
                        "status_progress": 1.0, 
                        "planned_end": "2025-03-25", 
                        "actual_completion_date": "2025-04-05", // Done: Late
                        "demand_due_date": "2025-03-25", 
                        "color": "#198754" 
                    },
                    { 
                        "name": "Backend", 
                        "status_progress": 0.0, 
                        "planned_end": "2025-05-15", 
                        "actual_completion_date": null,         // Future Task (Will be pushed)
                        "demand_due_date": "2025-05-01", 
                        "color": "#6f42c1" 
                    }
                ]
            },
            {
                "project_id": "PRJ-007",
                "project_name": "Cloud Infra Setup",
                "start_date": "2025-01-20",
                "milestones": [
                    { 
                        "name": "AWS Setup", 
                        "status_progress": 0.8, 
                        "planned_end": "2025-02-15", 
                        "actual_completion_date": null,         // In Progress & Overdue (Today is Mar 15)
                        "demand_due_date": "2025-02-15", 
                        "color": "#fd7e14" 
                    },
                    { 
                        "name": "K8s Config", 
                        "status_progress": 0.0, 
                        "planned_end": "2025-04-05", 
                        "actual_completion_date": null,         // Dependent Task (Should be pushed by AWS Setup)
                        "demand_due_date": "2025-03-30", 
                        "color": "#6f42c1" 
                    }
                ]
            },
            {
                "project_id": "PRJ-002",
                "project_name": "Mobile App Launch",
                "start_date": "2025-02-01",
                "milestones": [
                    { 
                        "name": "Requirement", 
                        "status_progress": 1.0, 
                        "planned_end": "2025-02-20", 
                        "actual_completion_date": "2025-02-20", // Done: On Time
                        "demand_due_date": "2025-02-25", 
                        "color": "#fd7e14" 
                    },
                    { 
                        "name": "Alpha Ver.", 
                        "status_progress": 0.4, 
                        "planned_end": "2025-05-10", 
                        "actual_completion_date": null,
                        "demand_due_date": "2025-05-10", 
                        "color": "#20c997" 
                    }
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
        // Deep clone to avoid mutating original data structure
        const revisedData = JSON.parse(JSON.stringify(originalData));

        revisedData.projects.forEach(project => {
            // "Cursor" tracks the valid start date for the NEXT task
            // Initialize with Project Start Date
            let chainCursor = new Date(project.start_date);
            
            // "Previous Plan End" tracks the original schedule chain to calculate duration
            let previousOriginalPlanEnd = new Date(project.start_date);

            project.milestones.forEach(ms => {
                // 1. Calculate Original Duration (Plan End - Previous Plan End)
                const originalPlanEnd = new Date(ms.planned_end);
                // Ensure min duration of 1 day to avoid bugs
                const durationDays = Math.max(1, getDaysDiff(previousOriginalPlanEnd, originalPlanEnd));

                // 2. Determine Revised Start & End
                // Rule: Task starts at the Chain Cursor (compact scheduling)
                const revisedStart = new Date(chainCursor);
                const revisedEnd = addDays(revisedStart, durationDays);

                // Store revised dates in the milestone object for the renderer
                ms.revised_start_date = revisedStart.toISOString().split('T')[0];
                ms.revised_end_date = revisedEnd.toISOString().split('T')[0];

                // 3. Update Cursor for the NEXT task
                if (ms.actual_completion_date) {
                    // CHECK 1: Task Completed
                    // Next task starts immediately after Actual Completion
                    chainCursor = new Date(ms.actual_completion_date);
                } else {
                    // Task In Progress
                    // CHECK 2: Check for Overdue against Today
                    if (CURRENT_DATE > revisedEnd) {
                        // Overdue! 
                        // Current task keeps its 'revisedEnd' (so we can draw the red tail),
                        // BUT the next task is pushed to Today.
                        chainCursor = new Date(CURRENT_DATE);
                    } else {
                        // On Track
                        // Next task starts after this task's revised end
                        chainCursor = new Date(revisedEnd);
                    }
                }

                // Update previous original end for the next loop's duration calculation
                previousOriginalPlanEnd = originalPlanEnd;
            });
        });

        return revisedData;
    }

    function renderTracker(data) {
        const $container = $('#projects-container');
        const $headerTicks = $('#header-ticks-container'); 
        const $mainTitle = $('#tracker-main-title'); 

        // 1. Setup
        $mainTitle.html(`${data.tracker_title} <small class="text-muted fs-6">Target vs Actual</small>`);
        $container.empty();
        $headerTicks.empty(); 
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

        // Render "Past Zone" & "Today Marker"
        const todayOffsetDays = getDaysDiff(TRACKER_START_DATE, CURRENT_DATE);
        if (todayOffsetDays >= 0) {
            const todayLeft = todayOffsetDays * PIXELS_PER_DAY;
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

        // 3. Render Projects using REVISED Data
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
            
            // NOTE: We don't need 'currentPlanAnchor' anymore because 'revised_start_date' 
            // is pre-calculated in reviseProjectData().
            let currentDemandAnchor = project.start_date;

            project.milestones.forEach(ms => {
                
                // --- A. Demand Track (Original Plan / Target) ---
                // Keeps using original logic (Project Start -> Planned/Demand End)
                // Note: Demand logic usually stays static or follows original chain.
                // Here we keep it simple: chained by original Planned End to show the baseline.
                const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);
                const demandWidth = Math.max(demandDuration * PIXELS_PER_DAY, 2);
                const demandLeft = demandOffset * PIXELS_PER_DAY;

                $rowContext.append(`
                    <div class="gantt-bar demand-bar" 
                         style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
                         title="Demand: ${ms.name} (Due: ${demandEndDate})"></div>
                `);

                // --- B. Plan Track (Revised / Actual) ---
                // Use the REVISED dates calculated in reviseProjectData()
                const revisedStart = ms.revised_start_date;
                const revisedEnd = ms.revised_end_date;
                const actualDate = ms.actual_completion_date;

                // Determine Tail Logic
                let solidBarEnd = revisedEnd; // Default: Bar ends at Revised Plan End
                let tailType = null;
                let tailStart = null;
                let tailEnd = null;

                if (actualDate) {
                    // Task Finished
                    // Compare Actual vs Revised Plan
                    if (new Date(actualDate) > new Date(revisedEnd)) {
                        // Late Completion
                        solidBarEnd = revisedEnd;
                        tailType = 'late';
                        tailStart = revisedEnd;
                        tailEnd = actualDate;
                    } else if (new Date(actualDate) < new Date(revisedEnd)) {
                        // Early Completion
                        solidBarEnd = actualDate;
                        tailType = 'early';
                        tailStart = actualDate;
                        tailEnd = revisedEnd;
                    } else {
                        solidBarEnd = actualDate;
                    }
                } else {
                    // Task In Progress
                    // Check against Today
                    if (CURRENT_DATE > new Date(revisedEnd)) {
                        // Overdue (Active Delay)
                        // Bar stays at Revised End, Tail goes to Today
                        solidBarEnd = revisedEnd;
                        tailType = 'late';
                        tailStart = revisedEnd;
                        tailEnd = CURRENT_DATE.toISOString().split('T')[0];
                    }
                }

                // Render Solid Bar (Using Revised Start)
                const planDuration = getDaysDiff(revisedStart, solidBarEnd);
                const planOffset = getDaysDiff(TRACKER_START_DATE, revisedStart);
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
                         title="Plan (Revised): ${ms.name} (${revisedStart} to ${solidBarEnd})">
                        <div class="progress-overlay" style="width: ${progressPct}%"></div>
                        ${innerContent}
                    </div>
                `);

                // Render Tail
                if (tailType) {
                    const tStart = new Date(tailStart);
                    const tEnd = new Date(tailEnd);
                    const tailDuration = (tEnd - tStart) / (1000 * 60 * 60 * 24);
                    const tailOffset = getDaysDiff(TRACKER_START_DATE, tStart);
                    const tailWidth = Math.max(tailDuration * PIXELS_PER_DAY, 2);
                    const tailLeft = tailOffset * PIXELS_PER_DAY;
                    const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                    
                    let tailTitle = "";
                    if (!actualDate && tailType === 'late') {
                         tailTitle = `Overdue: ${Math.floor(tailDuration)} days (In Progress)`;
                    } else {
                         tailTitle = tailType === 'late' ? `Overrun: ${Math.floor(tailDuration)} days` : `Saved Time: ${Math.floor(tailDuration)} days`;
                    }

                    $rowContext.append(`<div class="gantt-bar ${tailClass}" title="${tailTitle}" style="left: ${tailLeft}px; width: ${tailWidth}px;"></div>`);
                }

                // Update Anchors for Loop
                currentDemandAnchor = demandEndDate;
                // Note: We don't update currentPlanAnchor here because the loop relies on pre-calculated data
            });
        });
    }

    // --- Execute ---
    // 1. Calculate Revised Schedule
    const finalData = reviseProjectData(rawTrackerData);
    
    // 2. Render Chart
    renderTracker(finalData);
});