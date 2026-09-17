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
const toolbarBtns      = document.querySelectorAll(".toolbar-btn");

// ── Constants ────────────────────────────────────────────────
const DEFAULT_FOLDER = { id: "folder-default", name: "All Notes" };
const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

// ── App state ────────────────────────────────────────────────
let folders       = [];
let currentFolder = null;
let notes         = [];
let currentNote   = null;
let saveTimer     = null;   // debounce handle for save indicator
let subjects      = [];

const noteContext = new URLSearchParams(window.location.search);
let pendingSubjectId = noteContext.get("subject") || localStorage.getItem(CURRENT_SUBJECT_KEY) || "";
let pendingChapterId = noteContext.get("chapter") || "";

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
    btn.addEventListener("click", event => {
        event.preventDefault();
        const command = btn.dataset.command;
        const value   = btn.dataset.value || null;

        document.execCommand(command, false, value);
        noteEditor.focus();

        // Treat toolbar clicks as an edit so the note is saved
        noteEditor.dispatchEvent(new Event("input", { bubbles: true }));
    });
});

noteFolderSelect.addEventListener("change", () => {
    if (!currentNote) return;

    currentNote.folderId  = noteFolderSelect.value;
    currentNote.updatedAt = Date.now();

    // Highlight the folder the note just moved to
    currentFolder = folders.find(f => f.id === currentNote.folderId) || folders[0];

    saveNotes();
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
    renderNotes(filterNotes(noteSearch.value));
    showSaveStatus();
});

loadSubjects();
loadFolders();
loadNotes();
renderFolders();
renderSubjectSelect();
renderChapterSelect();
renderNotes();

// ============================================================
//  SUBJECTS + CHAPTERS
// ============================================================
function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return;

    try {
        const storedSubjects = JSON.parse(raw);
        subjects = Array.isArray(storedSubjects) ? storedSubjects : [];
    } catch (error) {
        console.error("Could not load subjects:", error);
        subjects = [];
    }

    if (!subjects.some(subject => subject.id === pendingSubjectId)) {
        pendingSubjectId = "";
        pendingChapterId = "";
    }
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
}

function syncNoteMetaControls() {
    renderFolderSelect();
    renderSubjectSelect();
    renderChapterSelect();
}

// ============================================================
//  FOLDERS
// ============================================================
function loadFolders() {
    const raw = localStorage.getItem("flora-folders");

    if (raw) {
        try {
            folders = JSON.parse(raw);
        } catch (error) {
            console.error("Could not load folders:", error);
            folders = [];
        }
    }

    if (!Array.isArray(folders)) {
        folders = [];
    }

    // Always keep the default folder so notes never lose their bucket
    if (!folders.some(f => f.id === DEFAULT_FOLDER.id)) {
        folders.unshift({ ...DEFAULT_FOLDER });
    }

    currentFolder = folders[0];
}

function saveFolders() {
    try {
        localStorage.setItem("flora-folders", JSON.stringify(folders));
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

    folders.push(folder);
    currentFolder = folder;

    newFolderInput.value = "";

    saveFolders();
    renderFolders();
    renderNotes();
}

function deleteFolder(folder) {
    if (folder.id === DEFAULT_FOLDER.id) {
        alert("You can't delete the default folder.");
        return;
    }

    const confirmed = confirm(
        `Delete folder "${folder.name}"?\n\nNotes inside will move to "${DEFAULT_FOLDER.name}".`
    );
    if (!confirmed) return;

    notes.forEach(note => {
        if (note.folderId === folder.id) {
            note.folderId = DEFAULT_FOLDER.id;
        }
    });

    folders = folders.filter(f => f.id !== folder.id);
    currentFolder = folders[0];

    saveFolders();
    saveNotes();
    renderFolders();
    renderNotes();
}

function selectFolder(folder) {
    currentFolder = folder;
    renderFolders();
    renderNotes(filterNotes(noteSearch.value));
}

function countNotesInFolder(folderId) {
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
        id:        Date.now(),
        folderId:  currentFolder ? currentFolder.id : DEFAULT_FOLDER.id,
        subjectId:  selectedSubjectId,
        chapterId:  selectedChapter ? selectedChapter.id : "",
        chapter:    selectedChapter ? selectedChapter.name : "",
        title:     "Untitled Note",
        content:   "",
        updatedAt: Date.now()
    };

    notes.push(note);
    currentNote = note;

    noteTitle.textContent    = "📝 " + note.title;
    setEditorContent("");
    noteSearch.value         = "";

    syncNoteMetaControls();
    saveNotes();
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
        localStorage.setItem("flora-notes", JSON.stringify(notes));
    } catch (error) {
        console.error("Could not save notes:", error);
    }
}

function loadNotes() {
    const raw = localStorage.getItem("flora-notes");

    if (!raw) {
        return;
    }

    try {
        notes = JSON.parse(raw);

        if (!Array.isArray(notes)) {
            notes = [];
        }

        notes.forEach(note => {
            if (!note.updatedAt) {
                note.updatedAt = Date.now();
            }

            // Migrate old notes that don't have a folder yet
            if (!note.folderId) {
                note.folderId = DEFAULT_FOLDER.id;
            }

            // Keep legacy notes valid while adding subject/chapter references
            note.subjectId = note.subjectId || "";
            note.chapterId = note.chapterId || "";
            note.chapter = note.chapter || "";

            if (note.subjectId && !findSubject(note.subjectId)) {
                note.subjectId = "";
                note.chapterId = "";
            }

            if (note.subjectId && !note.chapterId && note.chapter) {
                const subject = findSubject(note.subjectId);
                const matchedChapter = subject && Array.isArray(subject.chapters)
                    ? subject.chapters.find(chapter => chapter.name.toLowerCase() === note.chapter.toLowerCase())
                    : null;

                if (matchedChapter) {
                    note.chapterId = matchedChapter.id;
                }
            }

            if (note.subjectId && note.chapterId) {
                const linkedChapter = findChapter(note.subjectId, note.chapterId);
                if (linkedChapter) {
                    note.chapter = linkedChapter.name;
                } else {
                    note.chapterId = "";
                }
            }

            // Clean up old label data from earlier experiments
            if (note.labels) {
                delete note.labels;
            }
        });

    } catch (error) {
        console.error("Could not load notes:", error);
        notes = [];
    }

    if (notes.length > 0) {
        if (pendingSubjectId) {
            currentNote = notes.find(note =>
                note.subjectId === pendingSubjectId &&
                (!pendingChapterId || note.chapterId === pendingChapterId)
            ) || null;
        } else {
            currentNote = notes[0];
        }

        if (!currentNote) {
            noteTitle.textContent = "📝 No Note Selected";
            setEditorContent("");
            syncNoteMetaControls();
            saveNotes();
            return;
        }

        // Make sure the note's folder still exists
        const noteFolder = folders.find(f => f.id === currentNote.folderId);
        if (noteFolder) {
            currentFolder = noteFolder;
        }

        noteTitle.textContent    = "📝 " + currentNote.title;
        setEditorContent(currentNote.content);
        syncNoteMetaControls();
        saveNotes();
    }
}

// ============================================================
//  SAVE STATUS INDICATOR
// ============================================================
function showSaveStatus() {
    if (!saveStatus) return;

    clearTimeout(saveTimer);

    saveStatus.textContent = "Saving…";
    saveStatus.className   = "save-status saving";

    saveTimer = setTimeout(() => {
        saveStatus.textContent = "Saved ✓";
        saveStatus.className   = "save-status saved";

        setTimeout(() => {
            saveStatus.className = "save-status hidden";
        }, 2000);
    }, 600);
}

// ============================================================
//  EDITOR HELPERS
// ============================================================
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
    if (!q) return notes;

    return notes.filter(note => {
        const inTitle   = note.title.toLowerCase().includes(q);
        const inContent = note.content.toLowerCase().includes(q);
        const inChapter = note.chapter && note.chapter.toLowerCase().includes(q);
        const subject = findSubject(note.subjectId);
        const inSubject = subject && subject.name.toLowerCase().includes(q);
        return inTitle || inContent || inChapter || inSubject;
    });
}

noteSearch.addEventListener("input", () => {
    renderNotes(filterNotes(noteSearch.value));
});

// ============================================================
//  HELPERS
// ============================================================
function stripHtml(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html || "";
    return tmp.textContent || tmp.innerText || "";
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
    const text  = stripHtml(content);
    const lines = text.split("\n");
    const body  = lines.slice(1).join(" ").trim();

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
    deleteBtn.addEventListener("click", event => {
        event.stopPropagation();

        const confirmed = confirm(
            `Delete "${note.title}"?\n\nThis cannot be undone.`
        );
        if (!confirmed) return;

        notes = notes.filter(item => item.id !== note.id);

        if (currentNote && currentNote.id === note.id) {
            currentNote = notes[0] || null;

            if (currentNote) {
                noteTitle.textContent  = "📝 " + currentNote.title;
                setEditorContent(currentNote.content);
                syncNoteMetaControls();
            } else {
                noteTitle.textContent  = "📝 No Note Selected";
                setEditorContent("");
                syncNoteMetaControls();
            }
        }

        saveNotes();
        renderFolders();
        renderNotes(filterNotes(noteSearch.value));
    });

    // ── Select handler ────────────────────────────────────
    noteCard.addEventListener("click", () => {
        currentNote            = note;
        noteTitle.textContent  = "📝 " + note.title;
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

    // Only show notes that belong to the currently selected folder
    const folderNotes = list.filter(note =>
        currentFolder && note.folderId === currentFolder.id
    );

    // ── Empty state ──────────────────────────────────────────
    if (folderNotes.length === 0) {
        const emptyMsg       = document.createElement("p");
        emptyMsg.className   = "note-search-empty";

        const isSearching    = noteSearch.value.trim().length > 0;
        const folderName     = currentFolder ? currentFolder.name : "this folder";
        emptyMsg.textContent = isSearching
            ? `No notes match your search in ${folderName}.`
            : `No notes in ${folderName} yet.\nCreate your first note!`;

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

    // Save content
    currentNote.content = getEditorContent();

    // Derive title from first line of visible text
    const firstLine       = noteEditor.innerText.split("\n")[0].trim();
    currentNote.title     = firstLine || "Untitled Note";
    noteTitle.textContent = "📝 " + currentNote.title;

    // Stamp the edit time
    currentNote.updatedAt = Date.now();

    // Persist and re-render sidebar
    saveNotes();
    renderFolders();
    renderNotes(filterNotes(noteSearch.value));

    // Show the save feedback pill
    showSaveStatus();
});