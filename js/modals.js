// --- Modal Handlers ---

// 1. Edit Milestone Handler
function initEditHandlers() {
    const modalEl = document.getElementById('editMilestoneModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    const $errorMsg = $('#edit-error-msg'); 

    $(modalEl).on('hidden.bs.modal', function () { $errorMsg.addClass('d-none').text(''); });

    $(modalEl).on('hide.bs.modal', function () {
        if (document.activeElement) {
            document.activeElement.blur();
        }
    });

    $('#projects-container').on('click', '.clickable', function (e) {
        e.stopPropagation(); 
        if (bootstrap.Popover.getInstance(this)) bootstrap.Popover.getInstance(this).hide();
        $errorMsg.addClass('d-none').text('');

        const gIdx = $(this).data('g-idx'), pIdx = $(this).data('p-idx'), mIdx = $(this).data('m-idx');
        
        // [UPDATED] Access .data instead of .groups
        const group = currentRevisedData.data[gIdx];
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
        updateProgressDisplay();

        modal.show();
    });

    // [NEW] Dynamic Progress Date Calculator
    // [NEW] Bubble & Date Calculator
    const updateProgressDisplay = () => {
        const $input = $('#edit-progress');
        const $bubble = $('#progress-bubble');
        const $pctText = $('#edit-progress-val'); // The static text label

        const progVal = parseFloat($input.val()); // 0.0 to 1.0
        const pct = Math.round(progVal * 100);
        
        // 1. Update Static Percentage Label
        $pctText.text(`${pct}%`);

        // 2. Calculate Bubble Position
        // Move bubble using CSS 'left' percentage. 
        // transform: translateX(-50%) in CSS handles the centering alignment.
        // We add a tiny offset logic if you want strict adherence to thumb width, 
        // but for Bootstrap inputs, raw percentage is usually visually sufficient.
        const positionPct = progVal * 100;
        $bubble.css('left', `calc(${positionPct}% + (${8 - positionPct * 0.15}px))`); 
        // (The calc formula slightly adjusts for the thumb width so it doesn't drift at edges)

        // 3. Calculate Bubble Content (Date)
        const startStr = $('#edit-revised-start').val();
        const endStr = $('#edit-revised-end').val();
        
        // Helper: Local Date Parser
        const parseLocal = (s) => {
            if (!s) return null;
            const p = s.split('-');
            return new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
        };

        let bubbleHtml = "N/A";

        if (startStr && endStr) {
            const startDate = parseLocal(startStr);
            const endDate = parseLocal(endStr);

            if (endDate >= startDate) {
                if (pct === 0) {
                    // Start
                    bubbleHtml = `Start: ${startStr}`;
                    $bubble.removeClass('bg-success bg-primary').addClass('bg-dark');
                } else if (pct === 100) {
                    // Done
                    bubbleHtml = `Done!`; // Or "Finished"
                    $bubble.removeClass('bg-dark bg-primary').addClass('bg-success');
                } else {
                    // Middle - Calculate Date
                    const totalDays = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
                    const daysDone = Math.round(totalDays * progVal);
                    const offset = Math.max(0, daysDone - 1);
                    
                    const calcDate = new Date(startDate);
                    calcDate.setDate(calcDate.getDate() + offset);

                    // Format
                    const y = calcDate.getFullYear();
                    const m = String(calcDate.getMonth() + 1).padStart(2, '0');
                    const d = String(calcDate.getDate()).padStart(2, '0');
                    
                    bubbleHtml = `${y}-${m}-${d}`;
                    $bubble.removeClass('bg-dark bg-success').addClass('bg-primary');
                }
            }
        }
        
        $bubble.html(bubbleHtml);
        $bubble.css('opacity', '1'); // Ensure visible once calculated
    };

    // [MODIFIED] Bind events to both Progress Slider AND Revised End Date
    // This ensures the date updates if the user drags the slider OR changes the end date
    $('#edit-progress, #edit-revised-end').on('input', updateProgressDisplay);
    
    // 1. Set Today Button: Sets Date to Today AND Progress to 100%
    $('#btn-set-today').click(function() {
        const today = new Date().toISOString().split('T')[0];
        $('#edit-actual-date').val(today);
        $('#edit-progress').val(1.0);
        updateProgressDisplay(); // Force update
    });

    // 2. Clear Date Button
    $('#btn-clear-date').click(function() {
        $('#edit-actual-date').val('');
        $('#edit-progress').val(0);
        updateProgressDisplay(); // Force update
    });

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

        // [UPDATED] Access .data instead of .groups
        const project = rawTrackerData.data[gIdx].projects[pIdx];
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

        // [UPDATED] Access .data
        const msData = rawTrackerData.data[gIdx].projects[pIdx].milestones[mIdx];
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


// [MODIFIED] Project Structure Handler with "Position Order" Logic
function initProjectStructureHandlers() {
    const modalEl = document.getElementById('editProjectStructureModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });

    // [NEW FIX] Prevent aria-hidden warning
    $(modalEl).on('hide.bs.modal', function () {
        if (document.activeElement) document.activeElement.blur();
    });

    const listContainer = document.getElementById('milestone-list-container');
    let tempMilestones = []; 
    let sortableInstance = null;

    // Inject "Delete" button if missing
    const $modalFooter = $(modalEl).find('.modal-footer');
    if ($modalFooter.find('#btn-delete-project').length === 0) {
        $modalFooter.prepend('<button type="button" class="btn btn-danger me-auto" id="btn-delete-project"><i class="bi bi-trash"></i> Delete Project</button>');
    }

    // [NEW] Inject "Parent Group" AND "Display Order" Selects
    const $modalBody = $(modalEl).find('.modal-body');
    if ($('#struct-group-select').length === 0) {
        $modalBody.find('#struct-proj-name').parent().after(`
            <div class="row mb-3">
                <div class="col-8">
                    <label class="form-label fw-bold small text-muted">Parent Group</label>
                    <select class="form-select form-select-sm" id="struct-group-select"></select>
                    <input type="text" class="form-control form-control-sm mt-1 d-none" id="struct-new-group-name" placeholder="Enter new group name...">
                </div>
                <div class="col-4">
                    <label class="form-label fw-bold small text-muted">Display Order</label>
                    <select class="form-select form-select-sm" id="struct-order-select"></select>
                </div>
            </div>
        `);
    }

    // Helper: Populate Order Select based on selected Group
    function updateOrderSelect(targetGroupIdx, currentPIdx = -1) {
        const $orderSelect = $('#struct-order-select');
        $orderSelect.empty();
        
        let count = 0;
        if (targetGroupIdx === '__NEW__') {
            count = 0; // New group has 0 existing projects, so we will become #1
        } else {
            // [UPDATED] Access .data
            count = rawTrackerData.data[targetGroupIdx].projects.length;
        }

        const originalGIdx = parseInt($('#struct-g-idx').val());
        const isSameGroup = (targetGroupIdx == originalGIdx); 
        
        const maxPos = isSameGroup ? count : count + 1;
        
        for (let i = 1; i <= maxPos; i++) {
            $orderSelect.append(`<option value="${i - 1}">Position ${i}${i===maxPos ? ' (Last)' : ''}</option>`);
        }

        if (isSameGroup && currentPIdx !== -1) {
            $orderSelect.val(currentPIdx);
        } else {
            $orderSelect.val(maxPos - 1);
        }
    }

    // Event: Toggle New Group Input & Update Order
    $('#struct-group-select').change(function() {
        const val = $(this).val();
        if (val === '__NEW__') {
            $('#struct-new-group-name').removeClass('d-none').focus();
        } else {
            $('#struct-new-group-name').addClass('d-none');
        }
        updateOrderSelect(val);
    });

    $('#projects-container').on('click', '.project-name-clickable', function (e) {
        e.stopPropagation();
        const gIdx = $(this).data('g-idx'), pIdx = $(this).data('p-idx');
        
        // [UPDATED] Access .data
        const project = rawTrackerData.data[gIdx].projects[pIdx];

        $('#struct-g-idx').val(gIdx);
        $('#struct-p-idx').val(pIdx);
        $('#struct-proj-name').val(project.project_name);
        $('#struct-proj-desc').val(project.description || '');
        $('#struct-proj-start').val(project.start_date);

        // Populate Group Select
        const $grpSelect = $('#struct-group-select');
        $grpSelect.empty();
        
        // [UPDATED] Access .data
        rawTrackerData.data.forEach((g, i) => {
            const selected = (i === gIdx) ? 'selected' : '';
            $grpSelect.append(`<option value="${i}" ${selected}>${g.group_name}</option>`);
        });
        $grpSelect.append(`<option value="__NEW__" style="color:#0d6efd; font-weight:bold;">✨ + Move to New Group...</option>`);
        $('#struct-new-group-name').addClass('d-none').val('');

        updateOrderSelect(gIdx, pIdx);

        tempMilestones = JSON.parse(JSON.stringify(project.milestones));
        let cursorDate = new Date(project.start_date);
        tempMilestones.forEach((ms, index) => {
            let prevDate = index === 0 ? cursorDate : new Date(tempMilestones[index-1].planned_end);
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
            const html = `<div class="list-group-item milestone-item p-0 ${lockClass}" data-idx="${index}"><div class="row g-2 align-items-center m-0 py-2"><div class="col-1 text-center drag-handle">${lockIcon}</div><div class="col-1"><select class="form-select form-select-sm ms-color-input p-1 text-center text-white" style="background-color: ${ms.color}; border:none; cursor:pointer;" data-idx="${index}">${colorOptions}</select></div><div class="col-4"><input type="text" class="form-control form-control-sm ms-name-input fw-bold" value="${ms.name}" placeholder="Name" data-idx="${index}"><input type="text" class="form-control form-control-sm ms-desc-input mt-1 text-muted" style="font-size: 11px;" value="${ms.description || ''}" placeholder="Description (Optional)" data-idx="${index}"></div><div class="col-2"><div class="input-group input-group-sm"><input type="number" class="form-control ms-duration-input" value="${ms._temp_duration}" min="1" data-idx="${index}"><span class="input-group-text">d</span></div></div><div class="col-3"><input type="text" class="form-control form-control-sm bg-light border-0 ms-calc-date" readonly tabindex="-1"></div><div class="col-1 text-center">${deleteBtn}</div></div></div>`;
            listContainer.insertAdjacentHTML('beforeend', html);
        });
        if (sortableInstance) sortableInstance.destroy();
        sortableInstance = new Sortable(listContainer, { handle: '.drag-handle', animation: 150, filter: '.locked', onMove: function (evt) { return !evt.related.classList.contains('locked'); }, onEnd: function (evt) { const newOrder = []; $(listContainer).find('.milestone-item').each(function() { newOrder.push(tempMilestones[$(this).data('idx')]); }); tempMilestones = newOrder; renderMilestoneList(); recalculateSchedule(); } });
        bindInputs();
    }
    function bindInputs() {
        $('.ms-duration-input').on('change input', function() { let val = parseInt($(this).val()); if(isNaN(val) || val < 1) val = 1; tempMilestones[$(this).data('idx')]._temp_duration = val; recalculateSchedule(); });
        $('.ms-name-input').on('change input', function() { tempMilestones[$(this).data('idx')].name = $(this).val(); });
        $('.ms-desc-input').on('change input', function() { tempMilestones[$(this).data('idx')].description = $(this).val(); });
        $('.ms-color-input').on('change', function() { tempMilestones[$(this).data('idx')].color = $(this).val(); $(this).css('background-color', $(this).val()); });
        $('.btn-delete-ms').on('click', function() { tempMilestones.splice($(this).data('idx'), 1); renderMilestoneList(); recalculateSchedule(); });
    }
    function recalculateSchedule() {
        const startVal = $('#struct-proj-start').val(); if(!startVal) return; let cursor = new Date(startVal), totalDays = 0; const dateInputs = $('.ms-calc-date');
        tempMilestones.forEach((ms, i) => { const dur = ms._temp_duration || 1; const endDate = addDays(cursor, dur); $(dateInputs[i]).val(`${endDate.toISOString().split('T')[0]} (End)`); cursor = endDate; totalDays += dur; ms._calc_planned_end = endDate.toISOString().split('T')[0]; });
        $('#struct-total-days').text(totalDays); $('#struct-final-date').text(cursor.toISOString().split('T')[0]);
    }
    $('#btn-add-milestone').click(function() { tempMilestones.push({ name: "New Milestone", description: "", status_progress: 0.0, _temp_duration: 10, _is_locked: false, color: "#0d6efd", demand_due_date: "" }); renderMilestoneList(); recalculateSchedule(); });
    $('#struct-proj-start').on('change', function() { recalculateSchedule(); });
    
    // [UPDATED] Delete Logic (.data)
    $('#btn-delete-project').off('click').on('click', function() { 
        const gIdx = parseInt($('#struct-g-idx').val()); 
        const pIdx = parseInt($('#struct-p-idx').val()); 
        const projName = $('#struct-proj-name').val(); 
        if (confirm(`⚠️ Are you sure you want to delete project: "${projName}"?\n\nThis action CANNOT be undone.`)) { 
            rawTrackerData.data[gIdx].projects.splice(pIdx, 1); 
            runPipeline(); 
            modal.hide(); 
        } 
    });

    // [MODIFIED] Save Logic with Position Order Handling
    $('#btn-save-structure').click(function() {
        const currentGIdx = parseInt($('#struct-g-idx').val());
        const currentPIdx = parseInt($('#struct-p-idx').val());
        
        if (tempMilestones.length === 0) { alert("Project must have at least one milestone."); return; }
        
        const targetGroupVal = $('#struct-group-select').val();
        let finalGroupIndex = currentGIdx;
        let isMoveGroup = false;

        if (targetGroupVal === '__NEW__') {
            const newName = $('#struct-new-group-name').val().trim();
            if (!newName) { alert("Please enter a name for the new group."); return; }
            const newGroup = { group_name: newName, is_expanded: true, projects: [] };
            
            // [UPDATED] Access .data
            rawTrackerData.data.push(newGroup);
            finalGroupIndex = rawTrackerData.data.length - 1;
            isMoveGroup = true;
        } else {
            finalGroupIndex = parseInt(targetGroupVal);
            if (finalGroupIndex !== currentGIdx) isMoveGroup = true;
        }

        const targetOrderIdx = parseInt($('#struct-order-select').val());

        // [UPDATED] Access .data
        const updatedProject = {
            project_id: rawTrackerData.data[currentGIdx].projects[currentPIdx].project_id, 
            project_name: $('#struct-proj-name').val(),
            description: $('#struct-proj-desc').val(),
            start_date: $('#struct-proj-start').val(),
            milestones: tempMilestones.map(ms => ({
                name: ms.name, description: ms.description, status_progress: ms.status_progress,
                planned_end: ms._calc_planned_end, actual_completion_date: ms.actual_completion_date || null,
                demand_due_date: ms.demand_due_date || ms._calc_planned_end, color: ms.color
            }))
        };

        // [UPDATED] Update Data Source (.data)
        if (isMoveGroup) {
            rawTrackerData.data[currentGIdx].projects.splice(currentPIdx, 1); // Remove from old
            rawTrackerData.data[finalGroupIndex].projects.splice(targetOrderIdx, 0, updatedProject); // Insert at specific pos in new
            rawTrackerData.data[finalGroupIndex].is_expanded = true;
        } else {
            if (targetOrderIdx === currentPIdx) {
                rawTrackerData.data[currentGIdx].projects[currentPIdx] = updatedProject;
            } else {
                rawTrackerData.data[currentGIdx].projects.splice(currentPIdx, 1); // Remove
                rawTrackerData.data[currentGIdx].projects.splice(targetOrderIdx, 0, updatedProject); // Insert at new pos
            }
        }

        runPipeline();
        modal.hide();
    });
}

// [MODIFIED] 3. Create Project Handler
function initCreateProjectHandler() {
    if ($('#createProjectModal').length === 0) {
        const modalHtml = `
            <div class="modal fade" id="createProjectModal" tabindex="-1">
                <div class="modal-dialog modal-dialog-centered">
                    <div class="modal-content">
                        <div class="modal-header">
                            <h5 class="modal-title">Create New Project</h5>
                            <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                        </div>
                        <div class="modal-body">
                            <div class="mb-3">
                                <label class="form-label fw-bold">Project Name</label>
                                <input type="text" class="form-control" id="create-proj-name" placeholder="e.g., Alpha Launch">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Project Group</label>
                                <select class="form-select" id="create-group-select"></select>
                                <input type="text" class="form-control mt-2 d-none" id="create-new-group-name" placeholder="Enter new group name...">
                            </div>
                            <div class="mb-3">
                                <label class="form-label fw-bold">Start Date</label>
                                <input type="date" class="form-control" id="create-proj-start">
                            </div>
                            <div id="create-error-msg" class="alert alert-danger d-none py-2 small"></div>
                        </div>
                        <div class="modal-footer">
                            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                            <button type="button" class="btn btn-primary" id="btn-confirm-create-project">Create Project</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        $('body').append(modalHtml);
    }

    const modalEl = document.getElementById('createProjectModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    $(modalEl).on('hide.bs.modal', function () {
        if (document.activeElement) document.activeElement.blur();
    });
    const $errorMsg = $('#create-error-msg');

    $('#dashboard-stats-container').on('click', '#btn-open-create-project', function() {
        $('#create-proj-name').val('');
        $('#create-new-group-name').val('').addClass('d-none');
        $errorMsg.addClass('d-none').text('');
        const todayStr = new Date().toISOString().split('T')[0];
        $('#create-proj-start').val(todayStr);

        const $select = $('#create-group-select');
        $select.empty();
        
        // [UPDATED] Access .data
        if (rawTrackerData.data && rawTrackerData.data.length > 0) {
            rawTrackerData.data.forEach((g, index) => {
                $select.append(new Option(g.group_name, index));
            });
        }
        $select.append(new Option('+ Create New Group...', '__NEW__'));
        modal.show();
    });

    $('#create-group-select').change(function() {
        if ($(this).val() === '__NEW__') {
            $('#create-new-group-name').removeClass('d-none').focus();
        } else {
            $('#create-new-group-name').addClass('d-none');
        }
    });

    $('#btn-confirm-create-project').click(function() {
        const name = $('#create-proj-name').val().trim();
        const start = $('#create-proj-start').val();
        const groupVal = $('#create-group-select').val();
        const newGroupName = $('#create-new-group-name').val().trim();
        
        if (!name) { $errorMsg.text("Project Name is required.").removeClass('d-none'); return; }
        if (!start) { $errorMsg.text("Start Date is required.").removeClass('d-none'); return; }
        if (groupVal === '__NEW__' && !newGroupName) { $errorMsg.text("New Group Name is required.").removeClass('d-none'); return; }

        let targetGroupIndex = -1;
        if (groupVal === '__NEW__') {
            const newGroup = { group_name: newGroupName, is_expanded: true, projects: [] };
            
            // [UPDATED] Access .data
            rawTrackerData.data.push(newGroup);
            targetGroupIndex = rawTrackerData.data.length - 1;
        } else {
            targetGroupIndex = parseInt(groupVal);
            // [UPDATED] Access .data
            rawTrackerData.data[targetGroupIndex].is_expanded = true;
        }

        const newId = "PROJ-" + Date.now().toString().slice(-6);
        const defaultMilestone = { name: "Kickoff", description: "Project initialization", status_progress: 0.0, planned_end: start, actual_completion_date: null, demand_due_date: "", color: "#0d6efd" };
        const newProject = { project_id: newId, project_name: name, description: "", start_date: start, milestones: [defaultMilestone] };

        // [UPDATED] Access .data
        rawTrackerData.data[targetGroupIndex].projects.push(newProject);
        runPipeline();
        modal.hide();
    });
}

// [NEW] 4. Project Meta/Settings Handler
function initMetaHandler() {
    const modalEl = document.getElementById('projectSettingsModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    
    // Open Modal: Load data from rawTrackerData.meta
    $('#btn-edit-meta').click(function() {
        // Ensure meta object exists
        if (!rawTrackerData.meta) rawTrackerData.meta = {};
        
        // Fill inputs
        $('#meta-title-input').val(rawTrackerData.meta.title || '');
        $('#meta-version-input').val(rawTrackerData.meta.version || '1.0');
        
        // Handle date: use meta.last_updated or today
        const dateVal = rawTrackerData.meta.last_updated || new Date().toISOString().split('T')[0];
        $('#meta-date-input').val(dateVal);
        
        modal.show();
    });

    // Save Changes
    $('#btn-save-meta').click(function() {
        const newTitle = $('#meta-title-input').val().trim();
        const newVersion = $('#meta-version-input').val().trim();
        const newDate = $('#meta-date-input').val();

        if (!newTitle) {
            alert("Project Title cannot be empty.");
            return;
        }

        // Update Global Data
        rawTrackerData.meta.title = newTitle;
        rawTrackerData.meta.version = newVersion;
        rawTrackerData.meta.last_updated = newDate;

        // Update UI Immediately
        $('#tracker-main-title').text(newTitle);
        
        // Close Modal
        modal.hide();
        
        // Optional: Show a quick toast or log
        // console.log("Meta updated:", rawTrackerData.meta);
    });
}

// --- [NEW] Cloud / Mock API Handlers (Append to js/modals.js) ---

function initDataSyncHandlers() {
    const modalEl = document.getElementById('dataSettingsModal');
    // Note: We don't create a new bootstrap.Modal instance here if it's already managed by data-bs-toggle buttons,
    // but we can use getOrCreateInstance to be safe.
    
    const $historyList = $('#cloud-history-list');
    const $projNameDisplay = $('#cloud-current-project-name');

    // Helper: Get Current Project Name
    const getProjectName = () => {
        // Use meta title if available, otherwise default
        if (rawTrackerData && rawTrackerData.meta && rawTrackerData.meta.title) {
            return rawTrackerData.meta.title;
        }
        return "My_Project_Schedule";
    };

    // 1. Render History Table
    const loadHistory = () => {
        const projName = getProjectName();
        $historyList.html('<tr><td colspan="4" class="text-center text-muted"><div class="spinner-border spinner-border-sm text-primary"></div> Loading...</td></tr>');
        
        MockAPI.getHistory(projName).then(res => {
            $historyList.empty();
            if (!res.history || res.history.length === 0) {
                $historyList.html('<tr><td colspan="4" class="text-center text-muted fst-italic py-3">No history found for this project. Save a version to start!</td></tr>');
                return;
            }

            res.history.forEach(item => {
                const dateObj = new Date(item.createdAt);
                const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
                const remark = item.remark || '<span class="text-muted">-</span>';
                
                const row = `
                    <tr>
                        <td class="small">${dateStr}</td>
                        <td class="small fw-bold text-secondary">${item.createdBy}</td>
                        <td class="small text-truncate" style="max-width: 150px;" title="${item.remark}">${remark}</td>
                        <td class="text-end">
                            <button class="btn btn-sm btn-outline-primary btn-restore-version" data-vid="${item.versionId}">
                                <i class="bi bi-box-arrow-in-down-left"></i> Restore
                            </button>
                        </td>
                    </tr>
                `;
                $historyList.append(row);
            });
        }).catch(err => {
            $historyList.html(`<tr><td colspan="4" class="text-center text-danger">Error: ${err.message}</td></tr>`);
        });
    };

    // 2. Event: Modal Open -> Init Data
    $(modalEl).on('show.bs.modal', function () {
        $projNameDisplay.text(getProjectName());
        loadHistory();
        
        // Reset Local File Inputs
        $('#import-file-input').val('');
        $('#btn-import-json').prop('disabled', true);
    });

    // 3. Action: Save to Cloud
    $('#btn-cloud-save').click(function() {
        const projName = getProjectName();
        const remark = prompt("Enter a remark for this version (optional):", "Regular Update");
        
        if (remark === null) return; // User cancelled

        const $btn = $(this);
        const originalHtml = $btn.html();
        $btn.prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Saving...');

        MockAPI.saveProject({
            projectName: projName,
            user: "Admin_User", // In real app, get from session
            remark: remark,
            data: currentRevisedData // Save the full global object
        }).then(res => {
            alert("✅ Version Saved Successfully!\nID: " + res.versionId);
            loadHistory(); // Refresh table
        }).catch(err => {
            alert("❌ Save Failed: " + err.message);
        }).finally(() => {
            $btn.prop('disabled', false).html(originalHtml);
        });
    });

    // 4. Action: Refresh Latest
    $('#btn-cloud-load-latest').click(function() {
        if(!confirm("⚠️ This will overwrite your current unsaved changes with the latest Server version. Continue?")) return;
        
        const projName = getProjectName();
        const $btn = $(this);
        $btn.prop('disabled', true);

        MockAPI.getLatest(projName).then(res => {
            if (res.code === 200) {
                // Update Global Data
                currentRevisedData = res.data; 
                rawTrackerData = res.data; // Sync raw data too
                
                // Re-render
                renderTracker(currentRevisedData);
                
                // Update Meta modal inputs if they exist
                if(res.data.meta) {
                    $('#tracker-main-title').text(res.data.meta.title || "ProjectTracker Pro");
                }
                
                // Close Modal
                bootstrap.Modal.getInstance(modalEl).hide();
                alert("✅ Loaded latest version successfully.");
            }
        }).catch(err => {
            alert("❌ Load Failed: " + err.message);
        }).finally(() => {
            $btn.prop('disabled', false);
        });
    });

    // 5. Action: Restore Specific Version (Delegated Event)
    $historyList.on('click', '.btn-restore-version', function() {
        const vId = $(this).data('vid');
        if(!confirm(`⚠️ Restore version [${vId}]?\nCurrent unsaved changes will be lost.`)) return;

        const $btn = $(this);
        $btn.prop('disabled', true).html('Loading...');

        MockAPI.getVersion(vId).then(res => {
             // Update Global Data
             currentRevisedData = res.data; 
             rawTrackerData = res.data; 

             renderTracker(currentRevisedData);
             
             if(res.data.meta) {
                 $('#tracker-main-title').text(res.data.meta.title || "ProjectTracker Pro");
             }

             bootstrap.Modal.getInstance(modalEl).hide();
             alert(`✅ Restored version from ${new Date(res.timestamp).toLocaleString()}`);
        }).catch(err => {
            alert("❌ Restore Failed: " + err.message);
            $btn.prop('disabled', false).html('<i class="bi bi-box-arrow-in-down-left"></i> Restore');
        });
    });

    // --- Legacy Local File Handlers (Keep existing logic) ---
    $('#btn-download-json').click(function() {
        const filename = $('#export-filename').val() || 'tracker_data.json';
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(currentRevisedData, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", filename);
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
    });

    $('#import-file-input').change(function(e) {
        $('#btn-import-json').prop('disabled', !e.target.files.length);
    });

    $('#btn-import-json').click(function() {
        const file = $('#import-file-input')[0].files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const json = JSON.parse(e.target.result);
                currentRevisedData = json;
                rawTrackerData = json; // Update raw ref
                renderTracker(currentRevisedData);
                bootstrap.Modal.getInstance(modalEl).hide();
                alert("File imported successfully!");
            } catch (err) {
                alert("Invalid JSON file.");
            }
        };
        reader.readAsText(file);
    });
}