// --- UI Rendering Logic ---

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

    $('.stat-card').click(function() {
        const newFilter = $(this).data('filter');
        if (newFilter !== currentFilter) {
            currentFilter = newFilter;
            $('.stat-card').removeClass('active');
            $(this).addClass('active');
            // Re-render using global function (assigned in app.js or accessible globally)
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

    // 1. Header Rendering
    let totalTimelineWidth = 0;
    const SHOW_DAYS_THRESHOLD = 4;

    for(let i=0; i < CONFIG.RENDER_MONTHS; i++) {
        let targetMonthDate = new Date(CONFIG.TRACKER_START_DATE);
        targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
        
        let daysFromStart = getDaysDiff(CONFIG.TRACKER_START_DATE, targetMonthDate);
        let leftPos = daysFromStart * pixelsPerDay;
        
        // Month Data
        const currentYear = targetMonthDate.getFullYear();
        const shortMonth = targetMonthDate.toLocaleString('default', { month: 'short' });
        const isJanuary = targetMonthDate.getMonth() === 0;
        
        // --- LOGIC: Year Anchor Decision ---
        // Show Year if: It's the very first month rendered OR It's January
        let labelHtml = shortMonth;
        let boundaryClass = "";

        if (i === 0 || isJanuary) {
            // Format: "2025 Jan"
            labelHtml = `<span class="year-label">${currentYear}</span>${shortMonth}`;
            
            // Add visual divider only for actual January (New Year boundary), 
            // not necessarily for the first month if it's like May.
            if (isJanuary) {
                boundaryClass = "year-boundary";
            }
        }

        $headerTicks.append(`<div class="time-mark ${boundaryClass}" style="left: ${leftPos}px">${labelHtml}</div>`);
        
        // Days Rendering (Unchanged)
        let daysInMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();
        if (pixelsPerDay >= SHOW_DAYS_THRESHOLD) {
            let step = (pixelsPerDay >= 18) ? 1 : ((pixelsPerDay >= 10) ? 5 : 15);
            for (let d = 1; d <= daysInMonth; d++) {
                if (d % step === 0 && d !== 1) {
                    if (step > 1 && d >= 30) continue;
                    let dayDate = new Date(targetMonthDate);
                    dayDate.setDate(d);
                    let dayOffset = getDaysDiff(CONFIG.TRACKER_START_DATE, dayDate);
                    $headerTicks.append(`<div class="day-tick" style="left: ${dayOffset * pixelsPerDay}px">${d}</div>`);
                }
            }
        }
        totalTimelineWidth = leftPos + (daysInMonth * pixelsPerDay); 
    }
    $headerTicks.css('min-width', totalTimelineWidth + 'px');

    // Past Zone & Today Marker
    const todayOffsetDays = getDaysDiff(CONFIG.TRACKER_START_DATE, CONFIG.CURRENT_DATE);
    if (todayOffsetDays >= 0) {
        const todayLeft = todayOffsetDays * pixelsPerDay;
        const sidebarWidth = $('.header-corner-placeholder').outerWidth() || 220;
        $headerTicks.append(`<div class="today-header-marker" style="left: ${todayLeft}px;"><span class="today-label">Today</span></div>`);
        $container.append(`<div class="past-time-zone" style="width: ${todayLeft + sidebarWidth}px;"></div>`);
    }

    // 2. Render Groups & Projects
    let htmlBuffer = ""; 
    let visibleCount = 0;

    data.groups.forEach((group, gIndex) => {
        const matchingProjects = group.projects.filter(p => currentFilter === 'ALL' || p._computedStatus.code === currentFilter);
        if (matchingProjects.length === 0) return;

        // --- Group Stats Calculation ---
        let minStart = null, maxEnd = null, maxDemandEnd = null, minProgressDate = null;
        const groupStats = { 'CRITICAL': 0, 'PLAN_FAIL': 0, 'BUFFER_USED': 0, 'EXCELLENT': 0 };
        let totalProjects = 0;

        group.projects.forEach(p => {
            const pStart = new Date(p.start_date);
            if (!minStart || pStart < minStart) minStart = pStart;
            // Ghost Bar Calculation (Part 1): Base Range
            if (!maxEnd || pStart > maxEnd) maxEnd = pStart;
            if (!maxDemandEnd || pStart > maxDemandEnd) maxDemandEnd = pStart;

            // 1. Calculate Ghost Bar Range (Gray Background)
            // This MUST extend to Today if overdue
            p.milestones.forEach(ms => {
                const msStart = new Date(ms.revised_start_date);
                let msEnd = new Date(ms.revised_end_date);
                
                // IMPORTANT: For the Ghost Bar (Background), we EXTEND to Today
                if (!ms.actual_completion_date && CONFIG.CURRENT_DATE > msEnd) {
                    msEnd = new Date(CONFIG.CURRENT_DATE);
                }

                if (msStart < minStart) minStart = msStart;
                if (msEnd > maxEnd) maxEnd = msEnd;
                
                const msDemand = new Date(ms.demand_due_date || ms.planned_end);
                if (msDemand > maxDemandEnd) maxDemandEnd = msDemand;
            });

            // 2. Calculate Visual Progress Date (Solid Bar)
            // This determines where the solid fill stops.
            let pVisualDate = new Date(pStart);
            
            if (p.milestones.length > 0) {
                for (let i = 0; i < p.milestones.length; i++) {
                    const ms = p.milestones[i];
                    const msStart = new Date(ms.revised_start_date);
                    let msEnd = new Date(ms.revised_end_date);
                    
                    // CHANGE: We do NOT extend msEnd to Today here.
                    // We want to calculate % based on the Workload (Revised Plan), not Time Wasted.
                    // This ensures 60% means "60% of the work", putting the bar at March 5th, not August.

                    if (ms.status_progress === 1.0) {
                        // If done, use Actual Date. If Actual Date missing (data error), fallback to Revised End.
                        let effectiveDoneDate = ms.actual_completion_date ? new Date(ms.actual_completion_date) : msEnd;
                        if (effectiveDoneDate > pVisualDate) {
                            pVisualDate = effectiveDoneDate;
                        }
                    } else if (ms.status_progress > 0) {
                        // In Progress: Calculate days based on PLANNED duration
                        const duration = Math.max(1, getDaysDiff(msStart, msEnd));
                        const doneDays = Math.round(duration * ms.status_progress);
                        
                        const partialDate = new Date(msStart);
                        partialDate.setDate(partialDate.getDate() + doneDays);
                        
                        if (partialDate > pVisualDate) {
                            pVisualDate = partialDate;
                        }
                        break; // Stop at first active task (Waterfall visual)
                    } else {
                        // Not Started (0%) - Stop here
                        break;
                    }
                }
            }
            // Group Progress is the MINIMUM of its projects (Bottleneck)
            if (!minProgressDate || pVisualDate < minProgressDate) minProgressDate = pVisualDate;

            const code = p._computedStatus.code;
            if (groupStats.hasOwnProperty(code)) groupStats[code]++;
            totalProjects++;
        });

        // --- Generate Group HTML ---
        let ghostBarHtml = '';
        if (minStart && maxEnd) {
            const gLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, minStart) * pixelsPerDay;
            const gWidth = getDaysDiff(minStart, maxEnd) * pixelsPerDay;
            let fillWidth = 0, dateLabel = "N/A";
            
            if (minProgressDate && minProgressDate > minStart) {
                fillWidth = Math.max(0, getDaysDiff(minStart, minProgressDate) * pixelsPerDay);
                // Cap fill width (in case visual date > max end for some reason)
                if (fillWidth > gWidth) fillWidth = gWidth;
                dateLabel = minProgressDate.toLocaleString('default', { month: 'short', day: 'numeric' });
            }
            ghostBarHtml = `<div class="group-ghost-bar" style="left: ${gLeft}px; width: ${gWidth}px;"><div class="ghost-progress-fill" style="width: ${fillWidth}px;" title="Overall Progress to: ${dateLabel}" data-bs-toggle="tooltip"></div></div>`;
        }

        let demandStripHtml = '';
        if (minStart && maxDemandEnd) {
            const dLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, minStart) * pixelsPerDay;
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
                // ... inside renderTracker, inside project.milestones.forEach ...

                // ... inside renderTracker function ...

                project.milestones.forEach((ms, mIndex) => {
                    // 1. Demand Bar
                    // REMOVE Math.max(..., 2). Trust the pure math for alignment.
                    const demandEndDate = ms.demand_due_date || ms.planned_end;
                    const demandLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, currentDemandAnchor) * pixelsPerDay;
                    const demandDiff = getDaysDiff(currentDemandAnchor, demandEndDate);
                    
                    // Inclusive Width: (Diff + 1) * px
                    // We use Math.max(..., 0.5) just to ensure it's barely visible if zoom is tiny, 
                    // but NOT 2px which breaks alignment.
                    const demandWidth = (demandDiff + 1) * pixelsPerDay;
                    
                    htmlBuffer += `<div class="gantt-bar demand-bar clickable" style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top" data-bs-content="Demand: ${ms.name}<br>Due: ${demandEndDate}"></div>`;

                    // 2. Prepare Dates
                    const revisedStart = ms.revised_start_date;
                    const revisedEnd = ms.revised_end_date;
                    const actualDate = ms.actual_completion_date;
                    
                    // 3. Determine Solid Bar End
                    let solidBarEnd = revisedEnd; 
                    let tailType = null, tailStart = null, tailEnd = null;

                    if (actualDate) {
                        if (new Date(actualDate) > new Date(revisedEnd)) { 
                            solidBarEnd = revisedEnd; 
                            tailType = 'late'; tailStart = revisedEnd; tailEnd = actualDate; 
                        } else if (new Date(actualDate) < new Date(revisedEnd)) { 
                            solidBarEnd = actualDate; 
                            tailType = 'early'; tailStart = actualDate; tailEnd = revisedEnd; 
                        } else { 
                            solidBarEnd = actualDate; 
                        }
                    } else if (CONFIG.CURRENT_DATE > new Date(revisedEnd)) {
                        solidBarEnd = revisedEnd; 
                        tailType = 'late'; tailStart = revisedEnd; tailEnd = CONFIG.CURRENT_DATE.toISOString().split('T')[0];
                    }

                    // 4. Render The Plan Bar (Container)
                    const planLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, revisedStart) * pixelsPerDay;
                    const planDays = getDaysDiff(revisedStart, solidBarEnd) + 1;
                    
                    // REMOVE Math.max(..., 2)
                    const planWidth = planDays * pixelsPerDay;
                    
                    // 5. Render The Progress Fill
                    let progressPct = Math.round(ms.status_progress * 100);
                    let progressStyleWidth = `${progressPct}%`;
                    if (ms.status_progress > 0 && planWidth < 5) progressStyleWidth = '100%';

                    // 6. Popover & Inner Content
                    const statusInfo = { isOverdue: !actualDate && CONFIG.CURRENT_DATE > new Date(revisedEnd) };
                    if (statusInfo.isOverdue) statusInfo.extraInfo = `🔥 Overdue: ${Math.floor(getDaysDiff(revisedEnd, CONFIG.CURRENT_DATE))} days`;
                    else if (tailType === 'late') statusInfo.extraInfo = `⚠️ Late by ${Math.floor(getDaysDiff(revisedEnd, actualDate))} days`;
                    else if (tailType === 'early') statusInfo.extraInfo = `✅ Early by ${Math.floor(getDaysDiff(actualDate, revisedEnd))} days`;

                    const popContent = createPopoverContent(ms, revisedStart, solidBarEnd, statusInfo).replace(/"/g, '&quot;');
                    
                    let innerContent = (planWidth > 60) ? `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${progressPct}%</span></div>` : '';
                    let animClass = (ms.status_progress > 0 && ms.status_progress < 1.0) ? 'active-anim' : '';

                    htmlBuffer += `
                        <div class="gantt-bar plan-bar clickable" 
                             style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};" 
                             data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" 
                             data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top" 
                             data-bs-content="${popContent}">
                             <div class="progress-overlay ${animClass}" style="width: ${progressStyleWidth}"></div>
                             ${innerContent}
                        </div>`;

                    // 7. Render Tails
                    if (tailType) {
                        const tailLeft = planLeft + planWidth; 
                        const tailDiffDays = Math.abs(getDaysDiff(tailStart, tailEnd));
                        
                        // REMOVE Math.max(..., 2). Precision is key here.
                        const tailWidth = tailDiffDays * pixelsPerDay;
                        
                        const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                        const isFinished = !!actualDate;
                        const displayActual = isFinished ? actualDate : `<span class="text-danger">In Progress (Today)</span>`;
                        
                        const tailPopover = tailType === 'late' ? 
                            `<div class="popover-body-content"><div class="mb-1"><strong>⚠️ Delay: ${ms.name}</strong></div><div class="text-danger mb-2">${isFinished ? 'Finished' : 'Overdue by'} ${tailDiffDays} days late</div><div style="border-top:1px solid #eee; padding-top:4px; font-size:11px;"><div>Target End: <b>${revisedEnd}</b></div><div>Actual End: <b>${displayActual}</b></div></div></div>` :
                            `<div class="popover-body-content"><div class="mb-1"><strong>✅ Saved: ${ms.name}</strong></div><div class="text-success mb-2">Finished ${tailDiffDays} days early</div><div style="border-top:1px solid #eee; padding-top:4px; font-size:11px;"><div>Target End: <b>${revisedEnd}</b></div><div>Actual End: <b>${displayActual}</b></div></div></div>`;
                        
                        htmlBuffer += `<div class="gantt-bar ${tailClass} clickable" style="left: ${tailLeft}px; width: ${tailWidth}px;" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-content="${tailPopover.replace(/"/g, '&quot;')}"></div>`;
                    }

                    // Next Anchor (+1 Day logic)
                    let nextAnchorDate = new Date(demandEndDate);
                    nextAnchorDate.setDate(nextAnchorDate.getDate() + 1);
                    currentDemandAnchor = nextAnchorDate;
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

    // Bind Events
    $('.group-row').click(function() { 
        if (currentFilter === 'ALL') { 
            currentRevisedData.groups[$(this).data('g-idx')].is_expanded = !currentRevisedData.groups[$(this).data('g-idx')].is_expanded; 
            renderTracker(currentRevisedData); 
        } 
    });
    
    // Init tooltips/popovers
    $container.off('mouseenter', '[data-bs-toggle="popover"]').on('mouseenter', '[data-bs-toggle="popover"]', function() { if (!bootstrap.Popover.getInstance(this)) new bootstrap.Popover(this).show(); });
    $container.off('mouseenter', '[data-bs-toggle="tooltip"]').on('mouseenter', '[data-bs-toggle="tooltip"]', function() { if (!bootstrap.Tooltip.getInstance(this)) new bootstrap.Tooltip(this).show(); });
}