// ============================================================
//  Flora — Notes JavaScript
//  Features: Create, Read, Update, Delete, Search,
//            Timestamps, Save Status, Better Previews
// ============================================================

// ── DOM references ───────────────────────────────────────────
const newNoteBtn = document.getElementById("new-note-btn");
const notesList  = document.getElementById("notes-list");
const noteTitle  = document.getElementById("note-title");
const noteEditor = document.getElementById("note-editor");
const noteSearch = document.getElementById("note-search");
const saveStatus = document.getElementById("save-status");

// ── App state ────────────────────────────────────────────────
let notes       = [];
let currentNote = null;
let saveTimer   = null;   // debounce handle for save indicator

// ── Boot ─────────────────────────────────────────────────────
newNoteBtn.addEventListener("click", createNote);
loadNotes();

// ============================================================
//  CREATE
// ============================================================
function createNote() {
    const note = {
        id:        Date.now(),
        title:     "Untitled Note",
        content:   "",
        updatedAt: Date.now()
    };

    notes.push(note);
    currentNote = note;

    noteTitle.textContent = "📝 " + note.title;
    noteEditor.value      = "";

    saveNotes();
    renderNotes();

    // Jump straight into the editor — no extra click needed
    noteEditor.focus();
}

// ============================================================
//  PERSISTENCE
// ============================================================
function loadNotes() {

    const raw = localStorage.getItem("flora-notes");

    if (!raw) {
        renderNotes();
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

        });

    } catch (error) {

        console.error("Could not load notes:", error);

        notes = [];

    }

    if (notes.length > 0) {

        currentNote = notes[0];

        noteTitle.textContent =
            "📝 " + currentNote.title;

        noteEditor.value =
            currentNote.content;

    }

    renderNotes();

}

// ============================================================
//  SAVE STATUS INDICATOR
// ============================================================

/*
 * showSaveStatus()
 *
 * Flow:
 *   1. Immediately shows "Saving…" (grey pill)
 *   2. After 600ms debounce → switches to "Saved ✓" (green pill)
 *   3. After another 2s    → fades out completely
 *
 * The clearTimeout at the top means rapid keystrokes reset
 * the timer each time, so it only fires once typing pauses.
 */
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
//  SEARCH
// ============================================================

/*
 * filterNotes(query)
 * Returns notes whose title or content contains the query.
 * An empty query returns all notes unchanged.
 */
function filterNotes(query) {
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
        note =>
            note.title.toLowerCase().includes(q) ||
            note.content.toLowerCase().includes(q)
    );
}

noteSearch.addEventListener("input", () => {
    renderNotes(filterNotes(noteSearch.value));
});

// ============================================================
//  HELPERS
// ============================================================

/*
 * getPreview(content)
 *
 * Skips the first line (used as title), trims whitespace,
 * returns up to 80 characters with a trailing "…" if cut.
 * Falls back to "No content yet" for empty notes.
 */
function getPreview(content) {
    const lines = content.split("\n");
    const body  = lines.slice(1).join(" ").trim();

    if (!body) return "No content yet";

    return body.length > 80 ? body.substring(0, 80) + "…" : body;
}

/*
 * timeAgo(timestamp)
 *
 * Converts a Unix ms timestamp into a human-readable label:
 * "Just now", "5 minutes ago", "2 hours ago", "Yesterday", etc.
 */
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
function renderNotes(list = notes) {
    notesList.innerHTML = "";

    // ── Empty state ──────────────────────────────────────────
    if (list.length === 0) {
        const emptyMsg       = document.createElement("p");
        emptyMsg.className   = "note-search-empty";

        const isSearching    = noteSearch.value.trim().length > 0;
        emptyMsg.textContent = isSearching
            ? "No notes match your search."
            : "No notes yet.\nCreate your first note above!";

        notesList.appendChild(emptyMsg);
        return;
    }

    // ── Render each note card ─────────────────────────────────
    list.forEach(note => {
        const noteCard    = document.createElement("div");
        noteCard.className = "note-card";

        if (currentNote && note.id === currentNote.id) {
            noteCard.classList.add("active");
        }

        const preview   = getPreview(note.content);
        const timestamp = timeAgo(note.updatedAt);

        noteCard.innerHTML = `
            <div class="note-content">
                <h3>📝 ${note.title}</h3>
                <p class="note-preview">${preview}</p>
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
                    noteTitle.textContent = "📝 " + currentNote.title;
                    noteEditor.value      = currentNote.content;
                } else {
                    noteTitle.textContent = "📝 No Note Selected";
                    noteEditor.value      = "";
                }
            }

            saveNotes();
            renderNotes(filterNotes(noteSearch.value));
        });

        // ── Select handler ────────────────────────────────────
        noteCard.addEventListener("click", () => {
            currentNote           = note;
            noteTitle.textContent = "📝 " + note.title;
            noteEditor.value      = note.content;
            renderNotes(filterNotes(noteSearch.value));
        });

        notesList.appendChild(noteCard);
    });
}

// ============================================================
//  EDITOR — live update on every keystroke
// ============================================================
noteEditor.addEventListener("input", () => {
    if (!currentNote) return;

    // Save content
    currentNote.content = noteEditor.value;

    // Derive title from first line
    const firstLine       = noteEditor.value.split("\n")[0].trim();
    currentNote.title     = firstLine || "Untitled Note";
    noteTitle.textContent = "📝 " + currentNote.title;

    // Stamp the edit time
    currentNote.updatedAt = Date.now();

    // Persist and re-render sidebar
    saveNotes();
    renderNotes(filterNotes(noteSearch.value));

    // Show the save feedback pill
    showSaveStatus();
});
