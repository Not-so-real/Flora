const newNoteBtn = document.getElementById("new-note-btn");

const notesList = document.getElementById("notes-list");

const noteTitle = document.getElementById("note-title");

const noteEditor = document.getElementById("note-editor");

console.log(newNoteBtn);

console.log(notesList);

console.log(noteTitle);

console.log(noteEditor);

let notes = [];
let currentNote = null;
newNoteBtn.addEventListener("click", createNote);
function createNote() {

    const note = {

        id: Date.now(),

        title: "Untitled Note",

        content: ""

    };

    notes.push(note);

    currentNote = note;

    noteTitle.textContent = "📝 " + note.title;
    noteEditor.value = "";

    saveNotes();

    renderNotes();

}
function saveNotes() {

    localStorage.setItem("flora-notes", JSON.stringify(notes));

}
function loadNotes() {

    const savedNotes = localStorage.getItem("flora-notes");

    if (savedNotes) {

        notes = JSON.parse(savedNotes);

        if (notes.length > 0) {

            currentNote = notes[0];

            noteTitle.textContent = "📝 " + currentNote.title;

            noteEditor.value = currentNote.content;

        }

        renderNotes();

    }

}
function renderNotes() {

    notesList.innerHTML = "";

    notes.forEach(note => {

        const noteCard = document.createElement("div");

        noteCard.className = "note-card";
        if (currentNote && note.id === currentNote.id) {

            noteCard.classList.add("active");

        }
        noteCard.innerHTML = `
    <div class="note-content">

        <h3>📝 ${note.title}</h3>

        <p>${note.content.substring(0, 40) || "Empty note"}</p>

    </div>

    <button class="delete-note-btn" title="Delete note">
        🗑
    </button>
`;
const deleteBtn = noteCard.querySelector(".delete-note-btn");

deleteBtn.addEventListener("click", (event) => {

    event.stopPropagation();

    const confirmed = confirm(
        `Are you sure you want to delete "${note.title}"?`
    );

    if (!confirmed) {
        return;
    }

    notes = notes.filter(item => item.id !== note.id);

    if (currentNote && currentNote.id === note.id) {

        currentNote = notes[0] || null;

        if (currentNote) {

            noteTitle.textContent = "📝 " + currentNote.title;

            noteEditor.value = currentNote.content;

        } else {

            noteTitle.textContent = "📝 No Note Selected";

            noteEditor.value = "";

        }

    }

    saveNotes();

    renderNotes();

});
        

        notesList.appendChild(noteCard);

        noteCard.addEventListener("click", () => {

            currentNote = note;

            noteTitle.textContent = "📝 " + note.title;

            noteEditor.value = note.content;

            renderNotes();

            

        });

    });

}
noteEditor.addEventListener("input", () => {

    if (!currentNote) return;

    currentNote.content = noteEditor.value;

    const firstLine = noteEditor.value
        .split("\n")[0]
        .trim();

    currentNote.title = firstLine || "Untitled Note";

    noteTitle.textContent = "📝 " + currentNote.title;

    saveNotes();

    renderNotes();

});
loadNotes();