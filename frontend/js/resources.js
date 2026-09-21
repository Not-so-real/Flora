const RESOURCES_STORAGE_KEY = "flora-resources";
const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

const newResBtn = document.getElementById("new-resource-btn");
const emptyNewResBtn = document.getElementById("empty-new-res-btn");
const resList = document.getElementById("res-list");
const resResultCount = document.getElementById("res-result-count");
const resSearch = document.getElementById("res-search");
const typeFilter = document.getElementById("res-type-filter");
const subjectFilter = document.getElementById("res-subject-filter");
const chapterFilter = document.getElementById("res-chapter-filter");
const clearFiltersBtn = document.getElementById("clear-res-filters");
const filterContext = document.getElementById("res-filter-context");

const resForm = document.getElementById("res-form");
const resIdInput = document.getElementById("res-id");
const typeSelect = document.getElementById("res-type-select");
const subjectSelect = document.getElementById("res-subject-select");
const chapterSelect = document.getElementById("res-chapter-select");
const resTitleInput = document.getElementById("res-title");
const resUrlInput = document.getElementById("res-url");
const resDescriptionInput = document.getElementById("res-description");
const resFormError = document.getElementById("res-form-error");
const deleteResBtn = document.getElementById("delete-res-btn");
const resEditorTitle = document.getElementById("res-editor-title");
const resEditorEmpty = document.getElementById("res-editor-empty");
const resSaveStatus = document.getElementById("res-save-status");

const pageContext = new URLSearchParams(window.location.search);
let activeTypeFilter = pageContext.get("type") || "";
let activeSubjectFilter = pageContext.get("subject") || "";
let activeChapterFilter = activeSubjectFilter ? (pageContext.get("chapter") || "") : "";
let pendingSubjectId = activeSubjectFilter || localStorage.getItem(CURRENT_SUBJECT_KEY) || "";
let pendingChapterId = activeChapterFilter;

let subjects = loadSubjects();
let resources = loadResources();
let currentResourceId = null;
let saveStatusTimer = null;

newResBtn.addEventListener("click", openNewResource);
emptyNewResBtn.addEventListener("click", openNewResource);
resForm.addEventListener("submit", saveResourceFromForm);
deleteResBtn.addEventListener("click", deleteCurrentResource);

subjectSelect.addEventListener("change", () => {
    renderEditorChapterSelect("", subjectSelect.value);
    if (subjectSelect.value) {
        localStorage.setItem(CURRENT_SUBJECT_KEY, subjectSelect.value);
    }
});

typeFilter.addEventListener("change", () => {
    activeTypeFilter = typeFilter.value;
    syncSelectionToVisible();
    renderResourceList();
    updateFilterUrl();
});

subjectFilter.addEventListener("change", () => {
    activeSubjectFilter = subjectFilter.value;
    activeChapterFilter = "";
    renderFilters();
    syncSelectionToVisible();
    renderResourceList();
    updateFilterUrl();
});

chapterFilter.addEventListener("change", () => {
    activeChapterFilter = chapterFilter.value;
    renderFilters();
    syncSelectionToVisible();
    renderResourceList();
    updateFilterUrl();
});

clearFiltersBtn.addEventListener("click", () => {
    activeTypeFilter = "";
    activeSubjectFilter = "";
    activeChapterFilter = "";
    typeFilter.value = "";
    renderFilters();
    syncSelectionToVisible();
    renderResourceList();
    updateFilterUrl();
});

resSearch.addEventListener("input", () => {
    syncSelectionToVisible();
    renderResourceList();
});

validateContext();
renderFilters();
renderResourceList();
selectInitialResource();

function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedSubjects = JSON.parse(raw);
        return Array.isArray(storedSubjects) ? storedSubjects : [];
    } catch (error) {
        console.error("Could not load subjects for resources:", error);
        return [];
    }
}

function loadResources() {
    const raw = localStorage.getItem(RESOURCES_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedResources = JSON.parse(raw);
        if (!Array.isArray(storedResources)) return [];
        return storedResources.map(normalizeResource).filter(Boolean);
    } catch (error) {
        console.error("Could not load resources:", error);
        return [];
    }
}

function normalizeResource(res) {
    if (!res || typeof res !== "object" || !res.id) return null;

    const validTypes = ["link", "video", "book", "document"];
    const subjectId = subjects.some(s => s.id === res.subjectId) ? String(res.subjectId) : "";
    const chapter = findChapter(subjectId, res.chapterId);

    return {
        id: String(res.id),
        title: String(res.title || "Untitled Resource").trim(),
        url: String(res.url || "").trim(),
        description: String(res.description || "").trim(),
        type: validTypes.includes(res.type) ? res.type : "link",
        subjectId,
        chapterId: chapter ? chapter.id : "",
        createdAt: Number(res.createdAt) || Date.now(),
        updatedAt: Number(res.updatedAt) || Date.now()
    };
}

function saveResources() {
    try {
        localStorage.setItem(RESOURCES_STORAGE_KEY, JSON.stringify(resources));
        return true;
    } catch (error) {
        console.error("Could not save resources:", error);
        resFormError.textContent = "Flora could not save this resource in your browser.";
        return false;
    }
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `resource-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findSubject(subjectId) {
    return subjects.find(s => s.id === subjectId) || null;
}

function findChapter(subjectId, chapterId) {
    const subject = findSubject(subjectId);
    if (!subject || !Array.isArray(subject.chapters)) return null;
    return subject.chapters.find(c => c.id === chapterId) || null;
}

function validateContext() {
    if (!findSubject(activeSubjectFilter)) {
        activeSubjectFilter = "";
        activeChapterFilter = "";
    }
    if (activeChapterFilter && !findChapter(activeSubjectFilter, activeChapterFilter)) {
        activeChapterFilter = "";
    }
    if (!findSubject(pendingSubjectId)) {
        pendingSubjectId = "";
        pendingChapterId = "";
    }
    if (pendingChapterId && !findChapter(pendingSubjectId, pendingChapterId)) {
        pendingChapterId = "";
    }
}

function createOption(value, label, selected = false) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
}

function getTypeLabel(type) {
    const labels = { link: "Link", video: "Video", book: "Book", document: "Document" };
    return labels[type] || "Link";
}

function getFilteredResources() {
    const query = resSearch.value.trim().toLowerCase();

    return resources
        .filter(res => !activeTypeFilter || res.type === activeTypeFilter)
        .filter(res => !activeSubjectFilter || res.subjectId === activeSubjectFilter)
        .filter(res => !activeChapterFilter || res.chapterId === activeChapterFilter)
        .filter(res => {
            if (!query) return true;

            const subject = findSubject(res.subjectId);
            const chapter = findChapter(res.subjectId, res.chapterId);
            return res.title.toLowerCase().includes(query) ||
                res.description.toLowerCase().includes(query) ||
                res.url.toLowerCase().includes(query) ||
                Boolean(subject && subject.name.toLowerCase().includes(query)) ||
                Boolean(chapter && chapter.name.toLowerCase().includes(query));
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderFilters() {
    subjectFilter.innerHTML = "";
    subjectFilter.appendChild(createOption("", "All subjects", !activeSubjectFilter));
    subjects.forEach(subject => {
        subjectFilter.appendChild(createOption(subject.id, subject.name, subject.id === activeSubjectFilter));
    });

    chapterFilter.innerHTML = "";
    chapterFilter.appendChild(createOption("", "All chapters", !activeChapterFilter));
    const subject = findSubject(activeSubjectFilter);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];
    chapters.forEach(chapter => {
        chapterFilter.appendChild(createOption(chapter.id, chapter.name, chapter.id === activeChapterFilter));
    });

    chapterFilter.disabled = !activeSubjectFilter || chapters.length === 0;
    clearFiltersBtn.hidden = !activeTypeFilter && !activeSubjectFilter && !activeChapterFilter;

    const chapter = findChapter(activeSubjectFilter, activeChapterFilter);
    const parts = [];
    if (activeTypeFilter) parts.push(getTypeLabel(activeTypeFilter));
    if (subject) parts.push(subject.name);
    if (chapter) parts.push(chapter.name);
    filterContext.textContent = parts.length
        ? parts.join(" / ")
        : "Showing all resources";
}

function renderResourceList() {
    const visible = getFilteredResources();
    resList.innerHTML = "";
    resResultCount.textContent = `${visible.length} ${visible.length === 1 ? "resource" : "resources"}`;

    if (!visible.length) {
        const empty = document.createElement("p");
        empty.className = "res-list-empty";
        empty.textContent = resSearch.value.trim()
            ? "No resources match your search."
            : "No resources in this view yet.\nAdd your first resource above.";
        resList.appendChild(empty);
        return;
    }

    visible.forEach(res => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "res-list-item";
        if (res.id === currentResourceId) item.classList.add("active");

        const subject = findSubject(res.subjectId);
        const chapter = findChapter(res.subjectId, res.chapterId);
        const context = [subject && subject.name, chapter && chapter.name].filter(Boolean).join(" / ");

        const typeBadge = document.createElement("small");
        typeBadge.className = `res-type-badge type-${res.type}`;
        typeBadge.textContent = getTypeLabel(res.type);

        const contextLabel = document.createElement("small");
        contextLabel.textContent = context || "Unassigned";

        const title = document.createElement("strong");
        title.textContent = res.title;

        const desc = document.createElement("span");
        desc.textContent = res.url || res.description || "No details";

        item.append(typeBadge, contextLabel, title, desc);
        item.addEventListener("click", () => selectResource(res.id));
        resList.appendChild(item);
    });
}

function renderEditorSubjectSelect(selectedId = "") {
    subjectSelect.innerHTML = "";
    subjectSelect.appendChild(createOption("", subjects.length ? "No subject" : "No subjects available", !selectedId));
    subjects.forEach(subject => {
        subjectSelect.appendChild(createOption(subject.id, subject.name, subject.id === selectedId));
    });
}

function renderEditorChapterSelect(selectedId = "", subjectId = subjectSelect.value) {
    chapterSelect.innerHTML = "";
    const subject = findSubject(subjectId);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];
    const emptyLabel = subjectId
        ? (chapters.length ? "No chapter" : "No chapters available")
        : "Choose a subject first";

    chapterSelect.appendChild(createOption("", emptyLabel, !selectedId));
    chapters.forEach(chapter => {
        chapterSelect.appendChild(createOption(chapter.id, chapter.name, chapter.id === selectedId));
    });
    chapterSelect.disabled = !subjectId || chapters.length === 0;
}

function selectInitialResource() {
    const firstVisible = getFilteredResources()[0];
    if (firstVisible) selectResource(firstVisible.id);
    else showEmptyEditor();
}

function syncSelectionToVisible() {
    const visible = getFilteredResources();
    if (visible.some(res => res.id === currentResourceId)) return;

    if (visible.length) selectResource(visible[0].id);
    else {
        currentResourceId = null;
        showEmptyEditor();
    }
}

function selectResource(resId) {
    const res = resources.find(item => item.id === resId);
    if (!res) return;

    currentResourceId = res.id;
    resIdInput.value = res.id;
    resTitleInput.value = res.title;
    resUrlInput.value = res.url;
    resDescriptionInput.value = res.description;
    typeSelect.value = res.type;
    resFormError.textContent = "";
    resEditorTitle.textContent = "Edit resource";
    deleteResBtn.hidden = false;

    renderEditorSubjectSelect(res.subjectId);
    renderEditorChapterSelect(res.chapterId, res.subjectId);
    showEditor();
    renderResourceList();
}

function openNewResource() {
    currentResourceId = null;
    resForm.reset();
    resIdInput.value = "";
    resFormError.textContent = "";
    resEditorTitle.textContent = "Add resource";
    deleteResBtn.hidden = true;

    const subjectId = activeSubjectFilter || pendingSubjectId;
    const chapterId = activeChapterFilter || pendingChapterId;
    renderEditorSubjectSelect(subjectId);
    renderEditorChapterSelect(chapterId, subjectId);
    showEditor();
    renderResourceList();
    resTitleInput.focus();
}

function showEditor() {
    resForm.classList.remove("is-hidden");
    resEditorEmpty.classList.add("is-hidden");
}

function showEmptyEditor() {
    resForm.classList.add("is-hidden");
    resEditorEmpty.classList.remove("is-hidden");
    resEditorTitle.textContent = "Select a resource";
    resFormError.textContent = "";
}

function saveResourceFromForm(event) {
    event.preventDefault();

    const title = resTitleInput.value.trim();
    const url = resUrlInput.value.trim();
    const description = resDescriptionInput.value.trim();
    const type = typeSelect.value;
    const subjectId = subjectSelect.value;
    const chapterId = chapterSelect.value;

    if (!title) {
        resFormError.textContent = "Enter a resource title.";
        resTitleInput.focus();
        return;
    }

    const now = Date.now();
    const existingId = resIdInput.value;

    if (existingId) {
        const res = resources.find(item => item.id === existingId);
        if (!res) return;

        res.title = title;
        res.url = url;
        res.description = description;
        res.type = type;
        res.subjectId = subjectId;
        res.chapterId = findChapter(subjectId, chapterId) ? chapterId : "";
        res.updatedAt = now;
        currentResourceId = res.id;
    } else {
        const res = {
            id: createId(),
            title,
            url,
            description,
            type,
            subjectId,
            chapterId: findChapter(subjectId, chapterId) ? chapterId : "",
            createdAt: now,
            updatedAt: now
        };

        resources.push(res);
        currentResourceId = res.id;
        resIdInput.value = res.id;
        deleteResBtn.hidden = false;
        resEditorTitle.textContent = "Edit resource";
    }

    if (subjectId) localStorage.setItem(CURRENT_SUBJECT_KEY, subjectId);
    resFormError.textContent = "";
    if (!saveResources()) return;
    showSavedStatus();

    if (getFilteredResources().some(res => res.id === currentResourceId)) {
        renderResourceList();
    } else {
        syncSelectionToVisible();
    }
}

function deleteCurrentResource() {
    const res = resources.find(item => item.id === currentResourceId);
    if (!res) return;

    const confirmed = confirm(`Delete "${res.title}"?\n\nThis cannot be undone.`);
    if (!confirmed) return;

    resources = resources.filter(item => item.id !== res.id);
    currentResourceId = null;
    saveResources();
    renderResourceList();
    syncSelectionToVisible();
}

function showSavedStatus() {
    clearTimeout(saveStatusTimer);
    resSaveStatus.textContent = "Saved";
    resSaveStatus.className = "res-save-status";
    saveStatusTimer = setTimeout(() => {
        resSaveStatus.className = "res-save-status hidden";
    }, 1800);
}

function updateFilterUrl() {
    const url = new URL(window.location.href);
    if (activeTypeFilter) url.searchParams.set("type", activeTypeFilter);
    else url.searchParams.delete("type");
    if (activeSubjectFilter) url.searchParams.set("subject", activeSubjectFilter);
    else url.searchParams.delete("subject");
    if (activeChapterFilter) url.searchParams.set("chapter", activeChapterFilter);
    else url.searchParams.delete("chapter");
    window.history.replaceState({}, "", url);
}