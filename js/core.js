// --- Core Logic: Calculation & Processing ---

// 1. Dynamic Schedule Revision (Waterfall Calculation)
function reviseProjectData(originalData) {
    const revisedData = JSON.parse(JSON.stringify(originalData));
    
    revisedData.groups.forEach(group => {
        group.projects.forEach(project => {
            let chainCursor = new Date(project.start_date);
            let previousOriginalPlanEnd = new Date(project.start_date);

            project.milestones.forEach(ms => {
                const originalPlanEnd = new Date(ms.planned_end);
                // Calculate original planned duration
                const durationDays = Math.max(1, getDaysDiff(previousOriginalPlanEnd, originalPlanEnd));

                // Apply to current cursor
                const revisedStart = new Date(chainCursor);
                const revisedEnd = addDays(revisedStart, durationDays);

                // Update properties
                ms.revised_start_date = revisedStart.toISOString().split('T')[0];
                ms.revised_end_date = revisedEnd.toISOString().split('T')[0];
                ms.duration_days = Math.floor(durationDays);

                // Update Cursor for next task
                if (ms.actual_completion_date) {
                    chainCursor = new Date(ms.actual_completion_date);
                } else {
                    // If overdue, push out; otherwise keep plan
                    if (CONFIG.CURRENT_DATE > revisedEnd) {
                        chainCursor = new Date(CONFIG.CURRENT_DATE);
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

// 2. Single Project Status Calculation
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

// 3. Group Status Aggregation (Worst Case)
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

// 4. Main Preprocessing Pipeline
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

// 5. Auto-Scale Logic: Calculate Timeline Boundaries
function calculateAutoBounds(data) {
    let minTime = new Date("2099-12-31").getTime();
    let maxTime = new Date("1970-01-01").getTime();
    let hasData = false;

    // 1. Scan Data for Extremes
    data.groups.forEach(g => {
        g.projects.forEach(p => {
            hasData = true;
            // Check Project Start
            const pStart = new Date(p.start_date).getTime();
            if (pStart < minTime) minTime = pStart;

            // Check Milestones (Revised End & Demand Date)
            p.milestones.forEach(ms => {
                const rEnd = new Date(ms.revised_end_date).getTime();
                const dDue = ms.demand_due_date ? new Date(ms.demand_due_date).getTime() : 0;
                
                if (rEnd > maxTime) maxTime = rEnd;
                if (dDue > maxTime) maxTime = dDue;
            });
        });
    });

    // Handle Empty Data Case
    if (!hasData) {
        // Default: Today - 1 month to Today + 6 months
        const defStart = new Date(CONFIG.CURRENT_DATE);
        defStart.setMonth(defStart.getMonth() - 1);
        CONFIG.TRACKER_START_DATE = defStart;
        CONFIG.RENDER_MONTHS = 6;
        return;
    }

    // 2. Include "Today" in the view (Ensure today is always visible)
    const todayTime = CONFIG.CURRENT_DATE.getTime();
    if (todayTime < minTime) minTime = todayTime;
    if (todayTime > maxTime) maxTime = todayTime;

    // 3. Apply Buffer (Padding)
    // Start: 1 month before the earliest date
    const newStart = new Date(minTime);
    newStart.setDate(1); // Snap to first of the month
    newStart.setMonth(newStart.getMonth() - 1); 

    // End: 2 months after the latest date (for popover space)
    const newEnd = new Date(maxTime);
    newEnd.setDate(1);
    newEnd.setMonth(newEnd.getMonth() + 2);

    // 4. Update Global Configuration
    CONFIG.TRACKER_START_DATE = newStart;

    // Calculate total months duration
    const monthsDiff = (newEnd.getFullYear() - newStart.getFullYear()) * 12 + (newEnd.getMonth() - newStart.getMonth());
    
    // Ensure at least 6 months render to look good
    CONFIG.RENDER_MONTHS = Math.max(6, monthsDiff);
    
    // Optional: Log for debugging
    // console.log("Auto-Scale:", newStart.toISOString().split('T')[0], "to", newEnd.toISOString().split('T')[0], "Months:", CONFIG.RENDER_MONTHS);
}