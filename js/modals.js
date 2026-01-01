// --- Modal Handlers ---

// 1. Edit Milestone Handler
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
    
    // 1. Set Today Button: Sets Date to Today AND Progress to 100%
    $('#btn-set-today').click(function() {
        // Set Date
        // Note: Ensure CONFIG.CURRENT_DATE is used if you want simulation time, 
        // otherwise use new Date() for real system time. Here we use system time for "Today".
        const today = new Date().toISOString().split('T')[0];
        $('#edit-actual-date').val(today);

        // Auto-set Progress to 100%
        $('#edit-progress').val(1.0);
        $('#edit-progress-val').text('100%');
    });

    // 2. Clear Date Button
    $('#btn-clear-date').click(function() {
        // Clear Date
        $('#edit-actual-date').val('');
        
        // Reset Progress to 0%
        $('#edit-progress').val(0);
        $('#edit-progress-val').text('0%');
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

// 2. Project Structure Handler (Sequencer)
function initProjectStructureHandlers() {
    const modalEl = document.getElementById('editProjectStructureModal');
    const modal = new bootstrap.Modal(modalEl, { backdrop: 'static', keyboard: false });
    const listContainer = document.getElementById('milestone-list-container');
    let tempMilestones = []; 
    let sortableInstance = null;

    // --- [NEW] Dynamically Inject "Delete Project" Button ---
    // We check if it exists first to avoid duplicates
    const $modalFooter = $(modalEl).find('.modal-footer');
    if ($modalFooter.find('#btn-delete-project').length === 0) {
        // 'me-auto' pushes it to the left side (Bootstrap utility)
        $modalFooter.prepend('<button type="button" class="btn btn-danger me-auto" id="btn-delete-project"><i class="bi bi-trash"></i> Delete Project</button>');
    }

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

    // --- [NEW] Delete Project Logic ---
    $('#btn-delete-project').off('click').on('click', function() {
        const gIdx = parseInt($('#struct-g-idx').val());
        const pIdx = parseInt($('#struct-p-idx').val());
        const projName = $('#struct-proj-name').val();

        if (confirm(`⚠️ Are you sure you want to delete project: "${projName}"?\n\nThis action CANNOT be undone.`)) {
            // Remove project from data source
            rawTrackerData.groups[gIdx].projects.splice(pIdx, 1);
            
            // Refresh Dashboard
            runPipeline();
            modal.hide();
        }
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
                $(listContainer).find('.milestone-item').each(function() { newOrder.push(tempMilestones[$(this).data('idx')]); });
                tempMilestones = newOrder;
                renderMilestoneList(); recalculateSchedule();
            }
        });
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
        const startVal = $('#struct-proj-start').val();
        if(!startVal) return;
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

    $('#btn-add-milestone').click(function() {
        tempMilestones.push({ name: "New Milestone", description: "", status_progress: 0.0, _temp_duration: 10, _is_locked: false, color: "#0d6efd", demand_due_date: "" });
        renderMilestoneList(); recalculateSchedule();
    });

    $('#struct-proj-start').on('change', function() { recalculateSchedule(); });

    $('#btn-save-structure').click(function() {
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