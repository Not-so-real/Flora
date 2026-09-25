const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

const subjectHeading = document.getElementById("subject-heading");
const subjectBadge = document.getElementById("subject-badge");
const subjectIntro = document.getElementById("subject-intro");
const subjectCurrentTopic = document.getElementById("subject-current-topic");
const subjectCurrentChapter = document.getElementById("subject-current-chapter");
const progressLabels = document.querySelectorAll("[data-subject-progress]");
const progressFills = document.querySelectorAll("[data-subject-progress-fill]");
const progressSummary = document.getElementById("subject-progress-summary");
const chaptersList = document.getElementById("chapters-list");
const currentChapterNotesLink = document.getElementById("current-chapter-notes-link");
const subjectNotesLink = document.getElementById("subject-notes-link");
const subjectNoteCount = document.getElementById("subject-note-count");
const subjectFlashcardsLink = document.getElementById("subject-flashcards-link");
const subjectFlashcardCount = document.getElementById("subject-flashcard-count");
const subjectQuizzesLink = document.getElementById("subject-quizzes-link");
const subjectQuizCount = document.getElementById("subject-quiz-count");
const subjectResourcesLink = document.getElementById("subject-resources-link");
const subjectResourceCount = document.getElementById("subject-resource-count");

const chapterDialog = document.getElementById("chapter-dialog");
const chapterForm = document.getElementById("chapter-form");
const chapterDialogTitle = document.getElementById("chapter-dialog-title");
const chapterDialogClose = document.getElementById("chapter-dialog-close");
const chapterCancelBtn = document.getElementById("chapter-cancel-btn");
const chapterSaveBtn = document.getElementById("chapter-save-btn");
const chapterIdInput = document.getElementById("chapter-id");
const chapterNameInput = document.getElementById("chapter-name");
const chapterDescriptionInput = document.getElementById("chapter-description");
const chapterCompletedInput = document.getElementById("chapter-completed");
const chapterFormError = document.getElementById("chapter-form-error");
const newChapterBtn = document.getElementById("new-chapter-btn");

let subjects = [];
let currentSubject = null;
let notes = [];
let flashcards = [];
let quizzes = [];
let studyResources = [];
let unsubSubjectsPage = null;
let unsubNotesPage = null;
let unsubFlashcardsPage = null;
let unsubQuizzesPage = null;
let unsubResourcesPage = null;

newChapterBtn.addEventListener("click", () => openChapterDialog());
chapterDialogClose.addEventListener("click", closeChapterDialog);
chapterCancelBtn.addEventListener("click", closeChapterDialog);
chapterForm.addEventListener("submit", saveChapterFromForm);

chapterDialog.addEventListener("click", event => {
    if (event.target === chapterDialog) {
        closeChapterDialog();
    }
});

// ── Load subject workspace data from Firestore live ──────────
firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "auth.html";
        return;
    }

    if (unsubSubjectsPage) unsubSubjectsPage();
    if (unsubNotesPage) unsubNotesPage();
    if (unsubFlashcardsPage) unsubFlashcardsPage();
    if (unsubQuizzesPage) unsubQuizzesPage();
    if (unsubResourcesPage) unsubResourcesPage();

    const resolveCurrentSubject = () => {
        const queryId = new URLSearchParams(window.location.search).get("id");
        const storedId = localStorage.getItem(CURRENT_SUBJECT_KEY);
        const requestedId = queryId || storedId;

        currentSubject = subjects.find(s => s.id === requestedId) || subjects[0] || null;

        if (currentSubject) {
            localStorage.setItem(CURRENT_SUBJECT_KEY, currentSubject.id);
        }

        renderSubject();
    };

    unsubSubjectsPage = onCloudUpdate("subjects", cloudSubjects => {
        subjects = cloudSubjects.map(normalizeSubject).filter(Boolean);
        resolveCurrentSubject();
    });

    unsubNotesPage = onCloudUpdate("notes", cloudNotes => {
        notes = Array.isArray(cloudNotes) ? cloudNotes : [];
        if (currentSubject) renderSubject();
    });

    unsubFlashcardsPage = onCloudUpdate("flashcards", cloudFlashcards => {
        flashcards = Array.isArray(cloudFlashcards) ? cloudFlashcards : [];
        if (currentSubject) renderSubject();
    });

    unsubQuizzesPage = onCloudUpdate("quizzes", cloudQuizzes => {
        quizzes = Array.isArray(cloudQuizzes) ? cloudQuizzes : [];
        if (currentSubject) renderSubject();
    });

    unsubResourcesPage = onCloudUpdate("resources", cloudResources => {
        studyResources = Array.isArray(cloudResources) ? cloudResources : [];
        if (currentSubject) renderSubject();
    });
});

// getCurrentSubject is now handled inline in the auth listener above.


function countSubjectNotes(subjectId) {
    return notes.filter(note => note.subjectId === subjectId).length;
}

function countChapterNotes(subjectId, chapter) {
    return notes.filter(note =>
        note.subjectId === subjectId &&
        (note.chapterId === chapter.id ||
            (!note.chapterId && note.chapter && note.chapter.toLowerCase() === chapter.name.toLowerCase()))
    ).length;
}

function countSubjectFlashcards(subjectId) {
    return flashcards.filter(card => card.subjectId === subjectId).length;
}

function countChapterFlashcards(subjectId, chapterId) {
    return flashcards.filter(card =>
        card.subjectId === subjectId && card.chapterId === chapterId
    ).length;
}

function countSubjectQuizzes(subjectId) {
    return quizzes.filter(quiz => quiz.subjectId === subjectId).length;
}

function countChapterQuizzes(subjectId, chapterId) {
    return quizzes.filter(quiz =>
        quiz.subjectId === subjectId && quiz.chapterId === chapterId
    ).length;
}

function countSubjectResources(subjectId) {
    return studyResources.filter(res => res.subjectId === subjectId).length;
}

function countChapterResources(subjectId, chapterId) {
    return studyResources.filter(res =>
        res.subjectId === subjectId && res.chapterId === chapterId
    ).length;
}

function normalizeSubject(subject) {
    if (!subject || typeof subject !== "object" || !subject.id || !subject.name) {
        return null;
    }

    const id = String(subject.id);
    let chapters = Array.isArray(subject.chapters)
        ? subject.chapters.map(normalizeChapter).filter(Boolean)
        : [];

    if (chapters.length === 0 && (subject.totalChapters > 0 || subject.completedChapters > 0)) {
        chapters = migrateLegacyChapters(subject);
    }

    return {
        id,
        name: String(subject.name).trim(),
        description: String(subject.description || "").trim(),
        chapters,
        completedChapters: chapters.filter(c => c.completed).length,
        totalChapters: chapters.length,
        currentTopic: String(subject.currentTopic || "").trim(),
        currentChapter: String(subject.currentChapter || "").trim(),
        createdAt: Number(subject.createdAt) || Date.now(),
        updatedAt: Number(subject.updatedAt) || Date.now()
    };
}

function normalizeChapter(chapter) {
    if (!chapter || typeof chapter !== "object" || !chapter.id || !chapter.name) {
        return null;
    }

    return {
        id: String(chapter.id),
        name: String(chapter.name).trim(),
        description: String(chapter.description || "").trim(),
        completed: Boolean(chapter.completed),
        createdAt: Number(chapter.createdAt) || Date.now(),
        updatedAt: Number(chapter.updatedAt) || Date.now()
    };
}

function migrateLegacyChapters(subject) {
    const total = Math.max(0, Number(subject.totalChapters) || 0);
    const completed = Math.max(0, Number(subject.completedChapters) || 0);
    const legacyNames = [
        "Arrays and Strings", "Linked Lists", "Stacks and Queues", "Trees",
        "Graphs", "Hash Tables", "Heaps", "Sorting Algorithms",
        "Searching Algorithms", "Dynamic Programming", "Greedy Algorithms",
        "Recursion", "Bit Manipulation", "Object-Oriented Design",
        "System Design Basics", "Databases", "Networking Basics", "Operating Systems Basics"
    ];

    return Array.from({ length: total }, (_, index) => ({
        id: `chapter-${index + 1}`,
        name: legacyNames[index] || `Chapter ${index + 1}`,
        description: "",
        completed: index < completed,
        createdAt: Date.now(),
        updatedAt: Date.now()
    }));
}

function saveSubjects() {
    // Legacy — cloud handles persistence via persistSubject()
}

function persistSubject(subject) {
    updateSubjectStats(subject);
    subject.updatedAt = Date.now();
    return saveToCloud("subjects", subject).catch(err => {
        console.error("Could not save subject to cloud:", err);
        chapterFormError.textContent = "Cloud save failed. Check connection.";
    });
}

function createChapterId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `chapter-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function computeProgress(subject) {
    if (!subject.totalChapters) return 0;
    return Math.min(100, Math.round((subject.completedChapters / subject.totalChapters) * 100));
}

function findCurrentChapter(subject) {
    if (!subject.chapters.length) return null;
    return subject.chapters.find(chapter => !chapter.completed) || subject.chapters[subject.chapters.length - 1];
}

function updateSubjectStats(subject) {
    if (!Array.isArray(subject.chapters)) {
        subject.chapters = [];
    }

    subject.completedChapters = subject.chapters.filter(c => c.completed).length;
    subject.totalChapters = subject.chapters.length;

    const current = findCurrentChapter(subject);
    if (current) {
        subject.currentTopic = subject.name;
        subject.currentChapter = current.name;
    } else if (subject.chapters.length > 0) {
        subject.currentChapter = "All chapters completed";
    } else {
        subject.currentChapter = "";
    }
}

function renderSubject() {
    if (!currentSubject) {
        subjectHeading.textContent = "Subject not found";
        subjectBadge.textContent = "No subject selected";
        subjectIntro.textContent = "Create a subject on the dashboard to begin.";
        document.title = "Flora | Subject not found";
        chaptersList.innerHTML = "";
        progressLabels.forEach(label => label.textContent = "0%");
        progressFills.forEach(fill => fill.style.width = "0%");
        progressSummary.textContent = "No chapters have been added yet.";
        return;
    }

    updateSubjectStats(currentSubject);

    const progress = computeProgress(currentSubject);
    const currentChapter = findCurrentChapter(currentSubject);

    subjectHeading.textContent = currentSubject.name;
    subjectBadge.textContent = currentSubject.name;
    document.title = `Flora | ${currentSubject.name}`;
    subjectIntro.textContent = currentSubject.description || "Choose where you want to continue your study session.";

    subjectCurrentTopic.textContent = currentSubject.name;
    subjectCurrentChapter.textContent = currentChapter
        ? currentChapter.name
        : (currentSubject.chapters.length > 0 ? "All chapters completed" : "No chapters added yet");

    progressLabels.forEach(label => label.textContent = `${progress}%`);
    progressFills.forEach(fill => fill.style.width = `${progress}%`);
    progressSummary.textContent = currentSubject.totalChapters
        ? `${currentSubject.completedChapters} of ${currentSubject.totalChapters} chapters completed.`
        : "No chapters have been added yet.";

    const subjectNotesUrl = `notes.html?subject=${encodeURIComponent(currentSubject.id)}`;
    const subjectFlashcardsUrl = `flashcards.html?subject=${encodeURIComponent(currentSubject.id)}`;
    const subjectQuizzesUrl = `quiz.html?subject=${encodeURIComponent(currentSubject.id)}`;
    subjectNotesLink.href = subjectNotesUrl;
    const totalNotes = countSubjectNotes(currentSubject.id);
    subjectNoteCount.textContent = totalNotes ? `(${totalNotes})` : "";
    subjectFlashcardsLink.href = subjectFlashcardsUrl;
    const totalFlashcards = countSubjectFlashcards(currentSubject.id);
    subjectFlashcardCount.textContent = totalFlashcards ? `(${totalFlashcards})` : "";
    subjectQuizzesLink.href = subjectQuizzesUrl;
    const totalQuizzes = countSubjectQuizzes(currentSubject.id);
    subjectQuizCount.textContent = totalQuizzes ? `(${totalQuizzes})` : "";
    const subjectResourcesUrl = `resources.html?subject=${encodeURIComponent(currentSubject.id)}`;
    subjectResourcesLink.href = subjectResourcesUrl;
    const totalResources = countSubjectResources(currentSubject.id);
    subjectResourceCount.textContent = totalResources ? `(${totalResources})` : "";
    currentChapterNotesLink.href = currentChapter
        ? `${subjectNotesUrl}&chapter=${encodeURIComponent(currentChapter.id)}`
        : subjectNotesUrl;

    renderChapters();
}

function renderChapters() {
    chaptersList.innerHTML = "";

    if (!currentSubject.chapters.length) {
        const emptyState = document.createElement("div");
        emptyState.className = "chapter-empty-state";
        emptyState.innerHTML = `
            <h3>No chapters yet</h3>
            <p>Add your first chapter to start tracking progress.</p>
            <button type="button" class="primary-btn" id="empty-add-chapter-btn">Add Chapter</button>
        `;
        emptyState.querySelector("#empty-add-chapter-btn").addEventListener("click", () => openChapterDialog());
        chaptersList.appendChild(emptyState);
        return;
    }

    currentSubject.chapters.forEach((chapter, index) => {
        const noteCount = countChapterNotes(currentSubject.id, chapter);
        const flashcardCount = countChapterFlashcards(currentSubject.id, chapter.id);
        const quizCount = countChapterQuizzes(currentSubject.id, chapter.id);
        const resourceCount = countChapterResources(currentSubject.id, chapter.id);
        const row = document.createElement("article");
        row.className = `chapter-row ${chapter.completed ? "is-completed" : ""}`;

        const left = document.createElement("div");
        const number = document.createElement("span");
        number.textContent = String(index + 1).padStart(2, "0");
        const text = document.createElement("div");
        const title = document.createElement("h3");
        title.textContent = chapter.name;
        const meta = document.createElement("p");
        meta.textContent = chapter.completed ? "Completed" : (chapter.description || "In progress");

        text.appendChild(title);
        text.appendChild(meta);
        left.appendChild(number);
        left.appendChild(text);

        const actions = document.createElement("div");
        actions.className = "chapter-row-actions";

        const toggleButton = document.createElement("button");
        toggleButton.type = "button";
        toggleButton.className = "chapter-action-btn";
        toggleButton.textContent = chapter.completed ? "Mark incomplete" : "Mark complete";
        toggleButton.addEventListener("click", () => toggleChapterCompletion(chapter));

        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "chapter-action-btn";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => openChapterDialog(chapter));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "chapter-action-btn danger";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteChapter(chapter));

        const notesLink = document.createElement("a");
        notesLink.className = "chapter-action-btn chapter-notes-link";
        notesLink.href = `notes.html?subject=${encodeURIComponent(currentSubject.id)}&chapter=${encodeURIComponent(chapter.id)}`;
        notesLink.textContent = `Notes (${noteCount})`;

        const flashcardsLink = document.createElement("a");
        flashcardsLink.className = "chapter-action-btn chapter-notes-link";
        flashcardsLink.href = `flashcards.html?subject=${encodeURIComponent(currentSubject.id)}&chapter=${encodeURIComponent(chapter.id)}`;
        flashcardsLink.textContent = `Cards (${flashcardCount})`;

        const quizzesLink = document.createElement("a");
        quizzesLink.className = "chapter-action-btn chapter-notes-link";
        quizzesLink.href = `quiz.html?subject=${encodeURIComponent(currentSubject.id)}&chapter=${encodeURIComponent(chapter.id)}`;
        quizzesLink.textContent = `Quizzes (${quizCount})`;

        const resourcesLink = document.createElement("a");
        resourcesLink.className = "chapter-action-btn chapter-notes-link";
        resourcesLink.href = `resources.html?subject=${encodeURIComponent(currentSubject.id)}&chapter=${encodeURIComponent(chapter.id)}`;
        resourcesLink.textContent = `Resources (${resourceCount})`;

        actions.append(notesLink, flashcardsLink, quizzesLink, resourcesLink, toggleButton, editButton, deleteButton);
        row.appendChild(left);
        row.appendChild(actions);
        chaptersList.appendChild(row);
    });
}

function openChapterDialog(chapter = null) {
    chapterForm.reset();
    chapterFormError.textContent = "";
    chapterIdInput.value = chapter ? chapter.id : "";
    chapterNameInput.value = chapter ? chapter.name : "";
    chapterDescriptionInput.value = chapter ? chapter.description : "";
    chapterCompletedInput.checked = chapter ? chapter.completed : false;
    chapterDialogTitle.textContent = chapter ? "Edit chapter" : "Add chapter";
    chapterSaveBtn.textContent = chapter ? "Save Changes" : "Add Chapter";

    chapterDialog.showModal();
    chapterNameInput.focus();
}

function closeChapterDialog() {
    chapterDialog.close();
    chapterFormError.textContent = "";
}

function saveChapterFromForm(event) {
    event.preventDefault();

    const id = chapterIdInput.value;
    const name = chapterNameInput.value.trim();
    const description = chapterDescriptionInput.value.trim();
    const completed = chapterCompletedInput.checked;

    if (!name) {
        chapterFormError.textContent = "Enter a chapter name.";
        chapterNameInput.focus();
        return;
    }

    const duplicate = currentSubject.chapters.some(chapter =>
        chapter.id !== id && chapter.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        chapterFormError.textContent = "A chapter with this name already exists.";
        chapterNameInput.focus();
        return;
    }

    if (id) {
        const chapter = currentSubject.chapters.find(c => c.id === id);
        if (!chapter) return;
        chapter.name = name;
        chapter.description = description;
        chapter.completed = completed;
        chapter.updatedAt = Date.now();
    } else {
        currentSubject.chapters.push({
            id: createChapterId(),
            name,
            description,
            completed,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    }

    persistSubject(currentSubject).then(() => {
        closeChapterDialog();
        renderSubject();
    });
}

function toggleChapterCompletion(chapter) {
    chapter.completed = !chapter.completed;
    chapter.updatedAt = Date.now();
    persistSubject(currentSubject).then(() => renderSubject());
}

async function deleteChapter(chapter) {
    const confirmed = await window.floraConfirm(
        "Delete Chapter?",
        `Delete "${chapter.name}"?\nThis cannot be undone.`
    );
    if (!confirmed) return;

    currentSubject.chapters = currentSubject.chapters.filter(c => c.id !== chapter.id);
    persistSubject(currentSubject).then(() => renderSubject());
}
