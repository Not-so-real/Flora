const FLASHCARDS_STORAGE_KEY = "flora-flashcards";
const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

const newFlashcardBtn = document.getElementById("new-flashcard-btn");
const emptyNewFlashcardBtn = document.getElementById("empty-new-flashcard-btn");
const flashcardList = document.getElementById("flashcard-list");
const flashcardResultCount = document.getElementById("flashcard-result-count");
const flashcardSearch = document.getElementById("flashcard-search");
const subjectFilter = document.getElementById("flashcard-subject-filter");
const chapterFilter = document.getElementById("flashcard-chapter-filter");
const clearFiltersBtn = document.getElementById("clear-flashcard-filters");
const filterContext = document.getElementById("flashcard-filter-context");

const flashcardForm = document.getElementById("flashcard-form");
const flashcardIdInput = document.getElementById("flashcard-id");
const subjectSelect = document.getElementById("flashcard-subject-select");
const chapterSelect = document.getElementById("flashcard-chapter-select");
const frontInput = document.getElementById("flashcard-front");
const backInput = document.getElementById("flashcard-back");
const formError = document.getElementById("flashcard-form-error");
const deleteFlashcardBtn = document.getElementById("delete-flashcard-btn");
const editorTitle = document.getElementById("flashcard-editor-title");
const editorEmpty = document.getElementById("flashcard-editor-empty");
const saveStatus = document.getElementById("flashcard-save-status");
const editorHeader = document.getElementById("flashcard-editor-header");
const studyFlashcardsBtn = document.getElementById("study-flashcards-btn");
const studySession = document.getElementById("study-session");
const exitStudyBtn = document.getElementById("exit-study-btn");
const studyCard = document.getElementById("study-card");
const studyCardPosition = document.getElementById("study-card-position");
const studyContextLabel = document.getElementById("study-context-label");
const studyProgressFill = document.getElementById("study-progress-fill");
const studyCardSideLabel = document.getElementById("study-card-side-label");
const studyCardContent = document.getElementById("study-card-content");
const studyCardHint = document.getElementById("study-card-hint");
const studyRatingActions = document.getElementById("study-rating-actions");
const reviewAgainBtn = document.getElementById("review-again-btn");
const knowItBtn = document.getElementById("know-it-btn");
const studySummary = document.getElementById("study-summary");
const summaryTotal = document.getElementById("summary-total");
const summaryKnown = document.getElementById("summary-known");
const summaryReview = document.getElementById("summary-review");
const restartStudyBtn = document.getElementById("restart-study-btn");
const backToEditorBtn = document.getElementById("back-to-editor-btn");

const pageContext = new URLSearchParams(window.location.search);
let activeSubjectFilter = pageContext.get("subject") || "";
let activeChapterFilter = activeSubjectFilter ? (pageContext.get("chapter") || "") : "";
let pendingSubjectId = activeSubjectFilter || localStorage.getItem(CURRENT_SUBJECT_KEY) || "";
let pendingChapterId = activeChapterFilter;

let subjects = loadSubjects();
let flashcards = loadFlashcards();
let currentFlashcardId = null;
let saveStatusTimer = null;
let studyCardIds = [];
let studyIndex = 0;
let studyAnswerRevealed = false;
let studyKnownCount = 0;
let studyReviewCount = 0;

newFlashcardBtn.addEventListener("click", openNewFlashcard);
emptyNewFlashcardBtn.addEventListener("click", openNewFlashcard);
flashcardForm.addEventListener("submit", saveFlashcardFromForm);
deleteFlashcardBtn.addEventListener("click", deleteCurrentFlashcard);
studyFlashcardsBtn.addEventListener("click", startStudySession);
exitStudyBtn.addEventListener("click", exitStudySession);
studyCard.addEventListener("click", revealStudyAnswer);
reviewAgainBtn.addEventListener("click", () => rateStudyCard("review"));
knowItBtn.addEventListener("click", () => rateStudyCard("known"));
restartStudyBtn.addEventListener("click", startStudySession);
backToEditorBtn.addEventListener("click", exitStudySession);

subjectSelect.addEventListener("change", () => {
    renderEditorChapterSelect("", subjectSelect.value);
    if (subjectSelect.value) {
        localStorage.setItem(CURRENT_SUBJECT_KEY, subjectSelect.value);
    }
});

subjectFilter.addEventListener("change", () => {
    activeSubjectFilter = subjectFilter.value;
    activeChapterFilter = "";
    renderFilters();
    syncSelectionToVisibleCards();
    renderFlashcards();
    updateFilterUrl();
});

chapterFilter.addEventListener("change", () => {
    activeChapterFilter = chapterFilter.value;
    renderFilters();
    syncSelectionToVisibleCards();
    renderFlashcards();
    updateFilterUrl();
});

clearFiltersBtn.addEventListener("click", () => {
    activeSubjectFilter = "";
    activeChapterFilter = "";
    renderFilters();
    syncSelectionToVisibleCards();
    renderFlashcards();
    updateFilterUrl();
});

flashcardSearch.addEventListener("input", () => {
    syncSelectionToVisibleCards();
    renderFlashcards();
});

validateContext();
renderFilters();
renderFlashcards();
selectInitialFlashcard();

function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedSubjects = JSON.parse(raw);
        return Array.isArray(storedSubjects) ? storedSubjects : [];
    } catch (error) {
        console.error("Could not load subjects for flashcards:", error);
        return [];
    }
}

function loadFlashcards() {
    const raw = localStorage.getItem(FLASHCARDS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedFlashcards = JSON.parse(raw);
        if (!Array.isArray(storedFlashcards)) return [];

        return storedFlashcards.map(normalizeFlashcard).filter(Boolean);
    } catch (error) {
        console.error("Could not load flashcards:", error);
        return [];
    }
}

function normalizeFlashcard(card) {
    if (!card || typeof card !== "object" || !card.id) return null;

    const subjectId = subjects.some(subject => subject.id === card.subjectId)
        ? String(card.subjectId)
        : "";
    const chapter = findChapter(subjectId, card.chapterId);

    return {
        id: String(card.id),
        front: String(card.front || "").trim(),
        back: String(card.back || "").trim(),
        subjectId,
        chapterId: chapter ? chapter.id : "",
        createdAt: Number(card.createdAt) || Date.now(),
        updatedAt: Number(card.updatedAt) || Date.now(),
        reviewCount: Math.max(0, Number(card.reviewCount) || 0),
        lastReviewedAt: card.lastReviewedAt ? Number(card.lastReviewedAt) : null,
        lastResult: card.lastResult === "known" || card.lastResult === "review"
            ? card.lastResult
            : null
    };
}

function saveFlashcards() {
    try {
        localStorage.setItem(FLASHCARDS_STORAGE_KEY, JSON.stringify(flashcards));
    } catch (error) {
        console.error("Could not save flashcards:", error);
        formError.textContent = "Flora could not save this card in your browser.";
    }
}

function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }

    return `flashcard-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function findSubject(subjectId) {
    return subjects.find(subject => subject.id === subjectId) || null;
}

function findChapter(subjectId, chapterId) {
    const subject = findSubject(subjectId);
    if (!subject || !Array.isArray(subject.chapters)) return null;
    return subject.chapters.find(chapter => chapter.id === chapterId) || null;
}

function validateContext() {
    if (!findSubject(activeSubjectFilter)) {
        activeSubjectFilter = "";
        activeChapterFilter = "";
    }

    if (activeChapterFilter && !findChapter(activeSubjectFilter, activeChapterFilter)) {
        activeChapterFilter = "";
    }

    if (!findSubject(pendingSubjectId)) {
        pendingSubjectId = "";
        pendingChapterId = "";
    }

    if (pendingChapterId && !findChapter(pendingSubjectId, pendingChapterId)) {
        pendingChapterId = "";
    }
}

function getFilteredFlashcards() {
    const query = flashcardSearch.value.trim().toLowerCase();

    return flashcards
        .filter(card => !activeSubjectFilter || card.subjectId === activeSubjectFilter)
        .filter(card => !activeChapterFilter || card.chapterId === activeChapterFilter)
        .filter(card => {
            if (!query) return true;

            const subject = findSubject(card.subjectId);
            const chapter = findChapter(card.subjectId, card.chapterId);
            return card.front.toLowerCase().includes(query) ||
                card.back.toLowerCase().includes(query) ||
                Boolean(subject && subject.name.toLowerCase().includes(query)) ||
                Boolean(chapter && chapter.name.toLowerCase().includes(query));
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderFilters() {
    subjectFilter.innerHTML = "";
    subjectFilter.appendChild(createOption("", "All subjects", !activeSubjectFilter));

    subjects.forEach(subject => {
        subjectFilter.appendChild(createOption(
            subject.id,
            subject.name,
            subject.id === activeSubjectFilter
        ));
    });

    chapterFilter.innerHTML = "";
    chapterFilter.appendChild(createOption("", "All chapters", !activeChapterFilter));

    const subject = findSubject(activeSubjectFilter);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];
    chapters.forEach(chapter => {
        chapterFilter.appendChild(createOption(
            chapter.id,
            chapter.name,
            chapter.id === activeChapterFilter
        ));
    });

    chapterFilter.disabled = !activeSubjectFilter || chapters.length === 0;
    clearFiltersBtn.hidden = !activeSubjectFilter && !activeChapterFilter;

    const chapter = findChapter(activeSubjectFilter, activeChapterFilter);
    filterContext.textContent = subject
        ? `${subject.name}${chapter ? ` / ${chapter.name}` : " / All chapters"}`
        : "Showing flashcards from all subjects";
}

function renderFlashcards() {
    const visibleCards = getFilteredFlashcards();
    flashcardList.innerHTML = "";
    flashcardResultCount.textContent = `${visibleCards.length} ${visibleCards.length === 1 ? "card" : "cards"}`;
    studyFlashcardsBtn.disabled = visibleCards.length === 0;

    if (visibleCards.length === 0) {
        const empty = document.createElement("p");
        empty.className = "flashcard-list-empty";
        empty.textContent = flashcardSearch.value.trim()
            ? "No flashcards match your search."
            : "No flashcards in this view yet.\nCreate your first card above.";
        flashcardList.appendChild(empty);
        return;
    }

    visibleCards.forEach(card => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "flashcard-list-item";
        if (card.id === currentFlashcardId) item.classList.add("active");

        const subject = findSubject(card.subjectId);
        const chapter = findChapter(card.subjectId, card.chapterId);
        const context = [subject && subject.name, chapter && chapter.name].filter(Boolean).join(" / ");

        const contextLabel = document.createElement("small");
        contextLabel.textContent = context || "Unassigned";
        const front = document.createElement("strong");
        front.textContent = card.front || "Untitled flashcard";
        const back = document.createElement("span");
        back.textContent = card.back || "No answer yet";
        const reviewMeta = document.createElement("em");
        reviewMeta.className = "flashcard-review-meta";
        reviewMeta.textContent = card.reviewCount
            ? `Reviewed ${card.reviewCount} ${card.reviewCount === 1 ? "time" : "times"} · ${formatReviewDate(card.lastReviewedAt)}`
            : "Not reviewed yet";

        item.append(contextLabel, front, back, reviewMeta);
        item.addEventListener("click", () => selectFlashcard(card.id));
        flashcardList.appendChild(item);
    });
}

function createOption(value, label, selected = false) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
}

function formatReviewDate(timestamp) {
    if (!timestamp) return "Not reviewed yet";

    const date = new Date(timestamp);
    const today = new Date();
    const isToday = date.toDateString() === today.toDateString();

    return isToday
        ? `Today, ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
        : date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderEditorSubjectSelect(selectedId = "") {
    subjectSelect.innerHTML = "";
    subjectSelect.appendChild(createOption("", subjects.length ? "No subject" : "No subjects available", !selectedId));

    subjects.forEach(subject => {
        subjectSelect.appendChild(createOption(subject.id, subject.name, subject.id === selectedId));
    });
}

function renderEditorChapterSelect(selectedId = "", subjectId = subjectSelect.value) {
    chapterSelect.innerHTML = "";
    const subject = findSubject(subjectId);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];
    const emptyLabel = subjectId
        ? (chapters.length ? "No chapter" : "No chapters available")
        : "Choose a subject first";

    chapterSelect.appendChild(createOption("", emptyLabel, !selectedId));
    chapters.forEach(chapter => {
        chapterSelect.appendChild(createOption(chapter.id, chapter.name, chapter.id === selectedId));
    });
    chapterSelect.disabled = !subjectId || chapters.length === 0;
}

function selectInitialFlashcard() {
    const firstVisible = getFilteredFlashcards()[0];
    if (firstVisible) {
        selectFlashcard(firstVisible.id);
    } else {
        showEmptyEditor();
    }
}

function syncSelectionToVisibleCards() {
    const visibleCards = getFilteredFlashcards();
    if (visibleCards.some(card => card.id === currentFlashcardId)) return;

    if (visibleCards.length) {
        selectFlashcard(visibleCards[0].id);
    } else {
        currentFlashcardId = null;
        showEmptyEditor();
    }
}

function selectFlashcard(cardId) {
    const card = flashcards.find(item => item.id === cardId);
    if (!card) {
        showEmptyEditor();
        return;
    }

    currentFlashcardId = card.id;
    flashcardIdInput.value = card.id;
    frontInput.value = card.front;
    backInput.value = card.back;
    formError.textContent = "";
    editorTitle.textContent = "Edit flashcard";
    deleteFlashcardBtn.hidden = false;

    renderEditorSubjectSelect(card.subjectId);
    renderEditorChapterSelect(card.chapterId, card.subjectId);
    showEditor();
    renderFlashcards();
}

function openNewFlashcard() {
    currentFlashcardId = null;
    flashcardForm.reset();
    flashcardIdInput.value = "";
    formError.textContent = "";
    editorTitle.textContent = "New flashcard";
    deleteFlashcardBtn.hidden = true;

    const subjectId = activeSubjectFilter || pendingSubjectId;
    const chapterId = activeChapterFilter || pendingChapterId;
    renderEditorSubjectSelect(subjectId);
    renderEditorChapterSelect(chapterId, subjectId);
    showEditor();
    renderFlashcards();
    frontInput.focus();
}

function showEditor() {
    flashcardForm.classList.remove("is-hidden");
    editorEmpty.classList.add("is-hidden");
}

function showEmptyEditor() {
    flashcardForm.classList.add("is-hidden");
    editorEmpty.classList.remove("is-hidden");
    editorTitle.textContent = "Select a flashcard";
    formError.textContent = "";
}

function startStudySession() {
    const visibleCards = getFilteredFlashcards();
    if (!visibleCards.length) return;

    studyCardIds = visibleCards.map(card => card.id);
    studyIndex = 0;
    studyAnswerRevealed = false;
    studyKnownCount = 0;
    studyReviewCount = 0;

    editorHeader.classList.add("is-hidden");
    flashcardForm.classList.add("is-hidden");
    editorEmpty.classList.add("is-hidden");
    studySummary.classList.add("is-hidden");
    studySession.classList.remove("is-hidden");
    renderStudyCard();
}

function renderStudyCard() {
    const card = getCurrentStudyCard();
    if (!card) {
        finishStudySession();
        return;
    }

    const subject = findSubject(card.subjectId);
    const chapter = findChapter(card.subjectId, card.chapterId);
    const context = [subject && subject.name, chapter && chapter.name].filter(Boolean).join(" / ");
    const progress = Math.round((studyIndex / studyCardIds.length) * 100);

    studyAnswerRevealed = false;
    studyCard.classList.remove("is-revealed");
    studyCardPosition.textContent = `Card ${studyIndex + 1} of ${studyCardIds.length}`;
    studyContextLabel.textContent = context || "Unassigned flashcard";
    studyProgressFill.style.width = `${progress}%`;
    studyCardSideLabel.textContent = "Question";
    studyCardContent.textContent = card.front;
    studyCardHint.textContent = "Click to reveal the answer";
    studyRatingActions.classList.add("is-hidden");
}

function getCurrentStudyCard() {
    const cardId = studyCardIds[studyIndex];
    return flashcards.find(card => card.id === cardId) || null;
}

function revealStudyAnswer() {
    if (studyAnswerRevealed) return;

    const card = getCurrentStudyCard();
    if (!card) return;

    studyAnswerRevealed = true;
    studyCard.classList.add("is-revealed");
    studyCardSideLabel.textContent = "Answer";
    studyCardContent.textContent = card.back;
    studyCardHint.textContent = "How well did you know this card?";
    studyRatingActions.classList.remove("is-hidden");
}

function rateStudyCard(result) {
    if (!studyAnswerRevealed) return;

    const card = getCurrentStudyCard();
    if (!card) return;

    card.reviewCount += 1;
    card.lastReviewedAt = Date.now();
    card.lastResult = result;

    if (result === "known") {
        studyKnownCount += 1;
    } else {
        studyReviewCount += 1;
    }

    saveFlashcards();
    studyIndex += 1;
    renderFlashcards();

    if (studyIndex >= studyCardIds.length) {
        finishStudySession();
    } else {
        renderStudyCard();
    }
}

function finishStudySession() {
    studySession.classList.add("is-hidden");
    studySummary.classList.remove("is-hidden");
    summaryTotal.textContent = String(studyCardIds.length);
    summaryKnown.textContent = String(studyKnownCount);
    summaryReview.textContent = String(studyReviewCount);
}

function exitStudySession() {
    studySession.classList.add("is-hidden");
    studySummary.classList.add("is-hidden");
    editorHeader.classList.remove("is-hidden");

    if (currentFlashcardId && flashcards.some(card => card.id === currentFlashcardId)) {
        selectFlashcard(currentFlashcardId);
    } else {
        showEmptyEditor();
    }
}

function saveFlashcardFromForm(event) {
    event.preventDefault();

    const front = frontInput.value.trim();
    const back = backInput.value.trim();
    const subjectId = subjectSelect.value;
    const chapterId = chapterSelect.value;

    if (!front || !back) {
        formError.textContent = "Add both a question and an answer.";
        (!front ? frontInput : backInput).focus();
        return;
    }

    const now = Date.now();
    const existingId = flashcardIdInput.value;

    if (existingId) {
        const card = flashcards.find(item => item.id === existingId);
        if (!card) return;

        card.front = front;
        card.back = back;
        card.subjectId = subjectId;
        card.chapterId = findChapter(subjectId, chapterId) ? chapterId : "";
        card.updatedAt = now;
        currentFlashcardId = card.id;
    } else {
        const card = {
            id: createId(),
            front,
            back,
            subjectId,
            chapterId: findChapter(subjectId, chapterId) ? chapterId : "",
            createdAt: now,
            updatedAt: now,
            reviewCount: 0,
            lastReviewedAt: null,
            lastResult: null
        };

        flashcards.push(card);
        currentFlashcardId = card.id;
        flashcardIdInput.value = card.id;
        deleteFlashcardBtn.hidden = false;
        editorTitle.textContent = "Edit flashcard";
    }

    if (subjectId) {
        localStorage.setItem(CURRENT_SUBJECT_KEY, subjectId);
    }

    formError.textContent = "";
    saveFlashcards();
    showSavedStatus();

    if (getFilteredFlashcards().some(card => card.id === currentFlashcardId)) {
        renderFlashcards();
    } else {
        syncSelectionToVisibleCards();
    }
}

function deleteCurrentFlashcard() {
    const card = flashcards.find(item => item.id === currentFlashcardId);
    if (!card) return;

    const confirmed = confirm(`Delete this flashcard?\n\n"${card.front}"\n\nThis cannot be undone.`);
    if (!confirmed) return;

    flashcards = flashcards.filter(item => item.id !== card.id);
    currentFlashcardId = null;
    saveFlashcards();
    renderFlashcards();
    syncSelectionToVisibleCards();
}

function showSavedStatus() {
    clearTimeout(saveStatusTimer);
    saveStatus.textContent = "Saved";
    saveStatus.className = "flashcard-save-status saved";
    saveStatusTimer = setTimeout(() => {
        saveStatus.className = "flashcard-save-status hidden";
    }, 1800);
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