$(document).ready(function () {
    // --- Configuration ---
    let pixelsPerDay = 6;
    const DEFAULT_PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;
    const CURRENT_DATE = new Date("2025-03-15");

    // Predefined Colors
    const PREDEFINED_COLORS = [
        { name: "Blue", code: "#0d6efd" },
        { name: "Green", code: "#198754" },
        { name: "Purple", code: "#6f42c1" },
        { name: "Orange", code: "#fd7e14" },
        { name: "Teal", code: "#20c997" },
        { name: "Red", code: "#dc3545" },
        { name: "Gray", code: "#6c757d" }
    ];

    // --- Global State ---
    let currentFilter = 'ALL';
    let currentRevisedData = null;
    let currentProcessedStats = null;

    // --- Data Source ---
    const rawTrackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025 (Dashboard)",
        "groups": [
            {
                "group_id": "GRP-01",
                "group_name": "Digital Transformation",
                "is_expanded": true,
                "projects": [
                    {
                        "project_id": "PRJ-001",
                        "project_name": "E-Commerce Platform",
                        "description": "Key initiative for Q1 revenue growth.",
                        "start_date": "2025-01-05",
                        "milestones": [
                            { "name": "UI Design", "description": "Finalize Figma prototypes.", "status_progress": 1.0, "planned_end": "2025-02-15", "actual_completion_date": "2025-02-10", "demand_due_date": "2025-02-15", "color": "#0d6efd" },
                            { "name": "Frontend", "description": "React framework implementation.", "status_progress": 0.6, "planned_end": "2025-03-25", "actual_completion_date": null, "demand_due_date": "2025-03-25", "color": "#198754" },
                            { "name": "Backend", "description": "API development and DB setup.", "status_progress": 0.0, "planned_end": "2025-05-15", "actual_completion_date": null, "demand_due_date": "2025-05-01", "color": "#6f42c1" }
                        ]
                    },
                    {
                        "project_id": "PRJ-002",
                        "project_name": "Mobile App Launch",
                        "description": "iOS and Android MVP.",
                        "start_date": "2025-02-01",
                        "milestones": [
                            { "name": "Requirement", "description": "", "status_progress": 1.0, "planned_end": "2025-02-20", "actual_completion_date": "2025-02-20", "demand_due_date": "2025-02-25", "color": "#fd7e14" },
                            { "name": "Alpha Ver.", "description": "", "status_progress": 0.4, "planned_end": "2025-05-10", "actual_completion_date": null, "demand_due_date": "2025-05-10", "color": "#20c997" }
                        ]
                    }
                ]
            },
            {
                "group_id": "GRP-02",
                "group_name": "Infrastructure Upgrade",
                "is_expanded": true,
                "projects": [
                    {
                        "project_id": "PRJ-007",
                        "project_name": "Cloud Infra Setup",
                        "description": "Migration to AWS.",
                        "start_date": "2025-01-20",
                        "milestones": [
                            { "name": "AWS Setup", "description": "VPC and EC2 config.", "status_progress": 0.8, "planned_end": "2025-02-15", "actual_completion_date": null, "demand_due_date": "2025-02-15", "color": "#fd7e14" },
                            { "name": "K8s Config", "description": "", "status_progress": 0.0, "planned_end": "2025-04-05", "actual_completion_date": null, "demand_due_date": "2025-03-30", "color": "#6f42c1" }
                        ]
                    }
                ]
            }
        ]
    };

    // --- Helpers ---
    function getDaysDiff(start, end) {
        const s = new Date(start);
        const e = new Date(end);
        s.setHours(12, 0, 0, 0);
        e.setHours(12, 0, 0, 0);
        return Math.round((e - s) / (1000 * 60 * 60 * 24));
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    // --- CORE LOGIC: Dynamic Schedule Revision ---
    function reviseProjectData(originalData) {
        const revisedData = JSON.parse(JSON.stringify(originalData));

        revisedData.groups.forEach(group => {
            group.projects.forEach(project => {
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
        });
        return revisedData;
    }

    // --- Status Calculation Logic ---
    function calculateSingleProjectStatus(project) {
        if (!project.milestones || project.milestones.length === 0) {
            return { code: 'NO_DATA', label: "No Data", class: "bg-secondary", priority: 0 };
        }

        const lastMs = project.milestones[project.milestones.length - 1];
        const revisedEnd = new Date(lastMs.revised_end_date);
        const originalPlan = new Date(lastMs.planned_end);
        const demandDate = new Date(lastMs.demand_due_date || lastMs.planned_end);

        const isInternalDelayed = revisedEnd > originalPlan;
        const isExternalRisk = revisedEnd > demandDate;

        if (isExternalRisk) {
            if (isInternalDelayed) {
                return { code: 'CRITICAL', label: "Critical", class: "bg-critical", priority: 4 };
            } else {
                return { code: 'PLAN_FAIL', label: "Plan Fail", class: "bg-danger", priority: 3 };
            }
        } else {
            if (isInternalDelayed) {
                return { code: 'BUFFER_USED', label: "Buffer Used", class: "bg-warning", priority: 2 };
            } else {
                return { code: 'EXCELLENT', label: "Excellent", class: "bg-success", priority: 1 };
            }
        }
    }

    function calculateGroupStatus(group) {
        let maxPriority = 0;
        let worstStatus = { class: 'bg-secondary' };

        group.projects.forEach(p => {
            const s = p._computedStatus;
            if (s.priority > maxPriority) {
                maxPriority = s.priority;
                worstStatus = s;
            }
        });
        return worstStatus;
    }

    function preprocessData(data) {
        const counts = { ALL: 0, EXCELLENT: 0, BUFFER_USED: 0, PLAN_FAIL: 0, CRITICAL: 0 };
        data.groups.forEach(group => {
            group.projects.forEach(project => {
                const status = calculateSingleProjectStatus(project);
                project._computedStatus = status;
                counts.ALL++;
                if (counts.hasOwnProperty(status.code)) counts[status.code]++;
            });
            group._computedStatus = calculateGroupStatus(group);
        });
        return { counts, data };
    }

    // --- Rendering Functions ---
    function createPopoverContent(ms, startDate, endDate, status) {
        let badgeClass = 'bg-secondary';
        let statusText = 'Pending';

        if (ms.status_progress === 1.0) { badgeClass = 'bg-success'; statusText = 'Done'; }
        else if (status.isOverdue) { badgeClass = 'bg-danger'; statusText = 'Overdue'; }
        else if (ms.status_progress > 0) { badgeClass = 'bg-primary'; statusText = 'In Progress'; }

        const progressPct = Math.round(ms.status_progress * 100);

        return `
            <div class="popover-body-content">
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <strong style="color:${ms.color}">${ms.name}</strong>
                    <span class="badge ${badgeClass}">${statusText}</span>
                </div>
                ${ms.description ? `<div class="mb-2 text-muted small"><em>${ms.description}</em></div>` : ''}
                <div class="info-row"><span class="icon">📅</span> <span>${startDate} ➝ ${endDate}</span></div>
                <div class="info-row"><span class="icon">⏱️</span> <span>Duration: <b>${ms.duration_days} Days</b></span></div>
                <div class="info-row"><span class="icon">📊</span> <span>Progress: <b>${progressPct}%</b></span></div>
                ${status.extraInfo ? `<div class="info-row text-danger mt-1 border-top pt-1"><small>${status.extraInfo}</small></div>` : ''}
                <div class="mt-2 text-center text-muted" style="font-size:10px; border-top:1px solid #eee; padding-top:4px;"><i>(Click bar to edit)</i></div>
            </div>
        `;
    }

    function renderDashboardStats(counts) {
        const $container = $('#dashboard-stats-container');
        $container.empty();
        const cardsConfig = [
            { code: 'ALL', label: 'All Projects', colorClass: 'bg-primary' },
            { code: 'EXCELLENT', label: 'Excellent', colorClass: 'bg-success' },
            { code: 'BUFFER_USED', label: 'Buffer Used', colorClass: 'bg-warning' },
            { code: 'PLAN_FAIL', label: 'Plan Fail', colorClass: 'bg-danger' },
            { code: 'CRITICAL', label: 'Critical', colorClass: 'bg-critical' }
        ];

        cardsConfig.forEach(cfg => {
            const count = counts[cfg.code] || 0;
            const isActive = currentFilter === cfg.code ? 'active' : '';
            $container.append(`
                <div class="stat-card ${isActive}" data-filter="${cfg.code}">
                    <div class="color-bar ${cfg.colorClass}"></div>
                    <div class="stat-count">${count}</div>
                    <div class="stat-label">${cfg.label}</div>
                </div>
            `);
        });

        $('.stat-card').click(function () {
            const newFilter = $(this).data('filter');
            if (newFilter !== currentFilter) {
                currentFilter = newFilter;
                $('.stat-card').removeClass('active');
                $(this).addClass('active');
                renderTracker(currentRevisedData);
            }
        });
    }

    function renderTracker(data) {
        const $container = $('#projects-container');
        const $headerTicks = $('#header-ticks-container');
        $container.empty();
        $headerTicks.empty();
        $container.css('position', 'relative');

        // 1. Header
        let totalTimelineWidth = 0;
        const SHOW_DAYS_THRESHOLD = 4;
        for (let i = 0; i < RENDER_MONTHS_COUNT; i++) {
            let targetMonthDate = new Date(TRACKER_START_DATE);
            targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
            let daysFromStart = getDaysDiff(TRACKER_START_DATE, targetMonthDate);
            let leftPos = daysFromStart * pixelsPerDay;
            let monthName = targetMonthDate.toLocaleString('default', { month: 'short' });

            $headerTicks.append(`<div class="time-mark" style="left: ${leftPos}px">${monthName}</div>`);

            let daysInMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();
            if (pixelsPerDay >= SHOW_DAYS_THRESHOLD) {
                let step = (pixelsPerDay >= 18) ? 1 : ((pixelsPerDay >= 10) ? 5 : 15);
                for (let d = 1; d <= daysInMonth; d++) {
                    if (d % step === 0 && d !== 1) {
                        if (step > 1 && d >= 30) continue;
                        let dayDate = new Date(targetMonthDate);
                        dayDate.setDate(d);
                        let dayOffset = getDaysDiff(TRACKER_START_DATE, dayDate);
                        $headerTicks.append(`<div class="day-tick" style="left: ${dayOffset * pixelsPerDay}px">${d}</div>`);
                    }
                }
            }
            totalTimelineWidth = leftPos + (daysInMonth * pixelsPerDay);
        }
        $headerTicks.css('min-width', totalTimelineWidth + 'px');

        const todayOffsetDays = getDaysDiff(TRACKER_START_DATE, CURRENT_DATE);
        if (todayOffsetDays >= 0) {
            const todayLeft = todayOffsetDays * pixelsPerDay;
            const sidebarWidth = $('.header-corner-placeholder').outerWidth() || 220;
            $headerTicks.append(`<div class="today-header-marker" style="left: ${todayLeft}px;"><span class="today-label">Today</span></div>`);
            $container.append(`<div class="past-time-zone" style="width: ${todayLeft + sidebarWidth}px;"></div>`);
        }

        // 2. Groups & Projects
        let htmlBuffer = "";
        let visibleCount = 0;

        data.groups.forEach((group, gIndex) => {
            const matchingProjects = group.projects.filter(p => currentFilter === 'ALL' || p._computedStatus.code === currentFilter);
            if (matchingProjects.length === 0) return;

            // Prepare Group Visuals
            let minStart = null, maxEnd = null, maxDemandEnd = null, minProgressDate = null;
            const groupStats = { 'CRITICAL': 0, 'PLAN_FAIL': 0, 'BUFFER_USED': 0, 'EXCELLENT': 0 };
            let totalProjects = 0;

            group.projects.forEach(p => {
                const pStart = new Date(p.start_date);
                if (!minStart || pStart < minStart) minStart = pStart;
                if (!maxEnd || pStart > maxEnd) maxEnd = pStart;
                if (!maxDemandEnd || pStart > maxDemandEnd) maxDemandEnd = pStart;

                p.milestones.forEach(ms => {
                    const msStart = new Date(ms.revised_start_date);
                    let msEnd = new Date(ms.revised_end_date);
                    if (!ms.actual_completion_date && CURRENT_DATE > msEnd) msEnd = new Date(CURRENT_DATE);

                    if (msStart < minStart) minStart = msStart;
                    if (msEnd > maxEnd) maxEnd = msEnd;

                    const msDemand = new Date(ms.demand_due_date || ms.planned_end);
                    if (msDemand > maxDemandEnd) maxDemandEnd = msDemand;
                });

                // Calculate Solid Progress
                let pVisualDate = new Date(pStart);
                for (let i = 0; i < p.milestones.length; i++) {
                    const ms = p.milestones[i];
                    const msStart = new Date(ms.revised_start_date);
                    let msEnd = new Date(ms.revised_end_date);
                    if (!ms.actual_completion_date && CURRENT_DATE > msEnd) msEnd = new Date(CURRENT_DATE);

                    if (ms.status_progress === 1.0) {
                        if (msEnd > pVisualDate) pVisualDate = msEnd;
                    } else if (ms.status_progress > 0) {
                        const duration = Math.max(1, getDaysDiff(msStart, msEnd));
                        const doneDays = Math.round(duration * ms.status_progress);
                        const partialDate = new Date(msStart);
                        partialDate.setDate(partialDate.getDate() + doneDays);
                        if (partialDate > pVisualDate) pVisualDate = partialDate;
                        break;
                    } else break;
                }
                if (!minProgressDate || pVisualDate < minProgressDate) minProgressDate = pVisualDate;

                const code = p._computedStatus.code;
                if (groupStats.hasOwnProperty(code)) groupStats[code]++;
                totalProjects++;
            });

            // HTML Generation
            let ghostBarHtml = '';
            if (minStart && maxEnd) {
                const gLeft = getDaysDiff(TRACKER_START_DATE, minStart) * pixelsPerDay;
                const gWidth = getDaysDiff(minStart, maxEnd) * pixelsPerDay;
                let fillWidth = 0, dateLabel = "N/A";
                if (minProgressDate && minProgressDate > minStart) {
                    fillWidth = Math.max(0, getDaysDiff(minStart, minProgressDate) * pixelsPerDay);
                    if (fillWidth > gWidth) fillWidth = gWidth;
                    dateLabel = minProgressDate.toLocaleString('default', { month: 'short', day: 'numeric' });
                }
                ghostBarHtml = `<div class="group-ghost-bar" style="left: ${gLeft}px; width: ${gWidth}px;"><div class="ghost-progress-fill" style="width: ${fillWidth}px;" title="Overall Progress to: ${dateLabel}" data-bs-toggle="tooltip"></div></div>`;
            }

            let demandStripHtml = '';
            if (minStart && maxDemandEnd) {
                const dLeft = getDaysDiff(TRACKER_START_DATE, minStart) * pixelsPerDay;
                const dWidth = getDaysDiff(minStart, maxDemandEnd) * pixelsPerDay;
                demandStripHtml = `<div class="group-demand-strip" style="left: ${dLeft}px; width: ${dWidth}px;" title="Demand/Target Limit: ${maxDemandEnd.toISOString().split('T')[0]}" data-bs-toggle="tooltip"></div>`;
            }

            let healthBarSegments = '';
            if (totalProjects > 0) {
                const colorMap = { 'CRITICAL': 'bg-critical', 'PLAN_FAIL': 'bg-danger', 'BUFFER_USED': 'bg-warning', 'EXCELLENT': 'bg-success' };
                ['CRITICAL', 'PLAN_FAIL', 'BUFFER_USED', 'EXCELLENT'].forEach(code => {
                    const count = groupStats[code];
                    if (count > 0) {
                        const pct = (count / totalProjects) * 100;
                        healthBarSegments += `<div class="health-segment ${colorMap[code]}" style="width: ${pct}%" title="${code}: ${count}"></div>`;
                    }
                });
            }

            const grpStatus = group._computedStatus;
            const isExpanded = (currentFilter !== 'ALL') ? true : group.is_expanded;
            const toggleIcon = isExpanded ? '<i class="bi bi-chevron-down"></i>' : '<i class="bi bi-chevron-right"></i>';

            htmlBuffer += `
                <div class="group-row" data-g-idx="${gIndex}">
                    <div class="group-name-label">
                        <div class="status-strip ${grpStatus.class}"></div>
                        <span class="group-toggle-icon">${toggleIcon}</span>
                        <div class="d-flex flex-column w-100 pe-2">
                            <div class="d-flex justify-content-between align-items-center"><span>${group.group_name}</span><span class="badge bg-secondary" style="font-size:9px">${matchingProjects.length}</span></div>
                            <div class="group-health-bar">${healthBarSegments}</div>
                        </div>
                    </div>
                    <div class="milestone-container" style="min-width: ${totalTimelineWidth}px">${demandStripHtml}${ghostBarHtml}</div>
                </div>
            `;

            if (isExpanded) {
                group.projects.forEach((project, pIndex) => {
                    const status = project._computedStatus;
                    if (currentFilter !== 'ALL' && status.code !== currentFilter) return;
                    visibleCount++;
                    const statusStrip = `<div class="status-strip ${status.class}" data-bs-toggle="tooltip" data-bs-placement="right" title="Status: ${status.label}"></div>`;

                    htmlBuffer += `
                        <div class="project-row">
                            <div class="project-name-label">
                                ${statusStrip}
                                <div class="fw-bold text-dark text-truncate project-name-clickable" data-g-idx="${gIndex}" data-p-idx="${pIndex}" title="Click to Edit Project Structure">${project.project_name}</div>
                                <div style="font-size:10px; color:#6c757d; margin-top:4px;">ID: ${project.project_id}</div>
                            </div>
                            <div class="milestone-container" id="milestones-${project.project_id}" style="min-width: ${totalTimelineWidth}px">
                    `;

                    let currentDemandAnchor = project.start_date;
                    project.milestones.forEach((ms, mIndex) => {
                        const demandEndDate = ms.demand_due_date || ms.planned_end;
                        const demandLeft = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor) * pixelsPerDay;
                        const demandWidth = Math.max(getDaysDiff(currentDemandAnchor, demandEndDate) * pixelsPerDay, 2);
                        htmlBuffer += `<div class="gantt-bar demand-bar clickable" style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top" data-bs-content="Demand: ${ms.name}<br>Due: ${demandEndDate}"></div>`;

                        const revisedStart = ms.revised_start_date;
                        const revisedEnd = ms.revised_end_date;
                        const actualDate = ms.actual_completion_date;
                        let solidBarEnd = revisedEnd, tailType = null, tailStart = null, tailEnd = null;

                        if (actualDate) {
                            if (new Date(actualDate) > new Date(revisedEnd)) { solidBarEnd = revisedEnd; tailType = 'late'; tailStart = revisedEnd; tailEnd = actualDate; }
                            else if (new Date(actualDate) < new Date(revisedEnd)) { solidBarEnd = actualDate; tailType = 'early'; tailStart = actualDate; tailEnd = revisedEnd; }
                            else { solidBarEnd = actualDate; }
                        } else if (CURRENT_DATE > new Date(revisedEnd)) {
                            solidBarEnd = revisedEnd; tailType = 'late'; tailStart = revisedEnd; tailEnd = CURRENT_DATE.toISOString().split('T')[0];
                        }

                        const planLeft = getDaysDiff(TRACKER_START_DATE, revisedStart) * pixelsPerDay;
                        const planWidth = Math.max(getDaysDiff(revisedStart, solidBarEnd) * pixelsPerDay, 2);
                        const progressPct = Math.round(ms.status_progress * 100);
                        const statusInfo = { isOverdue: !actualDate && CURRENT_DATE > new Date(revisedEnd) };
                        if (statusInfo.isOverdue) statusInfo.extraInfo = `🔥 Overdue: ${Math.floor(getDaysDiff(revisedEnd, CURRENT_DATE))} days`;
                        else if (tailType === 'late') statusInfo.extraInfo = `⚠️ Late by ${Math.floor(getDaysDiff(revisedEnd, actualDate))} days`;
                        else if (tailType === 'early') statusInfo.extraInfo = `✅ Early by ${Math.floor(getDaysDiff(actualDate, revisedEnd))} days`;

                        const popContent = createPopoverContent(ms, revisedStart, solidBarEnd, statusInfo).replace(/"/g, '&quot;');
                        let innerContent = (planWidth > 60) ? `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${progressPct}%</span></div>` : '';
                        let animClass = (ms.status_progress > 0 && ms.status_progress < 1.0) ? 'active-anim' : '';

                        htmlBuffer += `<div class="gantt-bar plan-bar clickable" style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top" data-bs-content="${popContent}"><div class="progress-overlay ${animClass}" style="width: ${progressPct}%"></div>${innerContent}</div>`;

                        if (tailType) {
                            const tailLeft = getDaysDiff(TRACKER_START_DATE, tailStart) * pixelsPerDay;
                            const tailWidth = Math.max(getDaysDiff(tailStart, tailEnd) * pixelsPerDay, 2);
                            const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                            const isFinished = !!actualDate;
                            const diffDays = Math.abs(Math.round(getDaysDiff(revisedEnd, isFinished ? actualDate : tailEnd)));
                            const displayActual = isFinished ? actualDate : `<span class="text-danger">In Progress (Today)</span>`;
                            const tailPopover = tailType === 'late' ?
                                `<div class="popover-body-content"><div class="mb-1"><strong>⚠️ Delay: ${ms.name}</strong></div><div class="text-danger mb-2">${isFinished ? 'Finished' : 'Overdue by'} ${diffDays} days late</div><div style="border-top:1px solid #eee; padding-top:4px; font-size:11px;"><div>Target End: <b>${revisedEnd}</b></div><div>Actual End: <b>${displayActual}</b></div></div></div>` :
                                `<div class="popover-body-content"><div class="mb-1"><strong>✅ Saved: ${ms.name}</strong></div><div class="text-success mb-2">Finished ${diffDays} days early</div><div style="border-top:1px solid #eee; padding-top:4px; font-size:11px;"><div>Target End: <b>${revisedEnd}</b></div><div>Actual End: <b>${displayActual}</b></div></div></div>`;

                            htmlBuffer += `<div class="gantt-bar ${tailClass} clickable" style="left: ${tailLeft}px; width: ${tailWidth}px;" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-content="${tailPopover.replace(/"/g, '&quot;')}"></div>`;
                        }
                        currentDemandAnchor = demandEndDate;
                    });
                    htmlBuffer += `</div></div>`;
                });
            }
        });

        if (visibleCount === 0 && currentFilter !== 'ALL' && data.groups.length > 0) {
            $container.html(`<div class="empty-state"><i class="bi bi-folder2-open display-4 mb-3"></i><h5>No projects found</h5><p>There are no projects matching the "<strong>${currentFilter}</strong>" filter.</p></div>`);
        } else if (data.groups.length === 0) {
            $container.html(`<div class="empty-state">No Data Loaded</div>`);
        } else {
            $container.html(htmlBuffer);
        }

        $('.group-row').click(function () { if (currentFilter === 'ALL') { currentRevisedData.groups[$(this).data('g-idx')].is_expanded = !currentRevisedData.groups[$(this).data('g-idx')].is_expanded; renderTracker(currentRevisedData); } });
        $container.off('mouseenter', '[data-bs-toggle="popover"]').on('mouseenter', '[data-bs-toggle="popover"]', function () { if (!bootstrap.Popover.getInstance(this)) new bootstrap.Popover(this).show(); });
        $container.off('mouseenter', '[data-bs-toggle="tooltip"]').on('mouseenter', '[data-bs-toggle="tooltip"]', function () { if (!bootstrap.Tooltip.getInstance(this)) new bootstrap.Tooltip(this).show(); });
    }

    // --- Modal 1: Edit Milestone ---
    function initEditHandlers() {
        const modalEl = document.getElementById('editMilestoneModal');
        const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
        const $errorMsg = $('#edit-error-msg');

        $(modalEl).on('hidden.bs.modal', function () { $errorMsg.addClass('d-none').text(''); });

        $('#projects-container').on('click', '.clickable', function (e) {
            e.stopPropagation();
            if (bootstrap.Popover.getInstance(this)) bootstrap.Popover.getInstance(this).hide();
            $errorMsg.addClass('d-none').text('');

            const gIdx = $(this).data('g-idx'), pIdx = $(this).data('p-idx'), mIdx = $(this).data('m-idx');
            const group = currentRevisedData.groups[gIdx];
            const project = group.projects[pIdx];
            const msData = project.milestones[mIdx];

            $('#display-group-name').text(group.group_name);
            $('#display-project-name').text(project.project_name);

            let origStart = project.start_date;
            if (mIdx > 0) origStart = project.milestones[mIdx - 1].planned_end;
            const origDuration = Math.max(1, getDaysDiff(origStart, msData.planned_end));

            $('#read-orig-start').val(origStart);
            $('#read-orig-duration').val(origDuration + ' Days');
            $('#edit-g-index').val(gIdx);
            $('#edit-p-index').val(pIdx);
            $('#edit-m-index').val(mIdx);
            $('#edit-name').val(msData.name);
            $('#edit-desc').val(msData.description || '');
            $('#edit-planned-end').val(msData.planned_end);
            $('#edit-revised-start').val(msData.revised_start_date);
            $('#edit-revised-end').val(msData.revised_end_date);
            $('#edit-actual-date').val(msData.actual_completion_date || '');
            $('#edit-demand-date').val(msData.demand_due_date || '');
            $('#edit-progress').val(msData.status_progress);
            $('#edit-progress-val').text(Math.round(msData.status_progress * 100) + '%');
            modal.show();
        });

        $('#edit-progress').on('input', function () { $('#edit-progress-val').text(Math.round($(this).val() * 100) + '%'); });
        $('#btn-set-today').click(function () { $('#edit-actual-date').val(new Date().toISOString().split('T')[0]); });

        $('#btn-save-changes').click(function () {
            $errorMsg.addClass('d-none');
            const gIdx = parseInt($('#edit-g-index').val()), pIdx = parseInt($('#edit-p-index').val()), mIdx = parseInt($('#edit-m-index').val());
            const inputName = $('#edit-name').val().trim();
            const inputDesc = $('#edit-desc').val().trim();
            const inputRevisedStart = $('#edit-revised-start').val();
            const inputRevisedEnd = $('#edit-revised-end').val();
            const inputDemandDate = $('#edit-demand-date').val();
            const inputActualDate = $('#edit-actual-date').val();
            const inputProgress = parseFloat($('#edit-progress').val());

            if (!inputRevisedEnd) { $errorMsg.text("Revised End Date cannot be empty.").removeClass('d-none'); return; }

            const newDurationDays = Math.max(1, getDaysDiff(inputRevisedStart, inputRevisedEnd));
            const origStartRef = $('#read-orig-start').val();
            const inputPlannedEnd = addDays(origStartRef, newDurationDays).toISOString().split('T')[0];

            const project = rawTrackerData.groups[gIdx].projects[pIdx];
            const milestones = project.milestones;
            let errorText = null;

            if (!inputName) errorText = "Task Name cannot be empty.";
            else if (!inputDemandDate) errorText = "Demand / Target Date cannot be empty.";
            else if (inputProgress < 1.0 && inputActualDate) errorText = "Cannot set Actual Completion Date if progress is less than 100%.";
            else if (inputProgress === 1.0 && !inputActualDate) errorText = "Must set Actual Completion Date if progress is 100%.";
            else if (inputPlannedEnd < project.start_date) errorText = `Calculated Planned End (${inputPlannedEnd}) cannot be earlier than Project Start.`;
            else if (inputActualDate && inputActualDate < project.start_date) errorText = `Actual Date cannot be earlier than Project Start.`;
            else {
                if (mIdx > 0) {
                    const prevMs = milestones[mIdx - 1];
                    if (inputPlannedEnd < prevMs.planned_end) errorText = `Calculated Planned End cannot be earlier than previous task's Planned End.`;
                    else if (inputDemandDate < prevMs.demand_due_date) errorText = `Demand Date cannot be earlier than previous task's Demand Date.`;
                    else if (prevMs.status_progress < 1.0 && inputProgress > 0.0) errorText = `Cannot start this task because previous task is not finished.`;
                }
                if (!errorText && mIdx < milestones.length - 1) {
                    const nextMs = milestones[mIdx + 1];
                    if (inputPlannedEnd > nextMs.planned_end) errorText = `Calculated Planned End cannot be later than next task's Planned End.`;
                    else if (inputDemandDate > nextMs.demand_due_date) errorText = `Demand Date cannot be later than next task's Demand Date.`;
                    else if (nextMs.status_progress > 0.0 && inputProgress < 1.0) errorText = `Cannot set progress below 100% because next task has started.`;
                }
            }

            if (errorText) { $errorMsg.text(errorText).removeClass('d-none'); return; }

            const msData = rawTrackerData.groups[gIdx].projects[pIdx].milestones[mIdx];
            msData.name = inputName;
            msData.description = inputDesc;
            msData.planned_end = inputPlannedEnd;
            msData.demand_due_date = inputDemandDate;
            msData.actual_completion_date = inputActualDate ? inputActualDate : null;
            msData.status_progress = inputProgress;
            runPipeline();
            modal.hide();
        });
    }

    // --- Modal 2: Edit Project Structure (Sequencer) ---
    function initProjectStructureHandlers() {
        const modalEl = document.getElementById('editProjectStructureModal');
        const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
        const listContainer = document.getElementById('milestone-list-container');
        let tempMilestones = [];
        let sortableInstance = null;

        $('#projects-container').on('click', '.project-name-clickable', function (e) {
            e.stopPropagation();
            const gIdx = $(this).data('g-idx'), pIdx = $(this).data('p-idx');
            const project = rawTrackerData.groups[gIdx].projects[pIdx];

            $('#struct-g-idx').val(gIdx);
            $('#struct-p-idx').val(pIdx);
            $('#struct-proj-name').val(project.project_name);
            $('#struct-proj-desc').val(project.description || '');
            $('#struct-proj-start').val(project.start_date);

            tempMilestones = JSON.parse(JSON.stringify(project.milestones));
            let cursorDate = new Date(project.start_date);
            tempMilestones.forEach((ms, index) => {
                let prevDate = index === 0 ? cursorDate : new Date(tempMilestones[index - 1].planned_end);
                ms._temp_duration = Math.max(1, getDaysDiff(prevDate, ms.planned_end));
                ms._is_locked = (ms.status_progress === 1.0);
                if (!ms.color) ms.color = "#0d6efd";
                if (!ms.description) ms.description = "";
            });

            renderMilestoneList();
            recalculateSchedule();
            modal.show();
        });

        function renderMilestoneList() {
            listContainer.innerHTML = '';
            tempMilestones.forEach((ms, index) => {
                const isLocked = ms._is_locked;
                const lockClass = isLocked ? 'locked' : '';
                const lockIcon = isLocked ? '<i class="bi bi-lock-fill text-success"></i>' : '<i class="bi bi-grip-vertical"></i>';
                const deleteBtn = isLocked ? `<button type="button" class="btn btn-sm text-muted" disabled><i class="bi bi-lock"></i></button>` : `<button type="button" class="btn btn-sm text-danger btn-delete-ms" data-idx="${index}"><i class="bi bi-trash"></i></button>`;
                const colorOptions = PREDEFINED_COLORS.map(c => `<option value="${c.code}" style="background-color:${c.code}; color:#fff;" ${c.code === ms.color ? 'selected' : ''}>${c.name}</option>`).join('');

                const html = `
                    <div class="list-group-item milestone-item p-0 ${lockClass}" data-idx="${index}">
                        <div class="row g-2 align-items-center m-0 py-2">
                            <div class="col-1 text-center drag-handle">${lockIcon}</div>
                            <div class="col-1"><select class="form-select form-select-sm ms-color-input p-1 text-center text-white" style="background-color: ${ms.color}; border:none; cursor:pointer;" data-idx="${index}">${colorOptions}</select></div>
                            <div class="col-4">
                                <input type="text" class="form-control form-control-sm ms-name-input fw-bold" value="${ms.name}" placeholder="Name" data-idx="${index}">
                                <input type="text" class="form-control form-control-sm ms-desc-input mt-1 text-muted" style="font-size: 11px;" value="${ms.description || ''}" placeholder="Description (Optional)" data-idx="${index}">
                            </div>
                            <div class="col-2"><div class="input-group input-group-sm"><input type="number" class="form-control ms-duration-input" value="${ms._temp_duration}" min="1" data-idx="${index}"><span class="input-group-text">d</span></div></div>
                            <div class="col-3"><input type="text" class="form-control form-control-sm bg-light border-0 ms-calc-date" readonly tabindex="-1"></div>
                            <div class="col-1 text-center">${deleteBtn}</div>
                        </div>
                    </div>
                `;
                listContainer.insertAdjacentHTML('beforeend', html);
            });

            if (sortableInstance) sortableInstance.destroy();
            sortableInstance = new Sortable(listContainer, {
                handle: '.drag-handle', animation: 150, filter: '.locked',
                onMove: function (evt) { return !evt.related.classList.contains('locked'); },
                onEnd: function (evt) {
                    const newOrder = [];
                    $(listContainer).find('.milestone-item').each(function () { newOrder.push(tempMilestones[$(this).data('idx')]); });
                    tempMilestones = newOrder;
                    renderMilestoneList(); recalculateSchedule();
                }
            });
            bindInputs();
        }

        function bindInputs() {
            $('.ms-duration-input').on('change input', function () { let val = parseInt($(this).val()); if (isNaN(val) || val < 1) val = 1; tempMilestones[$(this).data('idx')]._temp_duration = val; recalculateSchedule(); });
            $('.ms-name-input').on('change input', function () { tempMilestones[$(this).data('idx')].name = $(this).val(); });
            $('.ms-desc-input').on('change input', function () { tempMilestones[$(this).data('idx')].description = $(this).val(); });
            $('.ms-color-input').on('change', function () { tempMilestones[$(this).data('idx')].color = $(this).val(); $(this).css('background-color', $(this).val()); });
            $('.btn-delete-ms').on('click', function () { tempMilestones.splice($(this).data('idx'), 1); renderMilestoneList(); recalculateSchedule(); });
        }

        function recalculateSchedule() {
            const startVal = $('#struct-proj-start').val();
            if (!startVal) return;
            let cursor = new Date(startVal), totalDays = 0;
            const dateInputs = $('.ms-calc-date');
            tempMilestones.forEach((ms, i) => {
                const dur = ms._temp_duration || 1;
                const endDate = addDays(cursor, dur);
                $(dateInputs[i]).val(`${endDate.toISOString().split('T')[0]} (End)`);
                cursor = endDate; totalDays += dur; ms._calc_planned_end = endDate.toISOString().split('T')[0];
            });
            $('#struct-total-days').text(totalDays); $('#struct-final-date').text(cursor.toISOString().split('T')[0]);
        }

        $('#btn-add-milestone').click(function () {
            tempMilestones.push({ name: "New Milestone", description: "", status_progress: 0.0, _temp_duration: 10, _is_locked: false, color: "#0d6efd", demand_due_date: "" });
            renderMilestoneList(); recalculateSchedule();
        });

        $('#struct-proj-start').on('change', function () { recalculateSchedule(); });

        $('#btn-save-structure').click(function () {
            const gIdx = parseInt($('#struct-g-idx').val()), pIdx = parseInt($('#struct-p-idx').val());
            if (tempMilestones.length === 0) { alert("Project must have at least one milestone."); return; }
            const project = rawTrackerData.groups[gIdx].projects[pIdx];
            project.project_name = $('#struct-proj-name').val();
            project.description = $('#struct-proj-desc').val();
            project.start_date = $('#struct-proj-start').val();
            project.milestones = tempMilestones.map(ms => {
                return {
                    name: ms.name, description: ms.description, status_progress: ms.status_progress,
                    planned_end: ms._calc_planned_end, actual_completion_date: ms.actual_completion_date || null,
                    demand_due_date: ms.demand_due_date || ms._calc_planned_end, color: ms.color
                };
            });
            runPipeline();
            modal.hide();
        });
    }

    function initGroupControls() {
        $('#btn-expand-all').click(function () { if (currentFilter === 'ALL') { currentRevisedData.groups.forEach(g => g.is_expanded = true); renderTracker(currentRevisedData); } });
        $('#btn-collapse-all').click(function () { if (currentFilter === 'ALL') { currentRevisedData.groups.forEach(g => g.is_expanded = false); renderTracker(currentRevisedData); } });
    }

    function initZoomControls() {
        $('#btn-zoom-in').click(function () { if (pixelsPerDay < 20) { pixelsPerDay += 2; renderTracker(currentRevisedData); } });
        $('#btn-zoom-out').click(function () { if (pixelsPerDay > 2) { pixelsPerDay -= 2; renderTracker(currentRevisedData); } });
        $('#btn-zoom-reset').click(function () { pixelsPerDay = DEFAULT_PIXELS_PER_DAY; renderTracker(currentRevisedData); });
    }

    function makeModalDraggable(modalId) {
        const $modal = $(modalId), $dialog = $modal.find('.modal-dialog'), $header = $modal.find('.modal-header');
        let isDragging = false, startX, startY, startLeft, startTop;
        $header.on('mousedown', function (e) {
            if (e.which !== 1) return;
            isDragging = true; startX = e.clientX; startY = e.clientY;
            const offset = $dialog.offset(); startLeft = offset.left; startTop = offset.top;
            $dialog.css({ 'width': $dialog.outerWidth() + 'px', 'margin': '0', 'position': 'absolute', 'left': startLeft + 'px', 'top': startTop + 'px' });
            e.preventDefault();
        });
        $(document).on('mousemove', function (e) { if (isDragging) $dialog.css({ 'left': (startLeft + e.clientX - startX) + 'px', 'top': (startTop + e.clientY - startY) + 'px' }); });
        $(document).on('mouseup', function () { isDragging = false; });
        $modal.on('hidden.bs.modal', function () { $dialog.css({ 'left': '', 'top': '', 'margin': '', 'position': '', 'width': '' }); });
    }

    function runPipeline() {
        currentRevisedData = reviseProjectData(rawTrackerData);
        const result = preprocessData(currentRevisedData);
        currentProcessedStats = result.counts;
        renderDashboardStats(currentProcessedStats);
        renderTracker(currentRevisedData);
    }

    // --- Init ---
    initZoomControls();
    initGroupControls();
    initEditHandlers();
    initProjectStructureHandlers();
    makeModalDraggable('#editMilestoneModal');
    makeModalDraggable('#editProjectStructureModal');
    runPipeline();
});