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