$(document).ready(function () {
    // --- Configuration ---
    const PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 12; // Render header for 12 months

    // --- Sample Data ---
    const projectData = [
        {
            "project_id": "PRJ-001",
            "project_name": "E-Commerce Platform",
            "start_date": "2025-01-05",
            "milestones": [
                {
                    "name": "UI Design",
                    "status_progress": 1.0,
                    "planned_end": "2025-02-15",
                    "demand_due_date": "2025-02-15",
                    "color": "#0d6efd"
                },
                {
                    "name": "Frontend Dev",
                    "status_progress": 0.6,
                    "planned_end": "2025-03-25",
                    "demand_due_date": "2025-03-15",
                    "color": "#198754"
                },
                {
                    "name": "Backend API",
                    "status_progress": 0.2,
                    "planned_end": "2025-05-15",
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
                    "demand_due_date": "2025-02-25",
                    "color": "#fd7e14"
                },
                {
                    "name": "Alpha Ver.",
                    "status_progress": 0.3,
                    "planned_end": "2025-05-10",
                    "demand_due_date": "2025-05-10",
                    "color": "#20c997"
                }
            ]
        }
    ];

    // --- Helpers ---
    function getDaysDiff(start, end) {
        const s = new Date(start);
        const e = new Date(end);
        return (e - s) / (1000 * 60 * 60 * 24);
    }

    function renderTracker() {
        const $container = $('#projects-container');
        const $headerTicks = $('#header-ticks-container'); 

        // 1. Clear previous content
        $container.empty();
        $headerTicks.empty(); 

        // 2. Render Timeline Header
        // FIXED: Use real Date objects to calculate position instead of assuming 30 days per month
        for(let i=0; i < RENDER_MONTHS_COUNT; i++) {
            // Calculate exact date for the start of the month
            let targetMonthDate = new Date(TRACKER_START_DATE);
            targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
            
            // Calculate exact pixels from start
            let daysFromStart = getDaysDiff(TRACKER_START_DATE, targetMonthDate);
            let leftPos = daysFromStart * PIXELS_PER_DAY;
            
            let monthName = targetMonthDate.toLocaleString('default', { month: 'short' });
            
            $headerTicks.append(`<div class="time-mark" style="left: ${leftPos}px">${monthName}</div>`);
        }

        // 3. Render Projects
        projectData.forEach(project => {
            let projectHTML = `
                <div class="project-row">
                    <div class="project-name-label">
                        <div class="fw-bold text-dark">${project.project_name}</div>
                        <div style="font-size:10px; color:#6c757d; margin-top:4px;">
                            ID: ${project.project_id}
                        </div>
                    </div>
                    <div class="milestone-container" id="milestones-${project.project_id}"></div>
                </div>
            `;
            $container.append(projectHTML);

            const $rowContext = $(`#milestones-${project.project_id}`);

            // Initialize Dual Track Anchors
            let currentPlanAnchor = project.start_date;
            let currentDemandAnchor = project.start_date;

            project.milestones.forEach(ms => {
                // --- A. DEMAND TRACK (Top Bar) ---
                const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                
                const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);
                
                const demandWidth = Math.max(demandDuration * PIXELS_PER_DAY, 2);
                const demandLeft = demandOffset * PIXELS_PER_DAY;

                const demandHTML = `
                    <div class="gantt-bar demand-bar" 
                         style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
                         title="Demand: ${ms.name} (Due: ${demandEndDate})">
                    </div>
                `;
                $rowContext.append(demandHTML);

                // --- B. PLAN TRACK (Bottom Bar) ---
                const planDuration = getDaysDiff(currentPlanAnchor, ms.planned_end);
                const planOffset = getDaysDiff(TRACKER_START_DATE, currentPlanAnchor);
                
                const planWidth = Math.max(planDuration * PIXELS_PER_DAY, 2);
                const planLeft = planOffset * PIXELS_PER_DAY;
                const progressPct = Math.round(ms.status_progress * 100);

                // Determine if text should be displayed (Threshold: 60px)
                let innerContent = '';
                if (planWidth > 60) {
                    innerContent = `
                        <div class="plan-bar-content">
                            <span class="plan-name">${ms.name}</span>
                            <span class="plan-pct">${progressPct}%</span>
                        </div>
                    `;
                }

                const planHTML = `
                    <div class="gantt-bar plan-bar" 
                         style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};"
                         title="Plan: ${ms.name} (End: ${ms.planned_end}) - ${progressPct}%">
                        <div class="progress-overlay" style="width: ${progressPct}%"></div>
                        ${innerContent}
                    </div>
                `;
                $rowContext.append(planHTML);

                // --- C. Update Anchors ---
                currentDemandAnchor = demandEndDate;
                currentPlanAnchor = ms.planned_end;
            });
        });
    }

    // Execute
    renderTracker();
});