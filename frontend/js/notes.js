const newNoteBtn = document.getElementById("new-note-btn");

const notesList = document.getElementById("notes-list");

const noteTitle = document.getElementById("note-title");

const noteEditor = document.getElementById("note-editor");

console.log(newNoteBtn);

console.log(notesList);

console.log(noteTitle);

console.log(noteEditor);

let notes = [];
newNoteBtn.addEventListener("click", createNote);
function createNote() {

    const note = {

        id: Date.now(),

        title: "Untitled Note",

        content: ""

    };

    notes.push(note);

    currentNote = note;

    renderNotes();

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
            <h3>📝 ${note.title}</h3>
            <p>New Note</p>
        `;
        

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

    renderNotes();

});
