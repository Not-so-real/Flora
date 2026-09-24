// ============================================================
//  Flora — Notes JavaScript
//  Features: Create, Read, Update, Delete, Search,
//            Timestamps, Save Status, Rich Editor,
//            Folders + Chapter grouping
// ============================================================

// ── DOM references ───────────────────────────────────────────
const newNoteBtn       = document.getElementById("new-note-btn");
const newFolderInput   = document.getElementById("new-folder-input");
const foldersList      = document.getElementById("folders-list");
const notesList        = document.getElementById("notes-list");
const noteTitle        = document.getElementById("note-title");
const noteEditor       = document.getElementById("note-editor");
const noteSearch       = document.getElementById("note-search");
const saveStatus       = document.getElementById("save-status");
const noteFolderSelect = document.getElementById("note-folder-select");
const noteSubjectSelect = document.getElementById("note-subject-select");
const noteChapterSelect = document.getElementById("note-chapter-select");
const noteSubjectFilter = document.getElementById("note-subject-filter");
const noteChapterFilter = document.getElementById("note-chapter-filter");
const clearNoteFilters = document.getElementById("clear-note-filters");
const noteFilterContext = document.getElementById("notes-filter-context");
const toolbarBtns      = document.querySelectorAll(".toolbar-btn");

// ── Constants ────────────────────────────────────────────────
const DEFAULT_FOLDER = { id: "folder-default", name: "All Notes" };
const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";
const NOTES_STORAGE_KEY = "flora-notes";
const FOLDERS_STORAGE_KEY = "flora-folders";

// ── App state ────────────────────────────────────────────────
let folders       = [];
let currentFolder = null;
let notes         = [];
let currentNote   = null;
let saveTimer     = null;   // debounce handle for save indicator
let saveHideTimer = null;
let cloudSaveTimer = null;  // debounce handle for cloud saves
let subjects      = [];

// Debounced cloud save — waits 800ms after last edit before pushing to Firestore
function debouncedCloudSave() {
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => {
        if (!currentNote) return;

        // Remove the _isNew flag on first real save
        if (currentNote._isNew) {
            delete currentNote._isNew;
        }

        saveToCloud("notes", currentNote).catch(error => {
            console.error("Could not sync note to cloud:", error);
        });
    }, 800);
}

const showNewSubjectBtn = document.getElementById("show-new-subject-btn");
const newSubjectInput   = document.getElementById("new-subject-input");
const showNewChapterBtn = document.getElementById("show-new-chapter-btn");
const newChapterInput   = document.getElementById("new-chapter-input");

const noteContext = new URLSearchParams(window.location.search);
let activeSubjectFilter = noteContext.get("subject") || "";
let activeChapterFilter = activeSubjectFilter ? (noteContext.get("chapter") || "") : "";
let pendingSubjectId = activeSubjectFilter || localStorage.getItem(CURRENT_SUBJECT_KEY) || "";
let pendingChapterId = activeChapterFilter;

// ── Boot ─────────────────────────────────────────────────────
newNoteBtn.addEventListener("click", createNote);

newFolderInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        createFolderFromInput();
    }
    if (event.key === "Escape") {
        newFolderInput.value = "";
        newFolderInput.blur();
    }
});

newFolderInput.addEventListener("blur", () => {
    if (newFolderInput.value.trim()) {
        createFolderFromInput();
    }
});

toolbarBtns.forEach(btn => {
    // Keep the editor selection active when a toolbar button is pressed.
    btn.addEventListener("mousedown", event => event.preventDefault());

    btn.addEventListener("click", event => {
        event.preventDefault();
        if (!currentNote) return;

        const command = btn.dataset.command;
        const value   = btn.dataset.value || null;

        document.execCommand(command, false, value);
        noteEditor.focus();

        // Treat toolbar clicks as an edit so the note is saved
        noteEditor.dispatchEvent(new Event("input", { bubbles: true }));
    });
});

noteTitle.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        noteEditor.focus();
    }
});

noteTitle.addEventListener("paste", event => {
    event.preventDefault();
    const plainText = event.clipboardData.getData("text/plain").replace(/\s+/g, " ");
    document.execCommand("insertText", false, plainText);
});

noteTitle.addEventListener("input", () => {
    if (!currentNote) return;

    currentNote.title = getEditableTitle() || "Untitled Note";
    currentNote.updatedAt = Date.now();

    saveNotes();
    debouncedCloudSave();
    renderFolders();
    renderNotes(filterNotes(noteSearch.value));
    showSaveStatus();
});

noteFolderSelect.addEventListener("change", () => {
    if (!currentNote) return;

    currentNote.folderId  = noteFolderSelect.value;
    currentNote.updatedAt = Date.now();

    currentFolder = folders.find(f => f.id === currentNote.folderId) || folders[0];

    saveNotes();
    debouncedCloudSave();
    renderFolders();
    renderNotes(filterNotes(noteSearch.value));
    showSaveStatus();
});

noteSubjectSelect.addEventListener("change", () => {
    const subjectId = noteSubjectSelect.value;

    if (currentNote) {
        currentNote.subjectId = subjectId;
        currentNote.chapterId = "";
        currentNote.chapter = "";
        currentNote.updatedAt = Date.now();
        saveNotes();
        debouncedCloudSave();
        renderNotes(filterNotes(noteSearch.value));
        showSaveStatus();
    } else {
        pendingSubjectId = subjectId;
        pendingChapterId = "";
    }

    if (subjectId) {
        localStorage.setItem(CURRENT_SUBJECT_KEY, subjectId);
    }

    renderChapterSelect();
});

noteChapterSelect.addEventListener("change", () => {
    const chapterId = noteChapterSelect.value;
    const chapter = findChapter(noteSubjectSelect.value, chapterId);

    if (!currentNote) {
        pendingChapterId = chapterId;
        return;
    }

    currentNote.chapterId = chapterId;
    currentNote.chapter = chapter ? chapter.name : "";
    currentNote.updatedAt = Date.now();

    saveNotes();
    debouncedCloudSave();
    renderNotes(filterNotes(noteSearch.value));
    showSaveStatus();
});

// ── Sidebar Subject & Chapter Creation ───────────────────────

showNewSubjectBtn.addEventListener("click", () => {
    noteSubjectFilter.classList.add("is-hidden");
    showNewSubjectBtn.classList.add("is-hidden");
    newSubjectInput.classList.remove("is-hidden");
    newSubjectInput.focus();
});

newSubjectInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        createSubjectSidebar();
    }
    if (event.key === "Escape") {
        resetSubjectInput();
    }
});

newSubjectInput.addEventListener("blur", () => {
    if (newSubjectInput.value.trim()) {
        createSubjectSidebar();
    } else {
        resetSubjectInput();
    }
});

function resetSubjectInput() {
    newSubjectInput.value = "";
    newSubjectInput.classList.add("is-hidden");
    noteSubjectFilter.classList.remove("is-hidden");
    showNewSubjectBtn.classList.remove("is-hidden");
}

function createSubjectSidebar() {
    const name = newSubjectInput.value.trim();
    if (!name) {
        resetSubjectInput();
        return;
    }

    if (subjects.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        alert(`A subject named "${name}" already exists.`);
        resetSubjectInput();
        return;
    }

    const newSubject = {
        id: `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name,
        description: "",
        chapters: [],
        completedChapters: 0,
        totalChapters: 0,
        currentTopic: "",
        currentChapter: "",
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    activeSubjectFilter = newSubject.id;
    activeChapterFilter = "";
    pendingSubjectId = newSubject.id;
    pendingChapterId = "";
    resetSubjectInput();

    saveToCloud("subjects", newSubject).catch(err => {
        console.error("Could not save subject to cloud:", err);
    });
}

showNewChapterBtn.addEventListener("click", () => {
    noteChapterFilter.classList.add("is-hidden");
    showNewChapterBtn.classList.add("is-hidden");
    newChapterInput.classList.remove("is-hidden");
    newChapterInput.focus();
});

newChapterInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
        event.preventDefault();
        createChapterSidebar();
    }
    if (event.key === "Escape") {
        resetChapterInput();
    }
});

newChapterInput.addEventListener("blur", () => {
    if (newChapterInput.value.trim()) {
        createChapterSidebar();
    } else {
        resetChapterInput();
    }
});

function resetChapterInput() {
    newChapterInput.value = "";
    newChapterInput.classList.add("is-hidden");
    noteChapterFilter.classList.remove("is-hidden");
    showNewChapterBtn.classList.remove("is-hidden");
}

function createChapterSidebar() {
    const name = newChapterInput.value.trim();
    if (!name) {
        resetChapterInput();
        return;
    }

    const subjectId = activeSubjectFilter || pendingSubjectId;
    if (!subjectId) {
        resetChapterInput();
        return;
    }

    const subject = findSubject(subjectId);
    if (!subject) {
        resetChapterInput();
        return;
    }

    if (Array.isArray(subject.chapters) && subject.chapters.some(ch => ch.name.toLowerCase() === name.toLowerCase())) {
        alert(`A chapter named "${name}" already exists in this subject.`);
        resetChapterInput();
        return;
    }

    const newChapter = {
        id: `chapter-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        name: name,
        description: "",
        completed: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    if (!Array.isArray(subject.chapters)) subject.chapters = [];
    subject.chapters.push(newChapter);
    subject.totalChapters = subject.chapters.length;
    subject.updatedAt = Date.now();

    activeChapterFilter = newChapter.id;
    pendingChapterId = newChapter.id;
    resetChapterInput();

    saveToCloud("subjects", subject).catch(err => {
        console.error("Could not save chapter to cloud:", err);
    });
}

noteSubjectFilter.addEventListener("change", () => {
    activeSubjectFilter = noteSubjectFilter.value;
    activeChapterFilter = "";

    if (activeSubjectFilter) {
        pendingSubjectId = activeSubjectFilter;
        pendingChapterId = "";
    }

    renderNoteFilters();
    syncCurrentNoteToFilters();
    renderNotes(filterNotes(noteSearch.value));
    updateFilterUrl();
});

noteChapterFilter.addEventListener("change", () => {
    activeChapterFilter = noteChapterFilter.value;

    if (activeChapterFilter) {
        pendingSubjectId = activeSubjectFilter;
        pendingChapterId = activeChapterFilter;
    }

    renderNoteFilters();
    syncCurrentNoteToFilters();
    renderNotes(filterNotes(noteSearch.value));
    updateFilterUrl();
});

clearNoteFilters.addEventListener("click", () => {
    activeSubjectFilter = "";
    activeChapterFilter = "";
    renderNoteFilters();
    syncCurrentNoteToFilters();
    renderNotes(filterNotes(noteSearch.value));
    updateFilterUrl();
});

// ── Cloud boot ───────────────────────────────────────────────
let unsubscribeSubjects = null;
let unsubscribeFolders = null;
let unsubscribeNotes = null;

firebase.auth().onAuthStateChanged(async user => {
    if (!user) {
        window.location.href = "auth.html";
        return;
    }

    await migrateLocalNotesData();
    startNotesSync();
});

async function startNotesSync() {
    if (unsubscribeSubjects) unsubscribeSubjects();
    if (unsubscribeFolders) unsubscribeFolders();
    if (unsubscribeNotes) unsubscribeNotes();

    unsubscribeSubjects = onCloudUpdate("subjects", cloudSubjects => {
        subjects = cloudSubjects.map(normalizeSubjectLite).filter(Boolean);
        validateSubjectContext();
        syncNoteMetaControls();
        renderNoteFilters();
        renderNotes(filterNotes(noteSearch.value));
    });

    unsubscribeFolders = onCloudUpdate("folders", cloudFolders => {
        folders = normalizeFolders(cloudFolders);
        if (!currentFolder || !folders.some(folder => folder.id === currentFolder.id)) {
            currentFolder = folders[0] || { ...DEFAULT_FOLDER };
        }
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
        renderFolders();
        syncCurrentNoteToFilters();
        renderNotes(filterNotes(noteSearch.value));
    });

    unsubscribeNotes = onCloudUpdate("notes", cloudNotes => {
        notes = normalizeNotes(cloudNotes);
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));

        if (!currentNote || !notes.some(note => note.id === currentNote.id)) {
            syncCurrentNoteToFilters();
        } else {
            const syncedCurrent = notes.find(note => note.id === currentNote.id);
            currentNote = syncedCurrent;
            setNoteTitle(currentNote.title);
            setEditorContent(currentNote.content);
            syncNoteMetaControls();
        }

        renderFolders();
        renderNoteFilters();
        renderNotes(filterNotes(noteSearch.value));
    });
}

async function migrateLocalNotesData() {
    const [cloudSubjects, cloudFolders, cloudNotes] = await Promise.all([
        fetchFromCloud("subjects"),
        fetchFromCloud("folders"),
        fetchFromCloud("notes")
    ]);

    if (!cloudFolders.length) {
        const localFolders = loadFoldersFromLocal();
        const foldersToSave = localFolders.length ? localFolders : [{ ...DEFAULT_FOLDER }];
        await Promise.all(foldersToSave.map(folder => saveToCloud("folders", folder)));
    }

    if (!cloudNotes.length) {
        const localNotes = loadNotesFromLocal();
        if (localNotes.length) {
            await Promise.all(localNotes.map(note => saveToCloud("notes", note)));
        }
    }

    if (cloudSubjects.length) {
        subjects = cloudSubjects.map(normalizeSubjectLite).filter(Boolean);
        validateSubjectContext();
    }
}

// ============================================================
//  SUBJECTS + CHAPTERS
// ============================================================
function validateSubjectContext() {
    if (!subjects.some(subject => subject.id === pendingSubjectId)) {
        pendingSubjectId = "";
        pendingChapterId = "";
    }

    if (!subjects.some(subject => subject.id === activeSubjectFilter)) {
        activeSubjectFilter = "";
        activeChapterFilter = "";
    }

    if (activeChapterFilter && !findChapter(activeSubjectFilter, activeChapterFilter)) {
        activeChapterFilter = "";
    }
}

function normalizeSubjectLite(subject) {
    if (!subject || !subject.id || !subject.name) return null;
    return {
        ...subject,
        id: String(subject.id),
        name: String(subject.name).trim(),
        chapters: Array.isArray(subject.chapters)
            ? subject.chapters.map(chapter => ({
                ...chapter,
                id: String(chapter.id),
                name: String(chapter.name || "").trim()
            }))
            : []
    };
}

function findSubject(subjectId) {
    return subjects.find(subject => subject.id === subjectId) || null;
}

function findChapter(subjectId, chapterId) {
    const subject = findSubject(subjectId);
    if (!subject || !Array.isArray(subject.chapters)) return null;
    return subject.chapters.find(chapter => chapter.id === chapterId) || null;
}

function renderSubjectSelect() {
    const selectedId = currentNote ? currentNote.subjectId : pendingSubjectId;
    noteSubjectSelect.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = subjects.length ? "No subject" : "No subjects available";
    noteSubjectSelect.appendChild(emptyOption);

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        option.selected = subject.id === selectedId;
        noteSubjectSelect.appendChild(option);
    });
}

function renderChapterSelect() {
    const subjectId = currentNote ? currentNote.subjectId : pendingSubjectId;
    const selectedId = currentNote ? currentNote.chapterId : pendingChapterId;
    const subject = findSubject(subjectId);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];

    noteChapterSelect.innerHTML = "";

    const emptyOption = document.createElement("option");
    emptyOption.value = "";
    emptyOption.textContent = subjectId
        ? (chapters.length ? "No chapter" : "No chapters available")
        : "Choose a subject first";
    noteChapterSelect.appendChild(emptyOption);

    chapters.forEach(chapter => {
        const option = document.createElement("option");
        option.value = chapter.id;
        option.textContent = chapter.name;
        option.selected = chapter.id === selectedId;
        noteChapterSelect.appendChild(option);
    });

    noteChapterSelect.disabled = !subjectId || chapters.length === 0;
    addChapterInlineBtn.disabled = !subjectId;
}

function syncNoteMetaControls() {
    renderFolderSelect();
    renderSubjectSelect();
    renderChapterSelect();
}

function renderNoteFilters() {
    noteSubjectFilter.innerHTML = "";

    const allSubjectsOption = document.createElement("option");
    allSubjectsOption.value = "";
    allSubjectsOption.textContent = "All subjects";
    noteSubjectFilter.appendChild(allSubjectsOption);

    showNewChapterBtn.disabled = !activeSubjectFilter;

    subjects.forEach(subject => {
        const option = document.createElement("option");
        option.value = subject.id;
        option.textContent = subject.name;
        option.selected = subject.id === activeSubjectFilter;
        noteSubjectFilter.appendChild(option);
    });

    noteChapterFilter.innerHTML = "";
    const allChaptersOption = document.createElement("option");
    allChaptersOption.value = "";
    allChaptersOption.textContent = "All chapters";
    noteChapterFilter.appendChild(allChaptersOption);

    const activeSubject = findSubject(activeSubjectFilter);
    const chapters = activeSubject && Array.isArray(activeSubject.chapters)
        ? activeSubject.chapters
        : [];

    chapters.forEach(chapter => {
        const option = document.createElement("option");
        option.value = chapter.id;
        option.textContent = chapter.name;
        option.selected = chapter.id === activeChapterFilter;
        noteChapterFilter.appendChild(option);
    });

    noteChapterFilter.disabled = !activeSubjectFilter || chapters.length === 0;
    clearNoteFilters.hidden = !activeSubjectFilter && !activeChapterFilter;

    const activeChapter = findChapter(activeSubjectFilter, activeChapterFilter);
    noteFilterContext.textContent = activeSubject
        ? `${activeSubject.name}${activeChapter ? ` / ${activeChapter.name}` : " / All chapters"}`
        : "Showing notes from all subjects";
}

function updateFilterUrl() {
    const url = new URL(window.location.href);

    if (activeSubjectFilter) {
        url.searchParams.set("subject", activeSubjectFilter);
    } else {
        url.searchParams.delete("subject");
    }

    if (activeChapterFilter) {
        url.searchParams.set("chapter", activeChapterFilter);
    } else {
        url.searchParams.delete("chapter");
    }

    window.history.replaceState({}, "", url);
}

function getVisibleNotes(query = "") {
    const filtered = filterNotes(query);

    if (!currentFolder || currentFolder.id === DEFAULT_FOLDER.id) {
        return filtered;
    }

    return filtered.filter(note => note.folderId === currentFolder.id);
}

function syncCurrentNoteToFilters() {
    const visibleNotes = getVisibleNotes(noteSearch.value);

    if (currentNote && visibleNotes.some(note => note.id === currentNote.id)) {
        return;
    }

    currentNote = visibleNotes[0] || null;

    if (currentNote) {
        setNoteTitle(currentNote.title);
        setEditorContent(currentNote.content);
    } else {
        pendingSubjectId = activeSubjectFilter || pendingSubjectId;
        pendingChapterId = activeChapterFilter;
        setNoteTitle("");
        setEditorContent("");
    }

    syncNoteMetaControls();
}

// ============================================================
//  FOLDERS
// ============================================================
function loadFoldersFromLocal() {
    const raw = localStorage.getItem(FOLDERS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedFolders = JSON.parse(raw);
        return Array.isArray(storedFolders) ? storedFolders : [];
    } catch (error) {
        console.error("Could not load folders:", error);
        return [];
    }
}

function normalizeFolders(cloudFolders) {
    const normalized = Array.isArray(cloudFolders)
        ? cloudFolders.map(folder => ({
            id: String(folder.id || ""),
            name: String(folder.name || "").trim()
        })).filter(folder => folder.id && folder.name)
        : [];

    if (!normalized.some(folder => folder.id === DEFAULT_FOLDER.id)) {
        normalized.unshift({ ...DEFAULT_FOLDER });
    }

    return normalized;
}

function saveFolders() {
    try {
        localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    } catch (error) {
        console.error("Could not save folders:", error);
    }
}

function createFolderFromInput() {
    const name = newFolderInput.value.trim();
    if (!name) return;

    const folder = {
        id:   "folder-" + Date.now(),
        name: name
    };

    currentFolder = folder;
    newFolderInput.value = "";

    saveToCloud("folders", folder)
        .then(() => {
            saveFolders();
        })
        .catch(error => {
            console.error("Could not save folder to cloud:", error);
        });
}

async function deleteFolder(folder) {
    if (folder.id === DEFAULT_FOLDER.id) {
        alert("You can't delete the default folder.");
        return;
    }

    const confirmed = await window.floraConfirm(
        "Delete Folder?",
        `Delete folder "${folder.name}"?\nNotes inside will move to "${DEFAULT_FOLDER.name}".`
    );
    if (!confirmed) return;

    const movedNotes = notes
        .filter(note => note.folderId === folder.id)
        .map(note => ({
            ...note,
            folderId: DEFAULT_FOLDER.id,
            updatedAt: Date.now()
        }));

    Promise.all([
        ...movedNotes.map(note => saveToCloud("notes", note)),
        deleteFromCloud("folders", folder.id)
    ]).then(() => {
        currentFolder = folders.find(item => item.id === DEFAULT_FOLDER.id) || { ...DEFAULT_FOLDER };
        saveFolders();
    }).catch(error => {
        console.error("Could not delete folder from cloud:", error);
    });
}

function selectFolder(folder) {
    currentFolder = folder;
    renderFolders();
    syncCurrentNoteToFilters();
    renderNotes(filterNotes(noteSearch.value));
}

function countNotesInFolder(folderId) {
    if (folderId === DEFAULT_FOLDER.id) {
        return notes.length;
    }

    return notes.filter(note => note.folderId === folderId).length;
}

function renderFolders() {
    foldersList.innerHTML = "";

    folders.forEach(folder => {
        const item     = document.createElement("div");
        item.className = "folder-item";
        if (currentFolder && folder.id === currentFolder.id) {
            item.classList.add("active");
        }

        const nameSpan = document.createElement("span");
        nameSpan.textContent = folder.name;
        item.appendChild(nameSpan);

        const countBadge = document.createElement("span");
        countBadge.className   = "folder-count";
        countBadge.textContent = countNotesInFolder(folder.id);
        item.appendChild(countBadge);

        if (folder.id !== DEFAULT_FOLDER.id) {
            const deleteBtn = document.createElement("button");
            deleteBtn.className   = "folder-delete-btn";
            deleteBtn.textContent = "🗑";
            deleteBtn.title       = "Delete folder";
            deleteBtn.addEventListener("click", event => {
                event.stopPropagation();
                deleteFolder(folder);
            });
            item.appendChild(deleteBtn);
        }

        item.addEventListener("click", () => selectFolder(folder));
        foldersList.appendChild(item);
    });
}

// ============================================================
//  CREATE
// ============================================================
function createNote() {
    const selectedSubjectId = noteSubjectSelect.value || pendingSubjectId;
    const selectedChapterId = noteChapterSelect.value || pendingChapterId;
    const selectedChapter = findChapter(selectedSubjectId, selectedChapterId);

    const note = {
        id:        String(Date.now()),
        folderId:  currentFolder ? currentFolder.id : DEFAULT_FOLDER.id,
        subjectId:  selectedSubjectId,
        chapterId:  selectedChapter ? selectedChapter.id : "",
        chapter:    selectedChapter ? selectedChapter.name : "",
        title:     "Untitled Note",
        content:   "",
        schemaVersion: 2,
        updatedAt: Date.now(),
        _isNew:    true  // Flag: don't save to cloud until first real edit
    };

    currentNote = note;
    notes.push(note);

    setNoteTitle(note.title);
    setEditorContent("");
    noteSearch.value = "";

    syncNoteMetaControls();
    renderFolders();
    renderNotes();

    // Jump straight into the editor — no extra click needed
    noteEditor.focus();
}

// ============================================================
//  PERSISTENCE
// ============================================================
function saveNotes() {
    try {
        localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
        console.error("Could not save notes locally:", error);
    }
}

function loadNotesFromLocal() {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedNotes = JSON.parse(raw);
        return Array.isArray(storedNotes) ? storedNotes : [];
    } catch (error) {
        console.error("Could not load notes:", error);
        return [];
    }
}

function normalizeNotes(cloudNotes) {
    return (Array.isArray(cloudNotes) ? cloudNotes : []).map(note => {
        note.title = String(note.title || "Untitled Note");
        note.content = String(note.content || "");
        note.id = String(note.id || Date.now());

        if (!note.updatedAt || typeof note.updatedAt !== "number") {
            note.updatedAt = Date.now();
        }

        if (!note.folderId) {
            note.folderId = DEFAULT_FOLDER.id;
        }

        note.subjectId = note.subjectId || "";
        note.chapterId = note.chapterId || "";
        note.chapter = note.chapter || "";

        if (note.schemaVersion !== 2) {
            note.content = removeLegacyTitleFromContent(note.content, note.title);
            note.schemaVersion = 2;
        }

        if (note.subjectId && !findSubject(note.subjectId)) {
            note.subjectId = "";
            note.chapterId = "";
        }

        if (note.subjectId && !note.chapterId && note.chapter) {
            const subject = findSubject(note.subjectId);
            const matchedChapter = subject && Array.isArray(subject.chapters)
                ? subject.chapters.find(chapter => chapter.name.toLowerCase() === note.chapter.toLowerCase())
                : null;
            if (matchedChapter) note.chapterId = matchedChapter.id;
        }

        if (note.subjectId && note.chapterId) {
            const linkedChapter = findChapter(note.subjectId, note.chapterId);
            if (linkedChapter) {
                note.chapter = linkedChapter.name;
            } else {
                note.chapterId = "";
            }
        }

        if (note.labels) delete note.labels;
        return note;
    });
}

// ============================================================
//  SAVE STATUS INDICATOR
// ============================================================
function showSaveStatus() {
    if (!saveStatus) return;

    clearTimeout(saveTimer);
    clearTimeout(saveHideTimer);

    saveStatus.textContent = "Saving…";
    saveStatus.className   = "save-status saving";

    saveTimer = setTimeout(() => {
        saveStatus.textContent = "Saved ✓";
        saveStatus.className   = "save-status saved";

        saveHideTimer = setTimeout(() => {
            saveStatus.className = "save-status hidden";
        }, 2000);
    }, 600);
}

// ============================================================
//  EDITOR HELPERS
// ============================================================
function setNoteTitle(title) {
    noteTitle.textContent = title || "";
}

function getEditableTitle() {
    return noteTitle.innerText.replace(/\s+/g, " ").trim();
}

function setEditorContent(html) {
    noteEditor.innerHTML = html || "";
}

function getEditorContent() {
    return noteEditor.innerHTML;
}

function renderFolderSelect() {
    noteFolderSelect.innerHTML = "";

    folders.forEach(folder => {
        const option       = document.createElement("option");
        option.value       = folder.id;
        option.textContent = folder.name;

        if (currentNote && folder.id === currentNote.folderId) {
            option.selected = true;
        }

        noteFolderSelect.appendChild(option);
    });
}

// ============================================================
//  SEARCH
// ============================================================
function filterNotes(query) {
    const q = query.trim().toLowerCase();

    return notes.filter(note => {
        if (activeSubjectFilter && note.subjectId !== activeSubjectFilter) {
            return false;
        }

        if (activeChapterFilter && note.chapterId !== activeChapterFilter) {
            return false;
        }

        if (!q) return true;

        const inTitle   = note.title.toLowerCase().includes(q);
        const inContent = stripHtml(note.content).toLowerCase().includes(q);
        const inChapter = note.chapter && note.chapter.toLowerCase().includes(q);
        const subject = findSubject(note.subjectId);
        const inSubject = subject && subject.name.toLowerCase().includes(q);
        return inTitle || inContent || inChapter || inSubject;
    });
}

noteSearch.addEventListener("input", () => {
    syncCurrentNoteToFilters();
    renderNotes(filterNotes(noteSearch.value));
});

// ============================================================
//  HELPERS
// ============================================================
function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return tmp.innerText || tmp.textContent || "";
}

function removeLegacyTitleFromContent(content, title) {
    const html = content || "";
    const expectedTitle = String(title || "").trim();

    if (!html || !expectedTitle || expectedTitle === "Untitled Note") {
        return html;
    }

    const container = document.createElement("div");
    container.innerHTML = html;
    const firstLine = (container.innerText || container.textContent || "")
        .replace(/\r/g, "")
        .split("\n")[0]
        .trim();

    if (firstLine !== expectedTitle) {
        return html;
    }

    while (container.firstChild &&
        container.firstChild.nodeType === Node.TEXT_NODE &&
        !container.firstChild.textContent.trim()) {
        container.firstChild.remove();
    }

    const firstNode = container.firstChild;
    let removed = false;

    if (firstNode && firstNode.nodeType === Node.TEXT_NODE) {
        const text = firstNode.textContent.replace(/\r/g, "");
        const newlineIndex = text.indexOf("\n");
        const firstTextLine = (newlineIndex >= 0 ? text.slice(0, newlineIndex) : text).trim();

        if (firstTextLine === expectedTitle) {
            if (newlineIndex >= 0) {
                firstNode.textContent = text.slice(newlineIndex + 1);
            } else {
                firstNode.remove();
            }
            removed = true;
        }
    } else if (firstNode && firstNode.nodeType === Node.ELEMENT_NODE) {
        const nodeText = (firstNode.innerText || firstNode.textContent || "").trim();
        if (nodeText === expectedTitle) {
            firstNode.remove();
            removed = true;
        }
    }

    if (!removed) {
        return html;
    }

    while (container.firstChild &&
        ((container.firstChild.nodeType === Node.TEXT_NODE && !container.firstChild.textContent.trim()) ||
        (container.firstChild.nodeType === Node.ELEMENT_NODE && container.firstChild.tagName === "BR"))) {
        container.firstChild.remove();
    }

    return container.innerHTML;
}

function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function getPreview(content) {
    const body = stripHtml(content).replace(/\s+/g, " ").trim();

    if (!body) return "No content yet";

    return body.length > 80 ? body.substring(0, 80) + "…" : body;
}

function timeAgo(timestamp) {
    const now     = Date.now();
    const diff    = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);

    if (seconds < 30)  return "Just now";
    if (seconds < 90)  return "1 minute ago";
    if (minutes < 60)  return `${minutes} minutes ago`;
    if (hours === 1)   return "1 hour ago";
    if (hours < 24)    return `${hours} hours ago`;
    if (days === 1)    return "Yesterday";
    if (days < 7)      return `${days} days ago`;
    if (days < 14)     return "Last week";

    // For older notes, show the actual calendar date
    return new Date(timestamp).toLocaleDateString(undefined, {
        month: "short",
        day:   "numeric"
    });
}

// ============================================================
//  RENDER
// ============================================================
function renderNoteCard(note) {
    const noteCard     = document.createElement("div");
    noteCard.className = "note-card";

    if (currentNote && note.id === currentNote.id) {
        noteCard.classList.add("active");
    }

    const preview   = getPreview(note.content);
    const timestamp = timeAgo(note.updatedAt);
    const subject = findSubject(note.subjectId);
    const subjectLabel = subject
        ? `<span class="note-card-subject">${escapeHtml(subject.name)}</span>`
        : "";

    noteCard.innerHTML = `
        <div class="note-content">
            ${subjectLabel}
            <h3>📝 ${escapeHtml(note.title)}</h3>
            <p class="note-preview">${escapeHtml(preview)}</p>
            <span class="note-timestamp">✏️ ${timestamp}</span>
        </div>
        <button class="delete-note-btn" title="Delete note">🗑</button>
    `;

    // ── Delete handler ────────────────────────────────────
    const deleteBtn = noteCard.querySelector(".delete-note-btn");
    deleteBtn.addEventListener("click", async event => {
        event.stopPropagation();

        const confirmed = await window.floraConfirm(
            "Delete Note?",
            `Delete "${note.title}"?\nThis cannot be undone.`
        );
        if (!confirmed) return;

        const deletedCurrentNote = currentNote && currentNote.id === note.id;
        notes = notes.filter(item => item.id !== note.id);

        deleteFromCloud("notes", note.id).catch(error => {
            console.error("Could not delete note from cloud:", error);
        });

        saveNotes();
        renderFolders();

        if (deletedCurrentNote) {
            currentNote = null;
            syncCurrentNoteToFilters();
        }

        renderNotes(filterNotes(noteSearch.value));
    });

    // ── Select handler ────────────────────────────────────
    noteCard.addEventListener("click", () => {
        currentNote            = note;
        setNoteTitle(note.title);
        setEditorContent(note.content);
        syncNoteMetaControls();
        renderNotes(filterNotes(noteSearch.value));
    });

    return noteCard;
}

function groupNotesByChapter(list) {
    const groups = {};

    list.forEach(note => {
        const chapter = note.chapter && note.chapter.trim()
            ? note.chapter.trim()
            : "General";

        if (!groups[chapter]) {
            groups[chapter] = [];
        }
        groups[chapter].push(note);
    });

    return groups;
}

function renderNotes(list = notes) {
    notesList.innerHTML = "";

    // The default folder is the complete library; custom folders narrow it down.
    const folderNotes = currentFolder && currentFolder.id !== DEFAULT_FOLDER.id
        ? list.filter(note => note.folderId === currentFolder.id)
        : list;

    // ── Empty state ──────────────────────────────────────────
    if (folderNotes.length === 0) {
        const emptyMsg       = document.createElement("p");
        emptyMsg.className   = "note-search-empty";

        const isSearching    = noteSearch.value.trim().length > 0;
        const folderName     = currentFolder ? currentFolder.name : "this folder";
        const activeSubject = findSubject(activeSubjectFilter);
        const activeChapter = findChapter(activeSubjectFilter, activeChapterFilter);
        const viewName = activeChapter
            ? `${activeSubject.name} / ${activeChapter.name}`
            : (activeSubject ? activeSubject.name : folderName);
        emptyMsg.textContent = isSearching
            ? `No notes match your search in ${viewName}.`
            : `No notes in ${viewName} yet.\nCreate your first note!`;

        notesList.appendChild(emptyMsg);
        return;
    }

    // ── Group notes by chapter inside the folder ───────────────
    const groups         = groupNotesByChapter(folderNotes);
    const sortedChapters = Object.keys(groups).sort((a, b) => {
        if (a === "General") return -1;
        if (b === "General") return 1;
        return a.localeCompare(b);
    });

    sortedChapters.forEach(chapter => {
        const header       = document.createElement("h4");
        header.className   = "notes-group-header";
        header.textContent = chapter;
        notesList.appendChild(header);

        groups[chapter].forEach(note => {
            notesList.appendChild(renderNoteCard(note));
        });
    });
}

// ============================================================
//  EDITOR — live update on every keystroke
// ============================================================
noteEditor.addEventListener("input", () => {
    if (!currentNote) return;

    // Store the rich-text body independently from the note title.
    currentNote.content = getEditorContent();

    // Stamp the edit time
    currentNote.updatedAt = Date.now();

    // Persist locally and queue cloud save
    saveNotes();
    debouncedCloudSave();
    renderFolders();
    renderNotes(filterNotes(noteSearch.value));

    // Show the save feedback pill
    showSaveStatus();
});

// ============================================================
//  AI INTEGRATION
// ============================================================
const aiSummarizeBtn = document.getElementById("ai-summarize-btn");
const aiFlashcardsBtn = document.getElementById("ai-flashcards-btn");
const aiQuizBtn = document.getElementById("ai-quiz-btn");
const aiExplainBtn = document.getElementById("ai-explain-btn");
const aiSettingsBtn = document.getElementById("ai-settings-btn");
const aiSettingsDialog = document.getElementById("ai-settings-dialog");
const aiSettingsForm = document.getElementById("ai-settings-form");
const aiSettingsClose = document.getElementById("ai-settings-close");
const aiSettingsCancel = document.getElementById("ai-settings-cancel");
const aiApiKeyInput = document.getElementById("ai-api-key");
const aiModelSelect = document.getElementById("ai-model-select");
const aiLoadModelsBtn = document.getElementById("ai-load-models-btn");
const aiOutput = document.getElementById("ai-output");
const aiOutputLabel = document.getElementById("ai-output-label");
const aiOutputContent = document.getElementById("ai-output-content");
const aiOutputClose = document.getElementById("ai-output-close");
const aiOutputActions = document.getElementById("ai-output-actions");
const aiSaveResultBtn = document.getElementById("ai-save-result-btn");
const aiStatus = document.getElementById("ai-status");

let pendingAiResult = null;

aiSettingsBtn.addEventListener("click", () => {
    aiApiKeyInput.value = getAiKey();
    const savedModel = getAiModel();
    if (savedModel) {
        const exists = Array.from(aiModelSelect.options).some(o => o.value === savedModel);
        if (!exists) {
            const opt = document.createElement("option");
            opt.value = savedModel;
            opt.textContent = savedModel;
            opt.selected = true;
            aiModelSelect.appendChild(opt);
        } else {
            aiModelSelect.value = savedModel;
        }
    }
    aiSettingsDialog.showModal();
});

aiLoadModelsBtn.addEventListener("click", async () => {
    const key = aiApiKeyInput.value.trim() || getAiKey();
    if (!key) {
        aiStatus.textContent = "Paste your API key first, then click Load Free Models.";
        aiStatus.className = "ai-status error";
        return;
    }

    aiLoadModelsBtn.textContent = "Loading models...";
    aiLoadModelsBtn.disabled = true;

    try {
        const freeModels = await fetchFreeModels(key);

        aiModelSelect.innerHTML = "";

        if (!freeModels.length) {
            const opt = document.createElement("option");
            opt.value = "";
            opt.textContent = "No free models found";
            aiModelSelect.appendChild(opt);
        } else {
            const currentModel = getAiModel();
            freeModels.forEach(model => {
                const opt = document.createElement("option");
                opt.value = model.id;
                opt.textContent = model.name || model.id;
                if (model.id === currentModel) opt.selected = true;
                aiModelSelect.appendChild(opt);
            });

            if (!getAiModel() && freeModels.length) {
                aiModelSelect.value = freeModels[0].id;
            }
        }

        aiLoadModelsBtn.textContent = `${freeModels.length} free models loaded`;
    } catch (error) {
        aiLoadModelsBtn.textContent = "Load Free Models";
        aiStatus.textContent = error.message;
        aiStatus.className = "ai-status error";
    } finally {
        aiLoadModelsBtn.disabled = false;
    }
});

aiSettingsClose.addEventListener("click", () => aiSettingsDialog.close());
aiSettingsCancel.addEventListener("click", () => aiSettingsDialog.close());
aiSettingsDialog.addEventListener("click", e => {
    if (e.target === aiSettingsDialog) aiSettingsDialog.close();
});

aiSettingsForm.addEventListener("submit", e => {
    e.preventDefault();
    const key = aiApiKeyInput.value.trim();
    const model = aiModelSelect.value;

    if (!key) {
        aiStatus.textContent = "Please enter your OpenRouter API key.";
        aiStatus.className = "ai-status error";
        aiSettingsDialog.close();
        return;
    }

    setAiKey(key);
    if (model) setAiModel(model);

    aiSettingsDialog.close();
    aiStatus.textContent = model
        ? `Settings saved. Model: ${model}`
        : "API key saved. Open Settings and Load Free Models to pick a model.";
    aiStatus.className = "ai-status";
});

aiOutputClose.addEventListener("click", hideAiOutput);

aiSummarizeBtn.addEventListener("click", () => runAi("summarize"));
aiFlashcardsBtn.addEventListener("click", () => runAi("flashcards"));
aiQuizBtn.addEventListener("click", () => runAi("quiz"));
aiExplainBtn.addEventListener("click", () => runAi("explain"));
aiSaveResultBtn.addEventListener("click", saveAiResult);

async function runAi(action) {
    if (!currentNote) {
        aiStatus.textContent = "Select a note first.";
        aiStatus.className = "ai-status error";
        return;
    }

    if (!hasAiKey()) {
        aiApiKeyInput.value = "";
        aiSettingsDialog.showModal();
        return;
    }

    const plainText = stripHtml(currentNote.content).trim();
    if (!plainText || plainText.length < 20) {
        aiStatus.textContent = "Write more content in the note before using AI.";
        aiStatus.className = "ai-status error";
        return;
    }

    const allBtns = [aiSummarizeBtn, aiFlashcardsBtn, aiQuizBtn, aiExplainBtn];
    allBtns.forEach(btn => btn.disabled = true);
    aiStatus.textContent = "Thinking...";
    aiStatus.className = "ai-status";
    hideAiOutput();
    pendingAiResult = null;

    try {
        let prompt;
        let label;

        switch (action) {
            case "summarize":
                prompt = buildSummarizePrompt(plainText);
                label = "Summary";
                break;
            case "explain":
                prompt = buildExplainPrompt(plainText);
                label = "Explanation";
                break;
            case "flashcards":
                prompt = buildFlashcardsPrompt(plainText);
                label = "Generated Flashcards";
                break;
            case "quiz":
                prompt = buildQuizPrompt(plainText);
                label = "Generated Quiz";
                break;
        }

        const result = await askGemini(prompt, action === "flashcards" || action === "quiz");

        aiStatus.textContent = "";
        pendingAiResult = { action, result };

        if (action === "summarize" || action === "explain") {
            showAiOutput(label, result, false);
        } else if (action === "flashcards") {
            const cards = parseJsonFromAi(result);
            if (!Array.isArray(cards) || !cards.length) throw new Error("AI did not return valid flashcards.");
            const preview = cards.map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`).join("\n\n");
            showAiOutput(label + ` (${cards.length} cards)`, preview, true);
            pendingAiResult.parsed = cards;
        } else if (action === "quiz") {
            const questions = parseJsonFromAi(result);
            if (!Array.isArray(questions) || !questions.length) throw new Error("AI did not return valid quiz questions.");
            const letters = ["A", "B", "C", "D"];
            const preview = questions.map((q, i) => {
                const opts = q.options.map((o, j) => `   ${letters[j]}. ${o}${j === q.correctIndex ? " ✓" : ""}`).join("\n");
                return `${i + 1}. ${q.prompt}\n${opts}`;
            }).join("\n\n");
            showAiOutput(label + ` (${questions.length} questions)`, preview, true);
            pendingAiResult.parsed = questions;
        }

    } catch (error) {
        aiStatus.textContent = error.message;
        aiStatus.className = "ai-status error";
    } finally {
        allBtns.forEach(btn => btn.disabled = false);
    }
}

function showAiOutput(label, content, showSaveBtn) {
    aiOutputLabel.textContent = label;
    aiOutputContent.textContent = content;
    aiOutput.classList.remove("is-hidden");

    if (showSaveBtn) {
        aiOutputActions.classList.remove("is-hidden");
    } else {
        aiOutputActions.classList.add("is-hidden");
    }
}

function hideAiOutput() {
    aiOutput.classList.add("is-hidden");
    aiOutputContent.textContent = "";
    aiOutputActions.classList.add("is-hidden");
    pendingAiResult = null;
}

function saveAiResult() {
    if (!pendingAiResult || !currentNote) return;

    const subjectId = currentNote.subjectId || "";
    const chapterId = currentNote.chapterId || "";

    if (pendingAiResult.action === "flashcards" && pendingAiResult.parsed) {
        const FLASHCARDS_KEY = "flora-flashcards";
        let flashcards = [];
        try {
            flashcards = JSON.parse(localStorage.getItem(FLASHCARDS_KEY)) || [];
        } catch (e) { flashcards = []; }

        const now = Date.now();
        pendingAiResult.parsed.forEach(card => {
            flashcards.push({
                id: `fc-${now}-${Math.random().toString(16).slice(2)}`,
                front: card.front,
                back: card.back,
                subjectId,
                chapterId,
                createdAt: now,
                updatedAt: now,
                reviewCount: 0,
                lastReviewedAt: null,
                lastResult: null
            });
        });

        localStorage.setItem(FLASHCARDS_KEY, JSON.stringify(flashcards));
        aiStatus.textContent = `${pendingAiResult.parsed.length} flashcards saved to Flora.`;
        aiStatus.className = "ai-status";

    } else if (pendingAiResult.action === "quiz" && pendingAiResult.parsed) {
        const QUIZZES_KEY = "flora-quizzes";
        let quizzes = [];
        try {
            quizzes = JSON.parse(localStorage.getItem(QUIZZES_KEY)) || [];
        } catch (e) { quizzes = []; }

        const now = Date.now();
        const noteTitle = currentNote.title || "Untitled Note";
        const quiz = {
            id: `quiz-${now}-${Math.random().toString(16).slice(2)}`,
            title: `AI Quiz: ${noteTitle}`,
            description: `Auto-generated from "${noteTitle}"`,
            subjectId,
            chapterId,
            questions: pendingAiResult.parsed.map((q, i) => ({
                id: `q-${now}-${i}`,
                prompt: q.prompt,
                options: q.options,
                correctIndex: q.correctIndex
            })),
            createdAt: now,
            updatedAt: now,
            attemptCount: 0,
            lastAttemptAt: null
        };

        quizzes.push(quiz);
        localStorage.setItem(QUIZZES_KEY, JSON.stringify(quizzes));
        aiStatus.textContent = `Quiz "${quiz.title}" saved with ${quiz.questions.length} questions.`;
        aiStatus.className = "ai-status";
    }

    hideAiOutput();
}