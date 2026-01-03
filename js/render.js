
// --- UI Rendering Logic ---

// --- Helper: Parse 'YYYY-MM-DD' string to Local Date Object ---
// (Prevents UTC conversion bugs. '2026-01-04' becomes Jan 4th 00:00 Local)
function parseLocalYMD(dateStr) {
    if (!dateStr) return null;
    const parts = dateStr.split('-');
    // new Date(year, monthIndex, day) constructs a Local Time object
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
}

// --- Helper: Format Date to 'YYYY-MM-DD' (Local Time) ---
function formatLocalYMD(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function createPopoverContent(ms, origStart, origEnd, revStart, revEnd, status) {
    let badgeClass = 'bg-secondary';
    let statusText = 'Pending';
    
    // 1. Default Display Values (Revised Plan)
    let displayEnd = revEnd;
    let displayDuration = ms.duration_days;

    // 2. Logic: If task is finished (100%), override with Actual Data
    if (ms.status_progress === 1.0) { 
        badgeClass = 'bg-success'; 
        statusText = 'Done'; 
        
        // Use Actual Completion Date if available
        if (ms.actual_completion_date) {
            displayEnd = ms.actual_completion_date;
            // Recalculate Duration: (Actual End - Revised Start) + 1 Day (Inclusive)
            displayDuration = getDaysDiff(revStart, displayEnd) + 1;
        }
    }
    else if (status.isOverdue) { badgeClass = 'bg-danger'; statusText = 'Overdue'; } 
    else if (ms.status_progress > 0) { badgeClass = 'bg-primary'; statusText = 'In Progress'; }

    const progressPct = Math.round(ms.status_progress * 100);

    // [New Logic] Calculate the date corresponding to current progress
    let progressDateSuffix = "";
    if (ms.status_progress > 0 && ms.status_progress < 1.0) {
        // Total duration (inclusive of start and end dates)
        const totalRevDays = getDaysDiff(revStart, revEnd) + 1;
        // Completed days based on percentage
        const completedDays = Math.round(totalRevDays * ms.status_progress);
        
        // Calculate Date: Start Date + (Completed Days - 1)
        let progressDate = new Date(revStart);
        if (completedDays > 0) {
            progressDate.setDate(progressDate.getDate() + (completedDays - 1));
        }
        // Generate display string (e.g., " ~ 2025-12-21")
        progressDateSuffix = ` <span style="font-weight:normal; opacity:0.8;">(~ ${progressDate.toISOString().split('T')[0]})</span>`;
    }

    return `
        <div class="popover-body-content">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <strong style="color:${ms.color}">${ms.name}</strong>
                <span class="badge ${badgeClass}">${statusText}</span>
            </div>
            ${ms.description ? `<div class="mb-2 text-muted small"><em>${ms.description}</em></div>` : ''}
            
            <div class="info-row text-muted" style="font-size: 11px; margin-bottom: 2px;">
                <span class="icon">🏳️</span> 
                <span>Plan: ${origStart} ➝ ${origEnd}</span>
            </div>

            <div class="info-row">
                <span class="icon">📅</span> 
                <span><b>Curr: ${revStart} ➝ ${displayEnd}</b></span>
            </div>

            <div class="info-row"><span class="icon">⏱️</span> <span>Duration: <b>${displayDuration} Days</b></span></div>
            
            <div class="info-row"><span class="icon">📊</span> <span>Progress: <b>${progressPct}%</b>${progressDateSuffix}</span></div>
            
            ${status.extraInfo ? `<div class="info-row text-danger mt-1 border-top pt-1"><small>${status.extraInfo}</small></div>` : ''}
            
            <div class="mt-2 text-center text-muted" style="font-size:10px; border-top:1px solid #eee; padding-top:4px;"><i>(Click bar to edit)</i></div>
        </div>
    `;
}

// --- 1. UI Redesign: Dashboard Header with Integrated Action Toolbar ---
function renderDashboardStats(counts) {
    const $container = $('#dashboard-stats-container');
    $container.empty();
    
    // Set container to Flexbox for "Split View" (Stats Left | Actions Right)
    $container.addClass('d-flex justify-content-between align-items-center mb-3');

    // A. Left Side: Stats Cards
    const cardsConfig = [
        { code: 'ALL', label: 'All Projects', colorClass: 'bg-primary' }, 
        { code: 'EXCELLENT', label: 'Excellent', colorClass: 'bg-success' },
        { code: 'BUFFER_USED', label: 'Buffer Used', colorClass: 'bg-warning' },
        { code: 'PLAN_FAIL', label: 'Plan Fail', colorClass: 'bg-danger' },
        { code: 'CRITICAL', label: 'Critical', colorClass: 'bg-critical' }
    ];

    let statsHtml = '<div class="d-flex gap-2">';
    cardsConfig.forEach(cfg => {
        const count = counts[cfg.code] || 0;
        const isActive = currentFilter === cfg.code ? 'active' : '';
        statsHtml += `
            <div class="stat-card ${isActive}" data-filter="${cfg.code}">
                <div class="color-bar ${cfg.colorClass}"></div>
                <div class="stat-count">${count}</div>
                <div class="stat-label">${cfg.label}</div>
            </div>
        `;
    });
    statsHtml += '</div>';

    // B. Right Side: Professional Action Toolbar
    const actionsHtml = `
        <div class="d-flex align-items-center">
            <button class="btn btn-outline-primary btn-sm d-flex align-items-center gap-2 shadow-sm" id="btn-open-create-project" style="border-radius: 6px; font-weight: 500;">
                <i class="bi bi-plus-lg"></i>
                <span>New Project</span>
            </button>
        </div>
    `;

    $container.append(statsHtml + actionsHtml);

    // Bind Filter Click
    $('.stat-card').click(function() {
        const newFilter = $(this).data('filter');
        if (newFilter !== currentFilter) {
            currentFilter = newFilter;
            // Update active state visually without full re-render for speed
            $('.stat-card').removeClass('active');
            $(this).addClass('active');
            renderTracker(currentRevisedData);
        }
    });
}

// --- 2. Render Tracker with Sortable Wrappers ---
// --- 2. Render Tracker with Sortable Wrappers ---
// --- Main Entry Point ---
function renderTracker(data) {
    const $container = $('#projects-container');
    const $headerTicks = $('#header-ticks-container');
    
    // 1. Cleanup
    $container.empty();
    $headerTicks.empty();
    $container.css('position', 'relative');

    // 2. Render Header (Returns total width needed for rows)
    const totalTimelineWidth = _renderTimelineHeader($headerTicks);

    // 3. Render "Today" Marker
    _renderTodayMarker($container, $headerTicks, totalTimelineWidth);

    // 4. Render Rows (Groups & Projects)
    _renderProjectRows($container, data, totalTimelineWidth);
    
    // 5. Global Event Listeners (Re-attach)
    // Group Toggle
    $('.group-row').off('click').on('click', function() { 
        if (currentFilter === 'ALL') { 
            const gIdx = $(this).data('g-idx');
            if(currentRevisedData.data[gIdx]) {
                currentRevisedData.data[gIdx].is_expanded = !currentRevisedData.data[gIdx].is_expanded; 
                renderTracker(currentRevisedData); 
            }
        } 
    });

    // Popovers & Tooltips
    $container.find('[data-bs-toggle="popover"]').popover();
    $container.find('[data-bs-toggle="tooltip"]').tooltip();
}

function _renderTimelineHeader($headerTicks) {
    let totalTimelineWidth = 0;
    
    // View Thresholds
    const THRESHOLD_QUARTER = 1.8;
    const THRESHOLD_HALFYEAR = 0.8;
    const THRESHOLD_YEAR = 0.4;     
    const THRESHOLD_SHOW_DAYS = 4.0;    

    const isYearView = pixelsPerDay < THRESHOLD_YEAR;
    const isHalfYearView = !isYearView && pixelsPerDay < THRESHOLD_HALFYEAR;
    const isQuarterView = !isYearView && !isHalfYearView && pixelsPerDay < THRESHOLD_QUARTER;

    for(let i=0; i < CONFIG.RENDER_MONTHS; i++) {
        let targetMonthDate = new Date(CONFIG.TRACKER_START_DATE);
        targetMonthDate.setMonth(targetMonthDate.getMonth() + i);
        
        let daysFromStart = getDaysDiff(CONFIG.TRACKER_START_DATE, targetMonthDate);
        let leftPos = daysFromStart * pixelsPerDay;
        
        const currentYear = targetMonthDate.getFullYear();
        const currentMonthIdx = targetMonthDate.getMonth(); 
        const shortMonth = targetMonthDate.toLocaleString('default', { month: 'short' }); 
        
        // --- Tick Rendering Logic ---
        if (isYearView) {
            if (currentMonthIdx % 12 === 0) {
                let labelHtml = `<span class="year-label" style="font-size:14px; font-weight:800; opacity:1;">${currentYear}</span>`;
                $headerTicks.append(`<div class="time-mark year-boundary" style="left: ${leftPos}px">${labelHtml}</div>`);
            }
        }
        else if (isHalfYearView) {
            if (currentMonthIdx % 6 === 0) {
                const hNum = Math.floor(currentMonthIdx / 6) + 1; 
                let labelHtml = (currentMonthIdx === 0 || i === 0) 
                    ? `<span class="year-label">${currentYear}</span> H${hNum}` 
                    : `H${hNum}`;
                let boundaryClass = (currentMonthIdx === 0) ? "year-boundary" : "";
                $headerTicks.append(`<div class="time-mark ${boundaryClass}" style="left: ${leftPos}px">${labelHtml}</div>`);
            }
        } 
        else if (isQuarterView) {
            if (currentMonthIdx % 3 === 0) {
                const qNum = Math.floor(currentMonthIdx / 3) + 1; 
                let labelHtml = (currentMonthIdx === 0 || i === 0) 
                    ? `<span class="year-label">${currentYear}</span> Q${qNum}` 
                    : `Q${qNum}`;
                let boundaryClass = (currentMonthIdx === 0) ? "year-boundary" : "";
                $headerTicks.append(`<div class="time-mark ${boundaryClass}" style="left: ${leftPos}px">${labelHtml}</div>`);
            }
        } 
        else {
            // Month View
            const isJanuary = currentMonthIdx === 0;
            let labelHtml = (i === 0 || isJanuary) ? `<span class="year-label">${currentYear}</span>${shortMonth}` : shortMonth;
            let boundaryClass = isJanuary ? "year-boundary" : "";
            $headerTicks.append(`<div class="time-mark ${boundaryClass}" style="left: ${leftPos}px">${labelHtml}</div>`);
        }

        // --- Day Ticks ---
        let daysInMonth = new Date(targetMonthDate.getFullYear(), targetMonthDate.getMonth() + 1, 0).getDate();
        if (pixelsPerDay >= THRESHOLD_SHOW_DAYS) {
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
    return totalTimelineWidth; // Return for use in rows
}

function _renderTodayMarker($container, $headerTicks, totalTimelineWidth) {
    const todayOffsetDays = getDaysDiff(CONFIG.TRACKER_START_DATE, CONFIG.CURRENT_DATE) + 1;
    if (todayOffsetDays >= 0) {
        const todayLeft = todayOffsetDays * pixelsPerDay;
        const sidebarWidth = $('.header-corner-placeholder').outerWidth() || 220;
        
        // 1. Header Trigger (Visual Gradient + Hit Box)
        const headerTriggerStyle = `
            position: absolute; 
            left: ${todayLeft - 5}px; 
            top: 0; 
            bottom: 0; 
            width: 11px; 
            z-index: 100;
            cursor: help;
            background-image: linear-gradient(to right, transparent 5px, rgba(220, 53, 69, 0.5) 5px, rgba(220, 53, 69, 0.5) 6px, transparent 6px);
            background-size: 100% 4px; 
            background-repeat: repeat-y;
        `;
        $headerTicks.append(`<div class="today-header-trigger" style="${headerTriggerStyle}"></div>`);

        // Popover
        const dateStr = CONFIG.CURRENT_DATE.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
        const popupContent = `<div class="text-center p-1"><div class="text-danger fw-bold mb-1">${dateStr}</div><div class="small text-muted">Today</div></div>`;
        const triggerEl = $headerTicks.find('.today-header-trigger')[0];
        if (triggerEl) { 
            new bootstrap.Popover(triggerEl, { trigger: 'hover focus', html: true, placement: 'bottom', content: popupContent }); 
        }

        // 2. Body Line (Overlay)
        const lineStyle = `
            position: absolute;
            left: ${todayLeft + sidebarWidth}px; 
            top: 0;
            bottom: 0;
            width: 0;
            border-left: 1px dashed rgba(220, 53, 69, 0.5);
            z-index: 50; 
            pointer-events: none;
        `;
        $container.append(`<div class="today-dashed-line" style="${lineStyle}"></div>`);

        // 3. Past Zone
        $container.append(`<div class="past-time-zone" style="width: ${todayLeft + sidebarWidth}px;"></div>`);
    }
}

function _renderProjectRows($container, data, totalTimelineWidth) {
    let htmlBuffer = ""; 
    let visibleCount = 0;
    const groupsToRender = data.data || [];

    // Text Visibility Thresholds
    const THRESHOLD_TEXT_HIDE = 40;
    const THRESHOLD_TEXT_FULL = 70;

    groupsToRender.forEach((group, gIndex) => {
        const matchingProjects = group.projects.filter(p => currentFilter === 'ALL' || p._computedStatus.code === currentFilter);
        if (currentFilter !== 'ALL' && matchingProjects.length === 0) return;

        // --- Calculate Group Stats ---
        let minStart = null, maxEnd = null, maxDemandEnd = null, minProgressDate = null;
        const groupStats = { 'CRITICAL': 0, 'PLAN_FAIL': 0, 'BUFFER_USED': 0, 'EXCELLENT': 0 };
        let totalProjects = 0;
        
        group.projects.forEach(p => {
             const pStart = parseLocalYMD(p.start_date); 
             if (!minStart || pStart < minStart) minStart = pStart;
             if (!maxEnd || pStart > maxEnd) maxEnd = pStart;
             if (!maxDemandEnd || pStart > maxDemandEnd) maxDemandEnd = pStart;
             
             p.milestones.forEach(ms => {
                const msStart = parseLocalYMD(ms.revised_start_date);
                let msEnd = parseLocalYMD(ms.revised_end_date);
                if (!ms.actual_completion_date && CONFIG.CURRENT_DATE > msEnd) { msEnd = new Date(CONFIG.CURRENT_DATE); }
                
                if (msStart < minStart) minStart = msStart;
                if (msEnd > maxEnd) maxEnd = msEnd;
                
                const msDemand = parseLocalYMD(ms.demand_due_date || ms.planned_end);
                if (msDemand > maxDemandEnd) maxDemandEnd = msDemand;
            });
            
            // Group Ghost Bar Logic
            let pVisualDate = new Date(pStart);
            if (p.milestones.length > 0) {
                 for (let i = 0; i < p.milestones.length; i++) {
                    const ms = p.milestones[i];
                    const msStart = parseLocalYMD(ms.revised_start_date);
                    let msEnd = parseLocalYMD(ms.revised_end_date);
                    if (ms.status_progress === 1.0) {
                        let effectiveDoneDate = ms.actual_completion_date ? parseLocalYMD(ms.actual_completion_date) : msEnd;
                        if (effectiveDoneDate > pVisualDate) pVisualDate = effectiveDoneDate;
                    } else if (ms.status_progress > 0) {
                        const totalDays = getDaysDiff(msStart, msEnd) + 1;
                        const doneDays = Math.round(totalDays * ms.status_progress);
                        const partialDate = new Date(msStart);
                        if (doneDays > 0) partialDate.setDate(partialDate.getDate() + (doneDays - 1));
                        else partialDate.setDate(partialDate.getDate() - 1);
                        if (partialDate > pVisualDate) pVisualDate = partialDate;
                        break;
                    } else { break; }
                }
            }
            if (!minProgressDate || pVisualDate < minProgressDate) minProgressDate = pVisualDate;
            
            if (groupStats.hasOwnProperty(p._computedStatus.code)) groupStats[p._computedStatus.code]++;
            totalProjects++;
        });

        // Generate Group HTML (Stats/Header)
        let demandStripHtml = '';
        if (minStart && maxDemandEnd) {
             const dLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, minStart) * pixelsPerDay;
             const dWidth = (getDaysDiff(minStart, maxDemandEnd) + 1) * pixelsPerDay;
             demandStripHtml = `<div class="group-demand-strip" style="left: ${dLeft}px; width: ${dWidth}px;" title="Demand/Target Limit: ${formatLocalYMD(maxDemandEnd)}" data-bs-toggle="tooltip"></div>`;
        }
        
        let ghostBarHtml = '';
        if (minStart && maxEnd) {
             const gLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, minStart) * pixelsPerDay;
             const gWidth = (getDaysDiff(minStart, maxEnd) + 1) * pixelsPerDay;
             let fillWidth = 0, dateLabel = "N/A";
             if (minProgressDate && minProgressDate >= minStart) {
                 fillWidth = Math.max(0, (getDaysDiff(minStart, minProgressDate) + 1) * pixelsPerDay);
                 if (fillWidth > gWidth) fillWidth = gWidth;
                 dateLabel = minProgressDate.toLocaleString('default', { month: 'short', day: 'numeric' });
             }
             ghostBarHtml = `<div class="group-ghost-bar" style="left: ${gLeft}px; width: ${gWidth}px;"><div class="ghost-progress-fill" style="width: ${fillWidth}px;" title="Overall Progress to: ${dateLabel}" data-bs-toggle="tooltip"></div></div>`;
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
                    <div class="d-flex flex-column justify-content-center w-100 pe-2" style="overflow: hidden;">
                        <div class="d-flex align-items-center" style="width: 100%;">
                            <span class="fw-bold text-truncate me-auto" title="${group.group_name}">${group.group_name}</span>
                            <span class="badge bg-secondary flex-shrink-0 ms-1" style="font-size:9px">${matchingProjects.length}</span>
                        </div>
                        <div class="group-health-bar mt-1">${healthBarSegments}</div>
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
                    <div class="project-row" data-g-idx="${gIndex}" data-p-idx="${pIndex}">
                        <div class="project-name-label d-flex">
                            ${statusStrip}
                            <div class="d-flex flex-column justify-content-center overflow-hidden flex-grow-1 ps-2">
                                <div class="fw-bold text-dark text-truncate project-name-clickable" 
                                     data-g-idx="${gIndex}" data-p-idx="${pIndex}" 
                                     data-bs-toggle="popover" data-bs-trigger="hover" data-bs-placement="top" 
                                     data-bs-content="${project.project_name}">
                                    ${project.project_name}
                                </div>
                            </div>
                        </div>
                        <div class="milestone-container" id="milestones-${project.project_id}" style="min-width: ${totalTimelineWidth}px">
                `;

                let currentDemandAnchor = parseLocalYMD(project.start_date);
                
                project.milestones.forEach((ms, mIndex) => {
                    // --- 1. Basic Data Parsing (No complex shifts here anymore!) ---
                    // Core.js has already done the shifting for us!
                    let visStart = parseLocalYMD(ms.revised_start_date);
                    let visEnd = parseLocalYMD(ms.revised_end_date);
                    
                    // --- 2. Render Bars ---
                    // Demand Bar
                    const demandEndDate = ms.demand_due_date || ms.planned_end;
                    const demandDateObj = parseLocalYMD(demandEndDate);
                    const demandLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, currentDemandAnchor) * pixelsPerDay;
                    const demandWidth = (getDaysDiff(currentDemandAnchor, demandDateObj) + 1) * pixelsPerDay;
                    htmlBuffer += `<div class="gantt-bar demand-bar clickable" style="left: ${demandLeft}px; width: ${demandWidth}px; background-color: ${ms.color};" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top" data-bs-content="Demand: ${ms.name}<br>Due: ${demandEndDate}"></div>`;

                    // Plan Bar (Visual)
                    const actualDate = ms.actual_completion_date ? parseLocalYMD(ms.actual_completion_date) : null;
                    let solidBarEnd = visEnd; 
                    let tailType = null, tailStart = null, tailEnd = null;
                    
                    if (actualDate) {
                        if (actualDate > visEnd) { 
                            solidBarEnd = visEnd; tailType = 'late'; tailStart = visEnd; tailEnd = actualDate; 
                        } else if (actualDate < visEnd) { 
                            solidBarEnd = actualDate; tailType = 'early'; tailStart = actualDate; tailEnd = visEnd; 
                        } else { solidBarEnd = actualDate; }
                    } else if (CONFIG.CURRENT_DATE > visEnd) {
                        // Late / Overdue
                        solidBarEnd = visEnd; tailType = 'late'; tailStart = visEnd; 
                        tailEnd = new Date(CONFIG.CURRENT_DATE); // Use Local Today
                    }

                    const planLeft = getDaysDiff(CONFIG.TRACKER_START_DATE, visStart) * pixelsPerDay;
                    const planWidth = (getDaysDiff(visStart, solidBarEnd) + 1) * pixelsPerDay;

                    // Progress
                    const totalPlanDays = getDaysDiff(visStart, solidBarEnd) + 1;
                    const completedDays = Math.round(totalPlanDays * ms.status_progress);
                    const progressPixelWidth = completedDays * pixelsPerDay;
                    const progressStyleWidth = (ms.status_progress <= 0 || progressPixelWidth <= 0) ? '0px' : `${progressPixelWidth}px`;
                    
                    // Popover Content
                    let origStartStr = project.start_date;
                    if (mIndex > 0) {
                        let prevPlanObj = parseLocalYMD(project.milestones[mIndex - 1].planned_end);
                        prevPlanObj.setDate(prevPlanObj.getDate() + 1);
                        origStartStr = formatLocalYMD(prevPlanObj);
                    }
                    
                    const statusInfo = { isOverdue: !actualDate && CONFIG.CURRENT_DATE > visEnd };
                    if (statusInfo.isOverdue) statusInfo.extraInfo = `🔥 Overdue: ${Math.floor(getDaysDiff(visEnd, CONFIG.CURRENT_DATE))} days`;
                    else if (tailType === 'late') statusInfo.extraInfo = `⚠️ Late by ${Math.floor(getDaysDiff(visEnd, tailEnd))} days`;
                    
                    const popContent = createPopoverContent(ms, origStartStr, ms.planned_end, formatLocalYMD(visStart), formatLocalYMD(visEnd), statusInfo).replace(/"/g, '&quot;');
                    
                    // Text Visibility
                    let innerContent = '';
                    if (planWidth >= THRESHOLD_TEXT_HIDE) {
                        const pct = Math.round(ms.status_progress * 100);
                        if (planWidth > THRESHOLD_TEXT_FULL) {
                             innerContent = `<div class="plan-bar-content"><span class="plan-name">${ms.name}</span><span class="plan-pct">${pct}%</span></div>`;
                        } else {
                             innerContent = `<div class="plan-bar-content"><span class="plan-name" style="font-size:10px;">${ms.name}</span></div>`;
                        }
                    } 
                    let animClass = (ms.status_progress > 0 && ms.status_progress < 1.0) ? 'active-anim' : '';

                    htmlBuffer += `<div class="gantt-bar plan-bar clickable" style="left: ${planLeft}px; width: ${planWidth}px; background-color: ${ms.color};" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-placement="top" data-bs-content="${popContent}"><div class="progress-overlay ${animClass}" style="width: ${progressStyleWidth}"></div>${innerContent}</div>`;

                    // Tail Bar
                    if (tailType) {
                        const tailLeft = planLeft + planWidth; 
                        const tailDiffDays = Math.abs(getDaysDiff(tailStart, tailEnd));
                        const tailWidth = tailDiffDays * pixelsPerDay;
                        const tailClass = tailType === 'late' ? 'gantt-tail-delay' : 'gantt-tail-early';
                        const displayActual = actualDate ? formatLocalYMD(actualDate) : `<span class="text-danger">In Progress (Today)</span>`;
                        const tailPopover = `<div class="popover-body-content"><div class="mb-1"><strong>${tailType==='late'?'⚠️ Delay':'✅ Saved'}: ${ms.name}</strong></div><div class="${tailType==='late'?'text-danger':'text-success'} mb-2">${tailDiffDays} days ${tailType}</div><div style="border-top:1px solid #eee; padding-top:4px; font-size:11px;"><div>Target End: <b>${formatLocalYMD(visEnd)}</b></div><div>Actual End: <b>${displayActual}</b></div></div></div>`;
                        htmlBuffer += `<div class="gantt-bar ${tailClass} clickable" style="left: ${tailLeft}px; width: ${tailWidth}px;" data-g-idx="${gIndex}" data-p-idx="${pIndex}" data-m-idx="${mIndex}" data-bs-toggle="popover" data-bs-trigger="hover focus" data-bs-html="true" data-bs-content="${tailPopover.replace(/"/g, '&quot;')}"></div>`;
                    }
                    
                    // Update Anchor for next demand bar
                    let nextAnchorDate = new Date(demandDateObj);
                    nextAnchorDate.setDate(nextAnchorDate.getDate() + 1);
                    currentDemandAnchor = nextAnchorDate;
                });
                htmlBuffer += `</div></div>`;
            });
        }
    });

    if (visibleCount === 0 && currentFilter !== 'ALL' && groupsToRender.length > 0) {
        $container.html(`<div class="empty-state"><i class="bi bi-folder2-open display-4 mb-3"></i><h5>No projects found</h5><p>There are no projects matching the "<strong>${currentFilter}</strong>" filter.</p></div>`);
    } else if (groupsToRender.length === 0) {
         $container.html(`<div class="empty-state">No Data Loaded</div>`);
    } else {
        $container.html(htmlBuffer);
    }
}

