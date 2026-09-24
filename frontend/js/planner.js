const PLANNER_STORAGE_KEY = "flora-planner";
const SUBJECTS_STORAGE_KEY = "flora-subjects";

const newTaskBtn = document.getElementById("new-task-btn");
const emptyNewTaskBtn = document.getElementById("empty-new-task-btn");
const plannerSearch = document.getElementById("planner-search");
const plannerStatusFilter = document.getElementById("planner-status-filter");
const plannerSubjectFilter = document.getElementById("planner-subject-filter");
const plannerTaskList = document.getElementById("planner-task-list");

const plannerForm = document.getElementById("planner-form");
const plannerTaskId = document.getElementById("planner-task-id");
const plannerTaskTitle = document.getElementById("planner-task-title");
const plannerTaskSubject = document.getElementById("planner-task-subject");
const plannerTaskChapter = document.getElementById("planner-task-chapter");
const plannerTaskDueDate = document.getElementById("planner-task-due-date");
const plannerTaskPriority = document.getElementById("planner-task-priority");
const plannerTaskNotes = document.getElementById("planner-task-notes");
const plannerTaskDone = document.getElementById("planner-task-done");
const plannerFormError = document.getElementById("planner-form-error");
const plannerEditorTitle = document.getElementById("planner-editor-title");
const plannerEmpty = document.getElementById("planner-empty");
const plannerSaveStatus = document.getElementById("planner-save-status");
const deleteTaskBtn = document.getElementById("delete-task-btn");

let subjects = [];
let tasks = [];
let currentTaskId = null;
let saveStatusTimer = null;
let unsubTasks = null;
let unsubSubjectsP = null;

newTaskBtn.addEventListener("click", openNewTask);
emptyNewTaskBtn.addEventListener("click", openNewTask);
plannerForm.addEventListener("submit", saveTaskFromForm);
deleteTaskBtn.addEventListener("click", deleteCurrentTask);
plannerTaskSubject.addEventListener("change", () => renderChapterSelect(""));
plannerSearch.addEventListener("input", () => { renderTaskList(); });
plannerStatusFilter.addEventListener("change", () => { renderTaskList(); });
plannerSubjectFilter.addEventListener("change", () => { renderFilterSubjectSelect(); renderTaskList(); });

// ── Cloud boot ───────────────────────────────────────────────
firebase.auth().onAuthStateChanged(async user => {
    if (!user) { window.location.href = "auth.html"; return; }

    unsubSubjectsP = onCloudUpdate("subjects", cloudSubjects => {
        subjects = cloudSubjects.filter(s => s && s.id && s.name);
        renderFilterSubjectSelect();
        renderTaskList();
    });

    unsubTasks = await migrateAndSync(
        "planner",
        PLANNER_STORAGE_KEY,
        cloudTasks => {
            tasks = cloudTasks.map(normalizeTask).filter(Boolean);
            renderTaskList();
            selectInitialTask();
        },
        normalizeTask
    );
});

function normalizeTask(task) {
    if (!task || !task.id) return null;
    return {
        id: String(task.id),
        title: String(task.title || "Untitled Task").trim(),
        notes: String(task.notes || "").trim(),
        subjectId: task.subjectId || "",
        chapterId: task.chapterId || "",
        dueDate: task.dueDate || "",
        priority: task.priority || "medium",
        completed: Boolean(task.completed),
        updatedAt: Number(task.updatedAt) || Date.now()
    };
}

function saveTasks() {
    try {
        localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(tasks));
    } catch(e) {}
}

function persistTask(task) {
    saveTasks();
    return saveToCloud("planner", task).catch(err => {
        console.error("Cloud save failed:", err);
    });
}

function removeTask(id) {
    tasks = tasks.filter(t => t.id !== id);
    saveTasks();
    return deleteFromCloud("planner", id).catch(err => {
        console.error("Cloud delete failed:", err);
    });
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findSubject(subjectId) {
    return subjects.find(subject => subject.id === subjectId) || null;
}

function renderFilterSubjectSelect() {
    const selected = plannerSubjectFilter.value;
    plannerSubjectFilter.innerHTML = '<option value="">All subjects</option>';
    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        option.selected = subject.id === selected;
        plannerSubjectFilter.appendChild(option);
    });
}

function renderEditorSubjectSelect(selectedId = "") {
    plannerTaskSubject.innerHTML = '<option value="">No subject</option>';
    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        option.selected = subject.id === selectedId;
        plannerTaskSubject.appendChild(option);
    });
}

function renderChapterSelect(selectedId = "") {
    plannerTaskChapter.innerHTML = '<option value="">No chapter</option>';
    const subject = findSubject(plannerTaskSubject.value);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];
    chapters.forEach(chapter => {
        const option = document.createElement("option");
        option.value = chapter.id;
        option.textContent = chapter.name;
        option.selected = chapter.id === selectedId;
        plannerTaskChapter.appendChild(option);
    });
    plannerTaskChapter.disabled = !plannerTaskSubject.value || chapters.length === 0;
}

function getVisibleTasks() {
    const query = plannerSearch.value.trim().toLowerCase();
    return tasks.filter(task => {
        if (plannerStatusFilter.value === "todo" && task.completed) return false;
        if (plannerStatusFilter.value === "done" && !task.completed) return false;
        if (plannerSubjectFilter.value && task.subjectId !== plannerSubjectFilter.value) return false;
        if (!query) return true;
        return task.title.toLowerCase().includes(query) ||
            task.notes.toLowerCase().includes(query);
    }).sort((a, b) => {
        if (a.completed !== b.completed) return a.completed - b.completed;
        return (a.dueDate || "9999-99-99").localeCompare(b.dueDate || "9999-99-99");
    });
}

function renderTaskList() {
    const visibleTasks = getVisibleTasks();
    plannerTaskList.innerHTML = "";

    if (!visibleTasks.length) {
        plannerTaskList.innerHTML = '<div class="planner-empty-state">No tasks in this view yet.</div>';
        return;
    }

    visibleTasks.forEach(task => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = `planner-task-item ${task.id === currentTaskId ? "active" : ""}`;
        const subject = findSubject(task.subjectId);
        const chapter = subject && Array.isArray(subject.chapters)
            ? subject.chapters.find(ch => ch.id === task.chapterId)
            : null;
        item.innerHTML = `
            <h3>${escapeHtml(task.title)}</h3>
            <p>${escapeHtml(subject ? subject.name : "General")}${chapter ? ` / ${escapeHtml(chapter.name)}` : ""}</p>
            <small>${task.completed ? "Completed" : `${capitalize(task.priority)} priority${task.dueDate ? ` · Due ${task.dueDate}` : ""}`}</small>
        `;
        item.addEventListener("click", () => selectTask(task.id));
        plannerTaskList.appendChild(item);
    });
}

function selectInitialTask() {
    const first = getVisibleTasks()[0];
    if (first) selectTask(first.id);
    else showEmptyState();
}

function syncCurrentTask() {
    const visible = getVisibleTasks();
    if (visible.some(task => task.id === currentTaskId)) return;
    if (visible.length) selectTask(visible[0].id);
    else {
        currentTaskId = null;
        showEmptyState();
    }
}

function selectTask(taskId) {
    const task = tasks.find(item => item.id === taskId);
    if (!task) return;

    currentTaskId = task.id;
    plannerTaskId.value = task.id;
    plannerTaskTitle.value = task.title;
    plannerTaskNotes.value = task.notes;
    plannerTaskDueDate.value = task.dueDate || "";
    plannerTaskPriority.value = task.priority;
    plannerTaskDone.checked = task.completed;
    plannerEditorTitle.textContent = "Edit task";
    plannerFormError.textContent = "";
    deleteTaskBtn.hidden = false;

    renderEditorSubjectSelect(task.subjectId);
    renderChapterSelect(task.chapterId);

    plannerForm.classList.remove("is-hidden");
    plannerEmpty.classList.add("is-hidden");
    renderTaskList();
}

function openNewTask() {
    currentTaskId = null;
    plannerForm.reset();
    plannerTaskId.value = "";
    plannerTaskPriority.value = "medium";
    plannerEditorTitle.textContent = "New task";
    plannerFormError.textContent = "";
    deleteTaskBtn.hidden = true;
    renderEditorSubjectSelect();
    renderChapterSelect();
    plannerForm.classList.remove("is-hidden");
    plannerEmpty.classList.add("is-hidden");
    plannerTaskTitle.focus();
}

function showEmptyState() {
    plannerForm.classList.add("is-hidden");
    plannerEmpty.classList.remove("is-hidden");
    plannerEditorTitle.textContent = "Select a task";
}

function saveTaskFromForm(event) {
    event.preventDefault();

    const title = plannerTaskTitle.value.trim();
    if (!title) {
        plannerFormError.textContent = "Enter a task title.";
        plannerTaskTitle.focus();
        return;
    }

    const now = Date.now();
    const taskData = {
        id: plannerTaskId.value || createId(),
        title,
        notes: plannerTaskNotes.value.trim(),
        subjectId: plannerTaskSubject.value,
        chapterId: plannerTaskChapter.value,
        dueDate: plannerTaskDueDate.value,
        priority: plannerTaskPriority.value,
        completed: plannerTaskDone.checked,
        createdAt: now,
        updatedAt: now
    };

    const existingIndex = tasks.findIndex(task => task.id === taskData.id);
    if (existingIndex >= 0) {
        taskData.createdAt = tasks[existingIndex].createdAt || now;
        tasks[existingIndex] = taskData;
    } else {
        tasks.push(taskData);
    }

    currentTaskId = taskData.id;
    persistTask(taskData).then(() => {
        showSaveStatus();
        renderTaskList();
    });
}

async function deleteCurrentTask() {
    const task = tasks.find(item => item.id === currentTaskId);
    if (!task) return;
    
    const confirmed = await window.floraConfirm(
        "Delete Task?",
        `Delete "${task.title}"? This cannot be undone.`
    );
    if (!confirmed) return;

    currentTaskId = null;
    removeTask(task.id).then(() => {
        renderTaskList();
        syncCurrentTask();
    });
}

function showSaveStatus() {
    clearTimeout(saveStatusTimer);
    plannerSaveStatus.textContent = "Saved";
    plannerSaveStatus.className = "planner-save-status";
    saveStatusTimer = setTimeout(() => {
        plannerSaveStatus.className = "planner-save-status hidden";
    }, 1800);
}

function capitalize(value) {
    return value.charAt(0).toUpperCase() + value.slice(1);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
