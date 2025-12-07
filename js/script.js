$(document).ready(function () {
    // --- Configuration ---
    const PIXELS_PER_DAY = 6; // Adjust width of days
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15; // Render enough months to scroll horizontally

    // --- Data Structure: Root Object with Title & Projects ---
    const trackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025", // Displayed in H3
        "projects": [
            {
                "project_id": "PRJ-001",
                "project_name": "E-Commerce Platform",
                "start_date": "2025-01-05",
                "milestones": [
                    { "name": "UI Design", "status_progress": 1.0, "planned_end": "2025-02-15", "demand_due_date": "2025-02-15", "color": "#0d6efd" },
                    { "name": "Frontend", "status_progress": 0.8, "planned_end": "2025-03-25", "demand_due_date": "2025-03-15", "color": "#198754" },
                    { "name": "Backend", "status_progress": 0.2, "planned_end": "2025-05-15", "demand_due_date": "2025-05-01", "color": "#6f42c1" }
                ]
            },
            {
                "project_id": "PRJ-002",
                "project_name": "Mobile App Launch",
                "start_date": "2025-02-01",
                "milestones": [
                    { "name": "Requirement", "status_progress": 1.0, "planned_end": "2025-02-20", "demand_due_date": "2025-02-25", "color": "#fd7e14" },
                    { "name": "Alpha Ver.", "status_progress": 0.4, "planned_end": "2025-05-10", "demand_due_date": "2025-05-10", "color": "#20c997" }
                ]
            },
            {
                "project_id": "PRJ-003",
                "project_name": "CRM Integration",
                "start_date": "2025-01-15",
                "milestones": [
                    { "name": "Setup", "status_progress": 1.0, "planned_end": "2025-02-01", "demand_due_date": "2025-02-01", "color": "#6610f2" },
                    { "name": "Data Migration", "status_progress": 0.9, "planned_end": "2025-03-10", "demand_due_date": "2025-03-01", "color": "#d63384" },
                    { "name": "Training", "status_progress": 0.0, "planned_end": "2025-04-01", "demand_due_date": "2025-04-01", "color": "#0dcaf0" }
                ]
            },
            {
                "project_id": "PRJ-004",
                "project_name": "Data Warehouse",
                "start_date": "2025-02-10",
                "milestones": [
                    { "name": "Schema Design", "status_progress": 1.0, "planned_end": "2025-03-01", "demand_due_date": "2025-02-28", "color": "#343a40" },
                    { "name": "ETL Pipeline", "status_progress": 0.5, "planned_end": "2025-05-20", "demand_due_date": "2025-05-15", "color": "#0d6efd" },
                    { "name": "Validation", "status_progress": 0.0, "planned_end": "2025-06-30", "demand_due_date": "2025-06-25", "color": "#198754" }
                ]
            },
            {
                "project_id": "PRJ-005",
                "project_name": "Legacy System Mig.",
                "start_date": "2025-01-01",
                "milestones": [
                    { "name": "Audit", "status_progress": 1.0, "planned_end": "2025-01-20", "demand_due_date": "2025-01-20", "color": "#dc3545" },
                    { "name": "Strategy", "status_progress": 1.0, "planned_end": "2025-02-10", "demand_due_date": "2025-02-10", "color": "#ffc107" },
                    { "name": "Execution", "status_progress": 0.3, "planned_end": "2025-08-01", "demand_due_date": "2025-07-15", "color": "#0d6efd" }
                ]
            },
            {
                "project_id": "PRJ-006",
                "project_name": "Security Audit",
                "start_date": "2025-03-01",
                "milestones": [
                    { "name": "Pen-Testing", "status_progress": 0.1, "planned_end": "2025-03-20", "demand_due_date": "2025-03-20", "color": "#212529" },
                    { "name": "Fixes", "status_progress": 0.0, "planned_end": "2025-04-15", "demand_due_date": "2025-04-10", "color": "#198754" }
                ]
            },
            {
                "project_id": "PRJ-007",
                "project_name": "Cloud Infra Setup",
                "start_date": "2025-01-20",
                "milestones": [
                    { "name": "AWS Setup", "status_progress": 1.0, "planned_end": "2025-02-15", "demand_due_date": "2025-02-15", "color": "#fd7e14" },
                    { "name": "K8s Config", "status_progress": 0.7, "planned_end": "2025-04-05", "demand_due_date": "2025-03-30", "color": "#6f42c1" }
                ]
            },
            {
                "project_id": "PRJ-008",
                "project_name": "AI Recommendation",
                "start_date": "2025-04-01",
                "milestones": [
                    { "name": "Data Collection", "status_progress": 0.0, "planned_end": "2025-05-01", "demand_due_date": "2025-05-01", "color": "#0dcaf0" },
                    { "name": "Model Training", "status_progress": 0.0, "planned_end": "2025-07-01", "demand_due_date": "2025-06-20", "color": "#6610f2" }
                ]
            },
            {
                "project_id": "PRJ-009",
                "project_name": "Payment Gateway v2",
                "start_date": "2025-02-15",
                "milestones": [
                    { "name": "Compliance", "status_progress": 0.5, "planned_end": "2025-03-15", "demand_due_date": "2025-03-10", "color": "#d63384" },
                    { "name": "Integration", "status_progress": 0.0, "planned_end": "2025-05-01", "demand_due_date": "2025-04-30", "color": "#0d6efd" }
                ]
            },
            {
                "project_id": "PRJ-010",
                "project_name": "Internal Dashboard",
                "start_date": "2025-01-10",
                "milestones": [
                    { "name": "UX Research", "status_progress": 1.0, "planned_end": "2025-01-30", "demand_due_date": "2025-01-30", "color": "#20c997" },
                    { "name": "Dev Phase 1", "status_progress": 1.0, "planned_end": "2025-03-01", "demand_due_date": "2025-03-01", "color": "#0dcaf0" },
                    { "name": "Dev Phase 2", "status_progress": 0.2, "planned_end": "2025-05-01", "demand_due_date": "2025-05-01", "color": "#fd7e14" }
                ]
            },
            {
                "project_id": "PRJ-011",
                "project_name": "Marketing Website",
                "start_date": "2025-03-10",
                "milestones": [
                    { "name": "Content", "status_progress": 0.2, "planned_end": "2025-04-01", "demand_due_date": "2025-03-30", "color": "#ffc107" },
                    { "name": "Design", "status_progress": 0.0, "planned_end": "2025-04-20", "demand_due_date": "2025-04-15", "color": "#dc3545" }
                ]
            },
            {
                "project_id": "PRJ-012",
                "project_name": "Global Rollout",
                "start_date": "2025-05-01",
                "milestones": [
                    { "name": "Localization", "status_progress": 0.0, "planned_end": "2025-06-01", "demand_due_date": "2025-06-01", "color": "#6f42c1" },
                    { "name": "Launch", "status_progress": 0.0, "planned_end": "2025-07-01", "demand_due_date": "2025-07-01", "color": "#198754" }
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
        const $mainTitle = $('#tracker-main-title'); // Select the H3

        // 1. Set the Title from JSON dynamically
        // Using .html() to allow keeping the <small> tag if desired, or replace entirely
        $mainTitle.html(`${trackerData.tracker_title} <small class="text-muted fs-6">Target vs Actual</small>`);

        // 2. Clear previous content
        $container.empty();
        $headerTicks.empty(); 

        // --- Calculate Timeline Width ---
        let totalTimelineWidth = 0;

        // 3. Render Timeline Header
        for(let i=0; i < RENDER_MONTHS_COUNT; i++) {
            let targetMonthDate = new Date(TRACKER_START_DATE);
            targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
            
            let daysFromStart = getDaysDiff(TRACKER_START_DATE, targetMonthDate);
            let leftPos = daysFromStart * PIXELS_PER_DAY;
            
            let monthName = targetMonthDate.toLocaleString('default', { month: 'short' });
            
            $headerTicks.append(`<div class="time-mark" style="left: ${leftPos}px">${monthName}</div>`);
            
            // Add buffer to ensure no cutoff for the last month
            totalTimelineWidth = leftPos + 100;
        }

        // Apply calculated width to header container to enable scrolling
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