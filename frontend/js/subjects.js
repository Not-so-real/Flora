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

let subjects = loadSubjects();

newSubjectBtn.addEventListener("click", () => openSubjectDialog());
subjectDialogClose.addEventListener("click", closeSubjectDialog);
subjectCancelBtn.addEventListener("click", closeSubjectDialog);
subjectForm.addEventListener("submit", saveSubjectFromForm);

subjectDialog.addEventListener("click", event => {
    if (event.target === subjectDialog) {
        closeSubjectDialog();
    }
});

renderSubjects();

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

    const starterSubject = {
        id: "computer-science",
        name: "Computer Science",
        description: "Data structures, algorithms, and programming fundamentals.",
        completedChapters: 14,
        totalChapters: 18,
        currentTopic: "Data Structures",
        currentChapter: "Chapter 4: Trees",
        createdAt: Date.now(),
        updatedAt: Date.now()
    };

    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify([starterSubject]));
    return [starterSubject];
}

function normalizeSubject(subject) {
    if (!subject || typeof subject !== "object" || !subject.id || !subject.name) {
        return null;
    }

    const id = String(subject.id);

    return {
        id,
        name: String(subject.name).trim(),
        description: String(subject.description || "").trim(),
        completedChapters: Math.max(0, Number(subject.completedChapters) || 0),
        totalChapters: Math.max(0, Number(subject.totalChapters) || 0),
        currentTopic: String(subject.currentTopic || (id === "computer-science" ? "Data Structures" : "")).trim(),
        currentChapter: String(subject.currentChapter || (id === "computer-science" ? "Chapter 4: Trees" : "")).trim(),
        createdAt: Number(subject.createdAt) || Date.now(),
        updatedAt: Number(subject.updatedAt) || Date.now()
    };
}

function saveSubjects() {
    localStorage.setItem(SUBJECTS_STORAGE_KEY, JSON.stringify(subjects));
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

    if (id) {
        const subject = subjects.find(item => item.id === id);
        if (!subject) return;

        subject.name = name;
        subject.description = description;
        subject.updatedAt = Date.now();
    } else {
        subjects.push({
            id: createSubjectId(),
            name,
            description,
            completedChapters: 0,
            totalChapters: 0,
            currentTopic: "",
            currentChapter: "",
            createdAt: Date.now(),
            updatedAt: Date.now()
        });
    }

    saveSubjects();
    closeSubjectDialog();
    renderSubjects();
}

function deleteSubject(subject) {
    const confirmed = confirm(
        `Delete "${subject.name}"?\n\nThis removes the subject from your dashboard. This cannot be undone.`
    );

    if (!confirmed) return;

    subjects = subjects.filter(item => item.id !== subject.id);

    if (localStorage.getItem(CURRENT_SUBJECT_KEY) === subject.id) {
        localStorage.removeItem(CURRENT_SUBJECT_KEY);
    }

    saveSubjects();
    renderSubjects();
}

function getProgress(subject) {
    if (!subject.totalChapters) return 0;
    return Math.min(100, Math.round((subject.completedChapters / subject.totalChapters) * 100));
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
}