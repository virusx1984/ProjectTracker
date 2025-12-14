$(document).ready(function () {
    // --- Configuration ---
    let pixelsPerDay = 6;
    const DEFAULT_PIXELS_PER_DAY = 6;
    const TRACKER_START_DATE = new Date("2025-01-01");
    const RENDER_MONTHS_COUNT = 15;

    // DEMO DATE
    const CURRENT_DATE = new Date("2025-03-15");

    // --- Global State ---
    let currentFilter = 'ALL';

    // Shared variable to hold currently processed data
    let currentRevisedData = null;
    let currentProcessedStats = null;

    // --- Data Source (Nested Structure) ---
    const rawTrackerData = {
        "tracker_title": "Enterprise IT Roadmap 2025 (Group View)",
        "groups": [
            {
                "group_id": "GRP-01",
                "group_name": "Digital Transformation",
                "is_expanded": true,
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
                        "project_id": "PRJ-002",
                        "project_name": "Mobile App Launch",
                        "start_date": "2025-02-01",
                        "milestones": [
                            { "name": "Requirement", "status_progress": 1.0, "planned_end": "2025-02-20", "actual_completion_date": "2025-02-20", "demand_due_date": "2025-02-25", "color": "#fd7e14" },
                            { "name": "Alpha Ver.", "status_progress": 0.4, "planned_end": "2025-05-10", "actual_completion_date": null, "demand_due_date": "2025-05-10", "color": "#20c997" }
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
                        "start_date": "2025-01-20",
                        "milestones": [
                            { "name": "AWS Setup", "status_progress": 0.8, "planned_end": "2025-02-15", "actual_completion_date": null, "demand_due_date": "2025-02-15", "color": "#fd7e14" },
                            { "name": "K8s Config", "status_progress": 0.0, "planned_end": "2025-04-05", "actual_completion_date": null, "demand_due_date": "2025-03-30", "color": "#6f42c1" }
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
        return (e - s) / (1000 * 60 * 60 * 24);
    }

    function addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    // --- CORE LOGIC: Dynamic Schedule Revision (Nested) ---
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

    // --- Single Project Status ---
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

    // --- Group Status Aggregation ---
    // Rule: Show the worst status of child projects
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

    // --- Preprocessing & Counting (Nested) ---
    function preprocessData(data) {
        const counts = {
            ALL: 0,
            EXCELLENT: 0,
            BUFFER_USED: 0,
            PLAN_FAIL: 0,
            CRITICAL: 0
        };

        data.groups.forEach(group => {
            group.projects.forEach(project => {
                const status = calculateSingleProjectStatus(project);
                project._computedStatus = status;

                counts.ALL++;
                if (counts.hasOwnProperty(status.code)) {
                    counts[status.code]++;
                }
            });
            group._computedStatus = calculateGroupStatus(group);
        });

        return { counts, data };
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

    // --- Render: Dashboard Cards ---
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

            const html = `
                <div class="stat-card ${isActive}" data-filter="${cfg.code}">
                    <div class="color-bar ${cfg.colorClass}"></div>
                    <div class="stat-count">${count}</div>
                    <div class="stat-label">${cfg.label}</div>
                </div>
            `;
            $container.append(html);
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

    // --- Render: Main Timeline (Nested Groups) ---
    function renderTracker(data) {
        const $container = $('#projects-container');
        const $headerTicks = $('#header-ticks-container');

        $container.empty();
        $headerTicks.empty();
        $container.css('position', 'relative');

        // 1. Render Header
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
            let monthWidth = daysInMonth * pixelsPerDay;
            totalTimelineWidth = leftPos + monthWidth;
        }
        $headerTicks.css('min-width', (totalTimelineWidth + 0) + 'px');

        // Past Zone
        const todayOffsetDays = getDaysDiff(TRACKER_START_DATE, CURRENT_DATE);
        if (todayOffsetDays >= 0) {
            const todayLeft = todayOffsetDays * pixelsPerDay;
            const sidebarWidth = $('.header-corner-placeholder').outerWidth() || 220;
            $headerTicks.append(`<div class="today-header-marker" style="left: ${todayLeft}px;"><span class="today-label">Today</span></div>`);
            $container.append(`<div class="past-time-zone" style="width: ${todayLeft + sidebarWidth}px;"></div>`);
        }

        // 2. Render Groups and Projects
        // 2. Render Groups and Projects
        let htmlBuffer = ""; 
        let visibleCount = 0;

        // Iterate Groups
        data.groups.forEach((group, gIndex) => {
            
            // --- Step A: Filter Logic ---
            const matchingProjects = group.projects.filter(p => {
                return currentFilter === 'ALL' || p._computedStatus.code === currentFilter;
            });

            // If no projects match filter, skip whole group
            if (matchingProjects.length === 0) return;

            // --- Step B: Prepare Data for Visuals ---
            
            let minStart = null;
            let maxEnd = null;
            let minProgressDate = null;
            
            const groupStats = { 'CRITICAL': 0, 'PLAN_FAIL': 0, 'BUFFER_USED': 0, 'EXCELLENT': 0 };
            let totalProjects = 0;

            group.projects.forEach(p => {
                const pStart = new Date(p.start_date);
                if (!minStart || pStart < minStart) minStart = pStart;
                if (!maxEnd || pStart > maxEnd) maxEnd = pStart;

                // Track the effective end of this project (including delays)
                let pEffectiveEnd = pStart; 

                // 1. Calculate Project Range (Considering Delays for Ghost Bar Span)
                if (p.milestones.length > 0) {
                    p.milestones.forEach(ms => {
                        const msStart = new Date(ms.revised_start_date);
                        let msEnd = new Date(ms.revised_end_date);
                        
                        // FIX: If task is overdue, its effective end is CURRENT_DATE
                        // This ensures the Ghost Bar covers the red delay tail
                        if (!ms.actual_completion_date && CURRENT_DATE > msEnd) {
                            msEnd = new Date(CURRENT_DATE);
                        }

                        if (msStart < minStart) minStart = msStart;
                        if (msEnd > maxEnd) maxEnd = msEnd;
                        if (msEnd > pEffectiveEnd) pEffectiveEnd = msEnd;
                    });
                }

                // 2. Calculate Weighted Progress (Dynamic Weight based on Delay)
                let totalEffectiveDuration = 0;
                let completedEffectiveDuration = 0;
                
                if (p.milestones.length > 0) {
                    p.milestones.forEach(ms => {
                        const rStart = new Date(ms.revised_start_date);
                        let rEnd = new Date(ms.revised_end_date);
                        
                        // FIX: Important! Use the extended date for weight calculation too.
                        // If a task is dragged out to today, 80% of it is a much larger amount of work.
                        if (!ms.actual_completion_date && CURRENT_DATE > rEnd) {
                            rEnd = new Date(CURRENT_DATE);
                        }
                        
                        const dur = Math.max(1, getDaysDiff(rStart, rEnd));
                        
                        totalEffectiveDuration += dur;
                        completedEffectiveDuration += (dur * ms.status_progress);
                    });
                }
                
                const pPercent = totalEffectiveDuration === 0 ? 0 : (completedEffectiveDuration / totalEffectiveDuration);
                
                // 3. Map % to Date
                // Use the Effective Span (Start -> Effective End)
                const totalSpanDays = getDaysDiff(pStart, pEffectiveEnd);
                const progressDays = Math.round(totalSpanDays * pPercent);
                
                // Construct the exact date
                const pProgressDate = new Date(pStart);
                pProgressDate.setDate(pProgressDate.getDate() + progressDays);

                if (!minProgressDate || pProgressDate < minProgressDate) {
                    minProgressDate = pProgressDate;
                }

                // Stats
                const code = p._computedStatus.code;
                if (groupStats.hasOwnProperty(code)) groupStats[code]++;
                totalProjects++;
            });

            // --- Step C: Generate HTML for Visuals ---

            // 1. Ghost Bar & Progress Fill HTML
            let ghostBarHtml = '';
            if (minStart && maxEnd) {
                const gStartOffset = getDaysDiff(TRACKER_START_DATE, minStart);
                const gDuration = getDaysDiff(minStart, maxEnd);
                
                const gLeft = gStartOffset * pixelsPerDay;
                const gWidth = gDuration * pixelsPerDay;
                
                // Calculate Fill Width
                // Fill goes from minStart -> minProgressDate
                let fillWidth = 0;
                if (minProgressDate && minProgressDate > minStart) {
                    const progressDuration = getDaysDiff(minStart, minProgressDate);
                    fillWidth = Math.max(0, progressDuration * pixelsPerDay);
                    // Cap it at max width (just in case)
                    if (fillWidth > gWidth) fillWidth = gWidth;
                }

                // Render Container + Inner Fill
                ghostBarHtml = `
                    <div class="group-ghost-bar" style="left: ${gLeft}px; width: ${gWidth}px;">
                        <div class="ghost-progress-fill" style="width: ${fillWidth}px;"></div>
                    </div>
                `;
            }

            // 2. Health Distribution Bar HTML (Left Side) - No Changes
            let healthBarSegments = '';
            if (totalProjects > 0) {
                const order = ['CRITICAL', 'PLAN_FAIL', 'BUFFER_USED', 'EXCELLENT'];
                const colorMap = {
                    'CRITICAL': 'bg-critical',
                    'PLAN_FAIL': 'bg-danger',
                    'BUFFER_USED': 'bg-warning',
                    'EXCELLENT': 'bg-success'
                };
                order.forEach(code => {
                    const count = groupStats[code];
                    if (count > 0) {
                        const pct = (count / totalProjects) * 100;
                        healthBarSegments += `<div class="health-segment ${colorMap[code]}" style="width: ${pct}%" title="${code}: ${count}"></div>`;
                    }
                });
            }

            // --- Step D: Render Group Row ---
            
            const grpStatus = group._computedStatus;
            const isFilterActive = currentFilter !== 'ALL';
            const isExpanded = isFilterActive ? true : group.is_expanded;
            const toggleIcon = isExpanded ? '<i class="bi bi-chevron-down"></i>' : '<i class="bi bi-chevron-right"></i>';

            htmlBuffer += `
                <div class="group-row" data-g-idx="${gIndex}">
                    <div class="group-name-label">
                        <div class="status-strip ${grpStatus.class}"></div>
                        <span class="group-toggle-icon">${toggleIcon}</span>
                        
                        <div class="d-flex flex-column w-100 pe-2">
                            <div class="d-flex justify-content-between align-items-center">
                                <span>${group.group_name}</span>
                                <span class="badge bg-secondary" style="font-size:9px">${matchingProjects.length}</span>
                            </div>
                            <div class="group-health-bar">
                                ${healthBarSegments}
                            </div>
                        </div>

                    </div>
                    <div class="milestone-container" style="min-width: ${totalTimelineWidth}px">
                        ${ghostBarHtml}
                    </div>
                </div>
            `;

            // --- Step E: Render Projects (If Expanded) ---
            if (isExpanded) {
                group.projects.forEach((project, pIndex) => {
                    const status = project._computedStatus;
                    if (currentFilter !== 'ALL' && status.code !== currentFilter) return;
                    
                    visibleCount++;

                    const statusStrip = `
                        <div class="status-strip ${status.class}" 
                            data-bs-toggle="tooltip" 
                            data-bs-placement="right" 
                            title="Status: ${status.label}">
                        </div>
                    `;

                    htmlBuffer += `
                        <div class="project-row">
                            <div class="project-name-label">
                                ${statusStrip}
                                <div class="fw-bold text-dark text-truncate">
                                    ${project.project_name}
                                </div>
                                <div style="font-size:10px; color:#6c757d; margin-top:4px;">
                                    ID: ${project.project_id}
                                </div>
                            </div>
                            <div class="milestone-container" id="milestones-${project.project_id}" style="min-width: ${totalTimelineWidth}px">
                    `;

                    let currentDemandAnchor = project.start_date;

                    project.milestones.forEach((ms, mIndex) => {
                        // ... (Milestone Rendering Logic remains exactly the same as before) ...
                        // For brevity, I am not repeating the specific milestone bar rendering code here
                        // ensuring your existing copy-paste logic works. 
                        // Just copy the milestone loop logic from the previous valid version.
                        
                        // --- START OF EXISTING MILESTONE LOGIC ---
                        const demandEndDate = ms.demand_due_date ? ms.demand_due_date : ms.planned_end;
                        const demandDuration = getDaysDiff(currentDemandAnchor, demandEndDate);
                        const demandOffset = getDaysDiff(TRACKER_START_DATE, currentDemandAnchor);
                        const demandWidth = Math.max(demandDuration * pixelsPerDay, 2);
                        const demandLeft = demandOffset * pixelsPerDay;
                        const demandPopoverContent = `Demand: ${ms.name}<br>Due: ${demandEndDate}`;

                        htmlBuffer += `
                            <div class="gantt-bar demand-bar clickable" 
                                style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};"
                                data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}"
                                data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top"
                                data-bs-content="${demandPopoverContent}"></div>
                        `;

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
                        const popContent = createPopoverContent(ms, revisedStart, solidBarEnd, statusInfo).replace(/"/g, '&quot;');

                        let innerContent = '';
                        if (planWidth > 60) {
                            innerContent = `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${progressPct}%</span></div>`;
                        }

                        let animClass = '';
                        if (ms.status_progress > 0 && ms.status_progress < 1.0) {
                            animClass = 'active-anim';
                        }

                        htmlBuffer += `
                            <div class="gantt-bar plan-bar clickable" 
                                style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};"
                                data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}"
                                data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top"
                                data-bs-content="${popContent}">
                                <div class="progress-overlay ${animClass}" style="width: ${progressPct}%"></div>
                                ${innerContent}
                            </div>
                        `;

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

                            htmlBuffer += `<div class="gantt-bar ${tailClass} clickable" 
                                style="left: ${tailLeft}px; width: ${tailWidth}px;"
                                data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}"
                                data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-content="${tailPopover}"></div>`;
                        }

                        currentDemandAnchor = demandEndDate;
                        // --- END OF EXISTING MILESTONE LOGIC ---
                    });

                    htmlBuffer += `</div></div>`; // Close Project Row
                });
            }
        });

        // 3. Inject HTML
        if (visibleCount === 0 && currentFilter !== 'ALL' && data.groups.length > 0) {
            $container.html(`
                <div class="empty-state">
                    <i class="bi bi-folder2-open display-4 mb-3"></i>
                    <h5>No projects found</h5>
                    <p>There are no projects matching the "<strong>${currentFilter}</strong>" filter.</p>
                </div>
            `);
        } else if (data.groups.length === 0) {
            $container.html(`<div class="empty-state">No Data Loaded</div>`);
        } else {
            $container.html(htmlBuffer);
        }

        // 4. Bind Events (Group Toggle)
        $('.group-row').click(function () {
            if (currentFilter !== 'ALL') return;

            const gIdx = $(this).data('g-idx');
            currentRevisedData.groups[gIdx].is_expanded = !currentRevisedData.groups[gIdx].is_expanded;
            renderTracker(currentRevisedData);
        });

        // 5. Lazy Initialization
        $container.off('mouseenter', '[data-bs-toggle="popover"]');
        $container.on('mouseenter', '[data-bs-toggle="popover"]', function () {
            const el = this;
            let popover = bootstrap.Popover.getInstance(el);
            if (!popover) {
                popover = new bootstrap.Popover(el);
                popover.show();
            }
        });

        $container.off('mouseenter', '[data-bs-toggle="tooltip"]');
        $container.on('mouseenter', '[data-bs-toggle="tooltip"]', function () {
            const el = this;
            let tooltip = bootstrap.Tooltip.getInstance(el);
            if (!tooltip) {
                tooltip = new bootstrap.Tooltip(el);
                tooltip.show();
            }
        });
    }

    // --- Edit Logic ---
    function initEditHandlers() {
        const modalEl = document.getElementById('editMilestoneModal');
        const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
        const $errorMsg = $('#edit-error-msg');

        $(modalEl).on('hidden.bs.modal', function () {
            $errorMsg.addClass('d-none').text('');
        });

        $('#projects-container').on('click', '.clickable', function (e) {
            e.stopPropagation();

            const popover = bootstrap.Popover.getInstance(this);
            if (popover) popover.hide();
            $errorMsg.addClass('d-none').text('');

            const gIdx = $(this).data('g-idx');
            const pIdx = $(this).data('p-idx');
            const mIdx = $(this).data('m-idx');

            const msData = rawTrackerData.groups[gIdx].projects[pIdx].milestones[mIdx];

            $('#edit-g-index').val(gIdx);
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

        $('#edit-progress').on('input', function () {
            $('#edit-progress-val').text(Math.round($(this).val() * 100) + '%');
        });

        $('#btn-save-changes').click(function () {
            $errorMsg.addClass('d-none');

            const gIdx = parseInt($('#edit-g-index').val());
            const pIdx = parseInt($('#edit-p-index').val());
            const mIdx = parseInt($('#edit-m-index').val());

            const inputName = $('#edit-name').val().trim();
            const inputPlannedEnd = $('#edit-planned-end').val();
            const inputDemandDate = $('#edit-demand-date').val();
            const inputActualDate = $('#edit-actual-date').val();
            const inputProgress = parseFloat($('#edit-progress').val());

            const project = rawTrackerData.groups[gIdx].projects[pIdx];
            const milestones = project.milestones;
            const projectStart = project.start_date;

            let errorText = null;

            if (!inputName) errorText = "Task Name cannot be empty.";
            else if (!inputPlannedEnd) errorText = "Original Planned End cannot be empty.";
            else if (!inputDemandDate) errorText = "Demand / Target Date cannot be empty.";
            else if (inputProgress < 1.0 && inputActualDate) errorText = "Cannot set Actual Completion Date if progress is less than 100%.";
            else if (inputProgress === 1.0 && !inputActualDate) errorText = "Must set Actual Completion Date if progress is 100%.";
            else if (inputPlannedEnd < projectStart) errorText = `Planned End (${inputPlannedEnd}) cannot be earlier than Project Start (${projectStart}).`;
            else if (inputActualDate && inputActualDate < projectStart) errorText = `Actual Date (${inputActualDate}) cannot be earlier than Project Start (${projectStart}).`;
            else {
                if (mIdx > 0) {
                    const prevMs = milestones[mIdx - 1];
                    if (inputPlannedEnd < prevMs.planned_end) errorText = `Planned End cannot be earlier than previous task's Planned End (${prevMs.planned_end}).`;
                    else if (inputDemandDate < prevMs.demand_due_date) errorText = `Demand Date cannot be earlier than previous task's Demand Date (${prevMs.demand_due_date}).`;
                    else if (prevMs.status_progress < 1.0 && inputProgress === 1.0) errorText = `Cannot mark this task as 100% complete because the previous task ("${prevMs.name}") is not finished yet.`;
                }
                if (!errorText && mIdx < milestones.length - 1) {
                    const nextMs = milestones[mIdx + 1];
                    if (inputPlannedEnd > nextMs.planned_end) errorText = `Planned End cannot be later than next task's Planned End (${nextMs.planned_end}).`;
                    else if (inputDemandDate > nextMs.demand_due_date) errorText = `Demand Date cannot be later than next task's Demand Date (${nextMs.demand_due_date}).`;
                    else if (nextMs.status_progress === 1.0 && inputProgress < 1.0) errorText = `Cannot reduce progress below 100% because the next task ("${nextMs.name}") is already finished.`;
                }
            }

            if (errorText) {
                $errorMsg.text(errorText).removeClass('d-none');
                $('.modal-content').addClass('shake-animation');
                setTimeout(() => $('.modal-content').removeClass('shake-animation'), 500);
                return;
            }

            const msData = rawTrackerData.groups[gIdx].projects[pIdx].milestones[mIdx];
            msData.name = inputName;
            msData.planned_end = inputPlannedEnd;
            msData.demand_due_date = inputDemandDate;
            msData.actual_completion_date = inputActualDate ? inputActualDate : null;
            msData.status_progress = inputProgress;

            runPipeline();
            modal.hide();
        });
    }

    // --- Zoom Controls ---
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
            const currentWidth = $dialog.outerWidth();
            const offset = $dialog.offset();
            startLeft = offset.left;
            startTop = offset.top;
            $dialog.css({ 'width': currentWidth + 'px', 'margin': '0', 'position': 'absolute', 'left': startLeft + 'px', 'top': startTop + 'px' });
            e.preventDefault();
        });

        $(document).on('mousemove', function (e) {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            $dialog.css({ 'left': (startLeft + dx) + 'px', 'top': (startTop + dy) + 'px' });
        });

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
    initEditHandlers();
    makeModalDraggable('#editMilestoneModal');
    runPipeline();
});