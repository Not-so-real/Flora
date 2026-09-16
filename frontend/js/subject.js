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
const recentChaptersList = document.getElementById("recent-chapters-list");

const subjects = loadSubjects();
const queryId = new URLSearchParams(window.location.search).get("id");
const storedId = localStorage.getItem(CURRENT_SUBJECT_KEY);
const requestedId = queryId || storedId;
const subject = subjects.find(item => item.id === requestedId) || subjects[0];

if (subject) {
    const completedChapters = Math.max(0, Number(subject.completedChapters) || 0);
    const totalChapters = Math.max(0, Number(subject.totalChapters) || 0);
    const isStarterSubject = subject.id === "computer-science";
    const currentTopic = subject.currentTopic || (isStarterSubject ? "Data Structures" : "");
    const currentChapter = subject.currentChapter || (isStarterSubject ? "Chapter 4: Trees" : "");
    const progress = totalChapters
        ? Math.min(100, Math.round((completedChapters / totalChapters) * 100))
        : 0;

    subjectHeading.textContent = subject.name;
    subjectBadge.textContent = subject.name;
    subjectIntro.textContent = subject.description || "Choose where you want to continue your study session.";
    subjectCurrentTopic.textContent = currentTopic || subject.name;
    subjectCurrentChapter.textContent = currentChapter || "No chapter selected yet";
    progressLabels.forEach(label => {
        label.textContent = `${progress}%`;
    });
    progressFills.forEach(fill => {
        fill.style.width = `${progress}%`;
    });
    progressSummary.textContent = totalChapters
        ? `${completedChapters} of ${totalChapters} chapters completed.`
        : "No chapters have been added yet.";

    if (!currentChapter) {
        recentChaptersList.innerHTML = "";
        const emptyMessage = document.createElement("p");
        emptyMessage.className = "chapter-empty-state";
        emptyMessage.textContent = "No recent chapters yet. Chapter management is the next step.";
        recentChaptersList.appendChild(emptyMessage);
    }

    document.title = `Flora | ${subject.name}`;
    localStorage.setItem(CURRENT_SUBJECT_KEY, subject.id);
} else {
    subjectHeading.textContent = "Subject not found";
    subjectBadge.textContent = "No subject selected";
    document.title = "Flora | Subject not found";
}

function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedSubjects = JSON.parse(raw);
        return Array.isArray(storedSubjects) ? storedSubjects : [];
    } catch (error) {
        console.error("Could not load subjects:", error);
        return [];
    }
}