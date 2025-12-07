$(document).ready(function () {
    // --- Configuration ---
    const PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;

    // --- Data with 'actual_completion_date' ---
    const trackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025",
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
                        "actual_completion_date": "2025-02-10", // Case: Early
                        "demand_due_date": "2025-02-15", 
                        "color": "#0d6efd" 
                    },
                    { 
                        "name": "Frontend", 
                        "status_progress": 1.0, 
                        "planned_end": "2025-03-25", 
                        "actual_completion_date": "2025-04-15", // Case: Late
                        "demand_due_date": "2025-03-25", 
                        "color": "#198754" 
                    },
                    { 
                        "name": "Backend", 
                        "status_progress": 0.2, 
                        "planned_end": "2025-05-15", 
                        "actual_completion_date": null, // Case: In Progress
                        "demand_due_date": "2025-05-01", 
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
                        "actual_completion_date": "2025-02-20", // Case: On Time
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
            },
            {
                "project_id": "PRJ-005",
                "project_name": "Legacy System Mig.",
                "start_date": "2025-01-01",
                "milestones": [
                    { "name": "Audit", "status_progress": 1.0, "planned_end": "2025-01-15", "actual_completion_date": "2025-01-10", "color": "#dc3545" },
                    { "name": "Strategy", "status_progress": 1.0, "planned_end": "2025-02-05", "actual_completion_date": "2025-02-15", "color": "#ffc107" },
                    { "name": "Execution", "status_progress": 0.1, "planned_end": "2025-08-01", "actual_completion_date": null, "color": "#0d6efd" }
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

        // 1. Set Title
        $mainTitle.html(`${trackerData.tracker_title} <small class="text-muted fs-6">Target vs Actual</small>`);

        // 2. Clear content
        $container.empty();
        $headerTicks.empty(); 

        // 3. Render Header & Calc Width
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

        // 4. Render Projects
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
                // --- A. DEMAND TRACK (Top Bar) ---
                const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);
                
                const demandWidth = Math.max(demandDuration * PIXELS_PER_DAY, 2);
                const demandLeft = demandOffset * PIXELS_PER_DAY;

                $rowContext.append(`
                    <div class="gantt-bar demand-bar" 
                         style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
                         title="Demand: ${ms.name} (Due: ${demandEndDate})">
                    </div>
                `);

                // --- B. PLAN TRACK (Bottom Bar with Actuals) ---
                
                const actualDate = ms.actual_completion_date;
                const plannedDate = ms.planned_end;
                
                // Determine visualization endpoints
                let solidBarEnd = plannedDate; 
                let tailType = null; // 'late' or 'early'
                let tailStart = null;
                let tailEnd = null;
                let effectiveEndDate = plannedDate; // Determines where the NEXT task starts

                if (actualDate) {
                    if (new Date(actualDate) > new Date(plannedDate)) {
                        // CASE: LATE
                        solidBarEnd = plannedDate;
                        tailType = 'late';
                        tailStart = plannedDate;
                        tailEnd = actualDate;
                        effectiveEndDate = actualDate; 
                    } else if (new Date(actualDate) < new Date(plannedDate)) {
                        // CASE: EARLY
                        solidBarEnd = actualDate;
                        tailType = 'early';
                        tailStart = actualDate;
                        tailEnd = plannedDate;
                        effectiveEndDate = actualDate; 
                    } else {
                        // CASE: ON TIME
                        effectiveEndDate = actualDate;
                    }
                }

                // 1. Render Solid Main Bar
                const planDuration = getDaysDiff(currentPlanAnchor, solidBarEnd);
                const planOffset = getDaysDiff(TRACKER_START_DATE, currentPlanAnchor);
                const planWidth = Math.max(planDuration * PIXELS_PER_DAY, 2);
                const planLeft = planOffset * PIXELS_PER_DAY;
                const progressPct = Math.round(ms.status_progress * 100);

                let innerContent = '';
                if (planWidth > 60) {
                    innerContent = `
                        <div class="plan-bar-content">
                            <span class="plan-name">${ms.name}</span>
                            <span class="plan-pct">${progressPct}%</span>
                        </div>
                    `;
                }

                $rowContext.append(`
                    <div class="gantt-bar plan-bar" 
                         style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};"
                         title="Plan: ${ms.name} (End: ${solidBarEnd})">
                        <div class="progress-overlay" style="width: ${progressPct}%"></div>
                        ${innerContent}
                    </div>
                `);

                // 2. Render Tail (if exists)
                if (tailType) {
                    const tailDuration = getDaysDiff(tailStart, tailEnd);
                    const tailOffset = getDaysDiff(TRACKER_START_DATE, tailStart);
                    const tailWidth = Math.max(tailDuration * PIXELS_PER_DAY, 2);
                    const tailLeft = tailOffset * PIXELS_PER_DAY;
                    
                    const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                    const tailTitle = tailType === 'late' ? `Overrun: ${tailEnd}` : `Saved Time: ${tailEnd}`;

                    $rowContext.append(`
                        <div class="gantt-bar ${tailClass}" 
                             style="left: ${tailLeft}px; width: ${tailWidth}px;"
                             title="${tailTitle}">
                        </div>
                    `);
                }

                // --- C. Update Anchors ---
                currentDemandAnchor = demandEndDate;
                currentPlanAnchor = effectiveEndDate;
            });
        });
    }

    renderTracker();
});