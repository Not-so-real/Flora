const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

const subjectsGrid = document.getElementById("subjects-grid");
const newSubjectBtn = document.getElementById("new-subject-btn");
const subjectDialog = document.getElementById("subject-dialog");
const subjectForm = document.getElementById("subject-form");
const subjectDialogTitle = document.getElementById("subject-dialog-title");
const subjectDialogClose = document.getElementById("subject-dialog-close");
const subjectCancelBtn = document.getElementById("subject-cancel-btn");
const subjectSaveBtn = document.getElementById("subject-save-btn");
const subjectIdInput = document.getElementById("subject-id");
const subjectNameInput = document.getElementById("subject-name");
const subjectDescriptionInput = document.getElementById("subject-description");
const subjectFormError = document.getElementById("subject-form-error");

let subjects = []; // Now loaded from Cloud
let unsubscribeSubjects = null;

newSubjectBtn.addEventListener("click", () => openSubjectDialog());

// ── 1. Handle Auth State for Database ────────────────────────
firebase.auth().onAuthStateChanged(user => {
    if (user) {
        startSyncingSubjects();
    } else {
        if (unsubscribeSubjects) unsubscribeSubjects();
        subjects = [];
        renderSubjects();
    }
});

function startSyncingSubjects() {
    // 1. Initial check: move local data to cloud once if it exists
    const local = loadSubjectsFromLocal();
    if (local.length > 0) {
        console.log("Migrating local subjects to cloud...");
        local.forEach(s => saveToCloud("subjects", s));
        localStorage.removeItem(SUBJECTS_STORAGE_KEY);
    }

    // 2. Set up live listener
    if (unsubscribeSubjects) unsubscribeSubjects();
    unsubscribeSubjects = onCloudUpdate("subjects", (cloudItems) => {
        subjects = cloudItems.map(normalizeSubject).filter(Boolean);
        renderSubjects();
        updateContinueStudyLink();
    });
}

function loadSubjectsFromLocal() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    try {
        return raw ? JSON.parse(raw) : [];
    } catch(e) { return []; }
}
subjectDialogClose.addEventListener("click", closeSubjectDialog);
subjectCancelBtn.addEventListener("click", closeSubjectDialog);
subjectForm.addEventListener("submit", saveSubjectFromForm);

subjectDialog.addEventListener("click", event => {
    if (event.target === subjectDialog) {
        closeSubjectDialog();
    }
});

renderSubjects();
updateContinueStudyLink();

function updateContinueStudyLink() {
    const continueBtn = document.getElementById("continue-study-btn");
    const card = document.getElementById("continue-study-card");
    if (!continueBtn || !card) return;

    const subjectName = document.getElementById("continue-subject-name");
    const topic = document.getElementById("continue-topic");
    const chapterLabel = document.getElementById("continue-chapter");
    const progressPercent = document.getElementById("continue-progress-percent");
    const progressFill = document.getElementById("continue-progress-fill");
    const chaptersRemaining = document.getElementById("continue-chapters-remaining");
    const lastStudied = document.getElementById("continue-last-studied");

    if (!subjects.length) {
        subjectName.textContent = "No subject selected";
        topic.textContent = "Create your first subject";
        chapterLabel.textContent = "Your next study session starts here.";
        progressPercent.textContent = "0%";
        progressFill.style.width = "0%";
        chaptersRemaining.textContent = "No chapters yet";
        lastStudied.textContent = "Add a subject below to begin";
        continueBtn.textContent = "Create a Subject";
        continueBtn.href = "#subjects";
        return;
    }

    const currentId = localStorage.getItem(CURRENT_SUBJECT_KEY);
    const subject = subjects.find(item => item.id === currentId) || subjects[0];
    updateSubjectStats(subject);

    const currentChapter = findCurrentChapter(subject);
    const progress = computeSubjectProgress(subject);
    const remaining = subject.totalChapters - subject.completedChapters;

    subjectName.textContent = subject.name;
    topic.textContent = subject.currentTopic || subject.name;
    chapterLabel.textContent = currentChapter ? currentChapter.name : "No chapters added yet";
    progressPercent.textContent = `${progress}%`;
    progressFill.style.width = `${progress}%`;
    chaptersRemaining.textContent = subject.totalChapters
        ? `${remaining} ${remaining === 1 ? "Chapter" : "Chapters"} Remaining`
        : "Add your first chapter";
    lastStudied.textContent = `Last Updated • ${formatUpdatedDate(subject.updatedAt)}`;
    continueBtn.textContent = subject.totalChapters ? "Continue Studying ->" : "Open Subject ->";
    continueBtn.href = `subject.html?id=${encodeURIComponent(subject.id)}`;
}

function formatUpdatedDate(timestamp) {
    const date = new Date(Number(timestamp) || Date.now());
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    if (isToday) {
        return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }

    return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);

    if (raw !== null) {
        try {
            const storedSubjects = JSON.parse(raw);
            if (Array.isArray(storedSubjects)) {
                return storedSubjects.map(normalizeSubject).filter(Boolean);
            }
        } catch (error) {
            console.error("Could not load subjects:", error);
        }
    }

    // No demo data — new users start with an empty subject list
    return [];
}

function normalizeSubject(subject) {
    if (!subject || typeof subject !== "object" || !subject.id || !subject.name) {
        return null;
    }

    const id = String(subject.id);
    let chapters = Array.isArray(subject.chapters)
        ? subject.chapters.map(normalizeChapter).filter(Boolean)
        : [];

    // Migrate old subjects that had hardcoded chapter counts but no chapter list
    if (chapters.length === 0 && subject.totalChapters > 0) {
        chapters = migrateLegacyChapters(subject);
    }

    return {
        id,
        name: String(subject.name).trim(),
        description: String(subject.description || "").trim(),
        chapters,
        completedChapters: countCompletedChapters(chapters),
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
    const chapters = [];
    const legacyNames = [
        "Arrays and Strings",
        "Linked Lists",
        "Stacks and Queues",
        "Trees",
        "Graphs",
        "Hash Tables",
        "Heaps",
        "Sorting Algorithms",
        "Searching Algorithms",
        "Dynamic Programming",
        "Greedy Algorithms",
        "Recursion",
        "Bit Manipulation",
        "Object-Oriented Design",
        "System Design Basics",
        "Databases",
        "Networking Basics",
        "Operating Systems Basics"
    ];

    for (let i = 0; i < total; i++) {
        chapters.push({
            id: `chapter-${i + 1}`,
            name: legacyNames[i] || `Chapter ${i + 1}`,
            description: "",
            completed: i < completed,
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    }

    return chapters;
}

function countCompletedChapters(chapters) {
    return chapters.filter(chapter => chapter.completed).length;
}

function computeSubjectProgress(subject) {
    if (!subject.totalChapters) return 0;
    return Math.min(100, Math.round((subject.completedChapters / subject.totalChapters) * 100));
}

function findCurrentChapter(subject) {
    if (!subject.chapters || subject.chapters.length === 0) return null;

    const firstIncomplete = subject.chapters.find(chapter => !chapter.completed);
    return firstIncomplete || subject.chapters[subject.chapters.length - 1];
}

function updateSubjectStats(subject) {
    if (!Array.isArray(subject.chapters)) {
        subject.chapters = [];
    }

    subject.completedChapters = countCompletedChapters(subject.chapters);
    subject.totalChapters = subject.chapters.length;

    const current = findCurrentChapter(subject);
    if (current) {
        subject.currentTopic = subject.name;
        subject.currentChapter = current.name;
    } else {
        subject.currentChapter = "";
    }
}

function saveSubjects() {
    // Legacy helper - cloud handles this now via saveToCloud
}

function createSubjectId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `subject-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function openSubjectDialog(subject = null) {
    subjectForm.reset();
    subjectFormError.textContent = "";
    subjectIdInput.value = subject ? subject.id : "";
    subjectNameInput.value = subject ? subject.name : "";
    subjectDescriptionInput.value = subject ? subject.description : "";
    subjectDialogTitle.textContent = subject ? "Rename subject" : "Create a subject";
    subjectSaveBtn.textContent = subject ? "Save Changes" : "Create Subject";

    subjectDialog.showModal();
    subjectNameInput.focus();
}

function closeSubjectDialog() {
    subjectDialog.close();
    subjectFormError.textContent = "";
}

function saveSubjectFromForm(event) {
    event.preventDefault();

    const id = subjectIdInput.value;
    const name = subjectNameInput.value.trim();
    const description = subjectDescriptionInput.value.trim();

    if (!name) {
        subjectFormError.textContent = "Enter a subject name.";
        subjectNameInput.focus();
        return;
    }

    const duplicate = subjects.some(subject =>
        subject.id !== id && subject.name.toLowerCase() === name.toLowerCase()
    );

    if (duplicate) {
        subjectFormError.textContent = "A subject with this name already exists.";
        subjectNameInput.focus();
        return;
    }

    let subjectData;

    if (id) {
        const existing = subjects.find(item => item.id === id);
        if (!existing) return;

        subjectData = {
            ...existing,
            name: name,
            description: description
        };
    } else {
        subjectData = {
            id: createSubjectId(),
            name,
            description,
            chapters: [],
            completedChapters: 0,
            totalChapters: 0,
            currentTopic: "",
            currentChapter: "",
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
    }

    saveToCloud("subjects", subjectData)
        .then(() => {
            closeSubjectDialog();
            // renderSubjects will be called automatically by the onCloudUpdate listener
        })
        .catch(err => {
            console.error("Save failed:", err);
            subjectFormError.textContent = "Could not sync with cloud. Try again.";
        });
}

function deleteSubject(subject) {
    const confirmed = confirm(
        `Delete "${subject.name}"?\n\nThis removes the subject from your dashboard. This cannot be undone.`
    );

    if (!confirmed) return;

    deleteFromCloud("subjects", subject.id)
        .then(() => {
            if (localStorage.getItem(CURRENT_SUBJECT_KEY) === subject.id) {
                localStorage.removeItem(CURRENT_SUBJECT_KEY);
            }
            // UI updates automatically via listener
        })
        .catch(err => {
            console.error("Delete failed:", err);
            alert("Could not delete from cloud. Try again.");
        });
}

function getProgress(subject) {
    return computeSubjectProgress(subject);
}

function renderSubjects() {
    subjectsGrid.innerHTML = "";

    if (subjects.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "subjects-empty-state";

        const heading = document.createElement("h3");
        heading.textContent = "No subjects yet";

        const message = document.createElement("p");
        message.textContent = "Create your first subject to begin organizing your study material.";

        const button = document.createElement("button");
        button.type = "button";
        button.className = "primary-btn";
        button.textContent = "Create Subject";
        button.addEventListener("click", () => openSubjectDialog());

        emptyState.append(heading, message, button);
        subjectsGrid.appendChild(emptyState);
        return;
    }

    subjects.forEach(subject => {
        updateSubjectStats(subject);
        const progress = getProgress(subject);
        const card = document.createElement("article");
        card.className = "card subject-card";

        const badge = document.createElement("span");
        badge.className = "subject-badge";
        badge.textContent = subject.name;

        const description = document.createElement("p");
        description.className = "subject-description";
        description.textContent = subject.description || "No description yet.";

        const progressSection = document.createElement("div");
        progressSection.className = "subject-progress-section";

        const progressHeader = document.createElement("div");
        progressHeader.className = "progress-header";
        const progressLabel = document.createElement("span");
        progressLabel.textContent = "Progress";
        const progressPercent = document.createElement("span");
        progressPercent.className = "progress-percent";
        progressPercent.textContent = `${progress}%`;
        progressHeader.append(progressLabel, progressPercent);

        const progressBar = document.createElement("div");
        progressBar.className = "progress-bar";
        const progressFill = document.createElement("div");
        progressFill.className = "progress-fill";
        progressFill.style.width = `${progress}%`;
        progressBar.appendChild(progressFill);
        progressSection.append(progressHeader, progressBar);

        const chapters = document.createElement("p");
        chapters.className = "chapters-completed";
        chapters.textContent = subject.totalChapters
            ? `${subject.completedChapters} / ${subject.totalChapters} Chapters Completed`
            : "No chapters added yet";

        const footer = document.createElement("div");
        footer.className = "subject-footer";

        const openLink = document.createElement("a");
        openLink.className = "open-subject";
        openLink.href = `subject.html?id=${encodeURIComponent(subject.id)}`;
        openLink.textContent = "Open Subject ->";
        openLink.addEventListener("click", () => {
            localStorage.setItem(CURRENT_SUBJECT_KEY, subject.id);
        });

        const actions = document.createElement("div");
        actions.className = "subject-actions";

        const renameButton = document.createElement("button");
        renameButton.type = "button";
        renameButton.className = "subject-action-btn";
        renameButton.textContent = "Rename";
        renameButton.addEventListener("click", () => openSubjectDialog(subject));

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "subject-action-btn danger";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteSubject(subject));

        actions.append(renameButton, deleteButton);
        footer.append(openLink, actions);
        card.append(badge, description, progressSection, chapters, footer);
        subjectsGrid.appendChild(card);
    });

    saveSubjects();
}