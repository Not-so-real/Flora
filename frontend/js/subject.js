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

let subjects = loadSubjects();
let currentSubject = getCurrentSubject();

newChapterBtn.addEventListener("click", () => openChapterDialog());
chapterDialogClose.addEventListener("click", closeChapterDialog);
chapterCancelBtn.addEventListener("click", closeChapterDialog);
chapterForm.addEventListener("submit", saveChapterFromForm);

chapterDialog.addEventListener("click", event => {
    if (event.target === chapterDialog) {
        closeChapterDialog();
    }
});

renderSubject();

function getCurrentSubject() {
    const queryId = new URLSearchParams(window.location.search).get("id");
    const storedId = localStorage.getItem(CURRENT_SUBJECT_KEY);
    const requestedId = queryId || storedId;
    const subject = subjects.find(item => item.id === requestedId);

    if (subject) {
        localStorage.setItem(CURRENT_SUBJECT_KEY, subject.id);
        return subject;
    }

    return subjects[0] || null;
}

function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedSubjects = JSON.parse(raw);
        if (!Array.isArray(storedSubjects)) return [];

        return storedSubjects.map(normalizeSubject).filter(Boolean);
    } catch (error) {
        console.error("Could not load subjects:", error);
        return [];
    }
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
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(subjects));
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
        document.title = "Flora | Subject not found";
        chaptersList.innerHTML = "";
        return;
    }

    updateSubjectStats(currentSubject);
    saveSubjects();

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
    subjectNotesLink.href = subjectNotesUrl;
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
        notesLink.textContent = "Notes";

        actions.append(notesLink, toggleButton, editButton, deleteButton);
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

    updateSubjectStats(currentSubject);
    currentSubject.updatedAt = Date.now();
    saveSubjects();
    closeChapterDialog();
    renderSubject();
}

function toggleChapterCompletion(chapter) {
    chapter.completed = !chapter.completed;
    chapter.updatedAt = Date.now();
    updateSubjectStats(currentSubject);
    currentSubject.updatedAt = Date.now();
    saveSubjects();
    renderSubject();
}

function deleteChapter(chapter) {
    const confirmed = confirm(
        `Delete "${chapter.name}"?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    currentSubject.chapters = currentSubject.chapters.filter(c => c.id !== chapter.id);
    updateSubjectStats(currentSubject);
    currentSubject.updatedAt = Date.now();
    saveSubjects();
    renderSubject();
}
