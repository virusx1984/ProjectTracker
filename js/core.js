// --- Core Logic: Calculation & Processing ---
// 1. Dynamic Schedule Revision (Waterfall Calculation)
function reviseProjectData(originalData) {
    // Deep copy to avoid mutating the original data
    const revisedData = JSON.parse(JSON.stringify(originalData));
    
    // Helper: Format Date to 'YYYY-MM-DD' (Local Time)
    const toLocalYMD = (dateObj) => {
        const y = dateObj.getFullYear();
        const m = String(dateObj.getMonth() + 1).padStart(2, '0');
        const d = String(dateObj.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
    };

    // Helper: Parse 'YYYY-MM-DD' safely
    const parseLocal = (dateStr) => {
        if (!dateStr) return null;
        const parts = dateStr.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    };

    // Helper: Get difference in days
    const getDiff = (d1, d2) => {
        return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
    };

    const TODAY = new Date(CONFIG.CURRENT_DATE);
    TODAY.setHours(0,0,0,0);

    if (revisedData.data) {
        revisedData.data.forEach(group => {
            group.projects.forEach(project => {
                
                let prevEffectiveEnd = null; // The "Real" end of the previous task
                let prevPlannedEnd = parseLocal(project.start_date); // Tracking the original plan timeline

                project.milestones.forEach((ms, index) => {
                    // --- A. Calculate Original Duration (The "Truth") ---
                    // Duration = (My Planned End) - (Previous Task Planned End)
                    // This ensures "Production" keeps its 3-month length even if it moves.
                    let currentPlannedEnd = parseLocal(ms.planned_end);
                    if (!currentPlannedEnd) {
                        // Fallback if planned_end missing: use start + 10
                        currentPlannedEnd = new Date(prevPlannedEnd);
                        currentPlannedEnd.setDate(currentPlannedEnd.getDate() + 10);
                    }

                    // Duration should be at least 1 day
                    let durationDays = Math.max(1, getDiff(prevPlannedEnd, currentPlannedEnd));
                    ms.duration_days = durationDays; // Store for UI

                    // --- B. Determine Revised Start Date ---
                    // It starts after the previous task effectively finished (or Project Start for the first one)
                    let newStart;
                    if (index === 0) {
                        newStart = parseLocal(project.start_date);
                    } else {
                        newStart = new Date(prevEffectiveEnd);
                        newStart.setDate(newStart.getDate() + 1); // Start next day
                    }

                    // --- C. Determine Revised End Date ---
                    // End = New Start + Duration
                    let newEnd = new Date(newStart);
                    newEnd.setDate(newEnd.getDate() + durationDays);

                    // --- D. Write Back to Data ---
                    ms.revised_start_date = toLocalYMD(newStart);
                    ms.revised_end_date = toLocalYMD(newEnd);

                    // --- E. Calculate "Effective End" for the NEXT task ---
                    // This determines when the NEXT task can start.
                    let effectiveEndForChaining = newEnd;

                    if (ms.actual_completion_date) {
                        // Case 1: Finished. Next task starts after Actual.
                        effectiveEndForChaining = parseLocal(ms.actual_completion_date);
                    } else if (TODAY > newEnd) {
                        // Case 2: Unfinished & Overdue.
                        // It's dragging on... so effectively it "ends" Today (so next task is pushed).
                        effectiveEndForChaining = new Date(TODAY);
                    }

                    // Update loop variables
                    prevEffectiveEnd = effectiveEndForChaining;
                    prevPlannedEnd = currentPlannedEnd; // Move the plan cursor forward
                });
            });
        });
    }
    return revisedData;
}
// 2. Single Project Status Calculation (Fixed Logic)
function calculateSingleProjectStatus(project) {
    if (!project.milestones || project.milestones.length === 0) {
        return { code: 'NO_DATA', label: "No Data", class: "bg-secondary", priority: 0 };
    }

    const lastMs = project.milestones[project.milestones.length - 1];
    
    // Original Planned End & Demand Date
    const originalPlan = new Date(lastMs.planned_end);
    const demandDate = new Date(lastMs.demand_due_date || lastMs.planned_end);

    // Determine the "Effective" End Date
    // Start with the revised schedule
    let effectiveEnd = new Date(lastMs.revised_end_date);

    // FIX: If the last task is NOT finished, and Today is later than the scheduled end,
    // the project is effectively delayed until at least Today.
    if (lastMs.status_progress < 1.0 && CONFIG.CURRENT_DATE > effectiveEnd) {
        effectiveEnd = new Date(CONFIG.CURRENT_DATE);
    }

    // Now compare the Effective End against targets
    const isInternalDelayed = effectiveEnd > originalPlan;
    const isExternalRisk = effectiveEnd > demandDate;

    if (isExternalRisk) {
        if (isInternalDelayed) {
            // Late vs Plan AND Late vs Demand = Critical
            return { code: 'CRITICAL', label: "Critical", class: "bg-critical", priority: 4 }; 
        } else {
            // On time vs Plan, but Late vs Demand (Plan was bad)
            return { code: 'PLAN_FAIL', label: "Plan Fail", class: "bg-danger", priority: 3 };
        }
    } else {
        if (isInternalDelayed) {
            // Late vs Plan, but OK vs Demand
            return { code: 'BUFFER_USED', label: "Buffer Used", class: "bg-warning", priority: 2 };
        } else {
            // All Good
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

    // [UPDATED] Access .data instead of .groups
    if (data.data) {
        data.data.forEach(group => {
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
    }

    return { counts, data };
}

// 5. Auto-Scale Logic: Calculate Timeline Boundaries
function calculateAutoBounds(data) {
    let minTime = new Date("2099-12-31").getTime();
    let maxTime = new Date("1970-01-01").getTime();
    let hasData = false;

    // 1. Scan Data for Extremes
    // [UPDATED] Access .data instead of .groups
    if (data.data) {
        data.data.forEach(g => {
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
    }

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