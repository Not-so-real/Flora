const QUIZZES_STORAGE_KEY = "flora-quizzes";
const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

const newQuizBtn = document.getElementById("new-quiz-btn");
const emptyNewQuizBtn = document.getElementById("empty-new-quiz-btn");
const quizList = document.getElementById("quiz-list");
const quizResultCount = document.getElementById("quiz-result-count");
const quizSearch = document.getElementById("quiz-search");
const subjectFilter = document.getElementById("quiz-subject-filter");
const chapterFilter = document.getElementById("quiz-chapter-filter");
const clearFiltersBtn = document.getElementById("clear-quiz-filters");
const filterContext = document.getElementById("quiz-filter-context");

const quizForm = document.getElementById("quiz-form");
const quizIdInput = document.getElementById("quiz-id");
const subjectSelect = document.getElementById("quiz-subject-select");
const chapterSelect = document.getElementById("quiz-chapter-select");
const quizTitleInput = document.getElementById("quiz-title");
const quizDescriptionInput = document.getElementById("quiz-description");
const questionCount = document.getElementById("question-count");
const questionList = document.getElementById("question-list");
const addQuestionBtn = document.getElementById("add-question-btn");
const quizFormError = document.getElementById("quiz-form-error");
const deleteQuizBtn = document.getElementById("delete-quiz-btn");
const quizEditorTitle = document.getElementById("quiz-editor-title");
const quizEditorEmpty = document.getElementById("quiz-editor-empty");
const quizSaveStatus = document.getElementById("quiz-save-status");

const questionDialog = document.getElementById("question-dialog");
const questionForm = document.getElementById("question-form");
const questionDialogTitle = document.getElementById("question-dialog-title");
const questionDialogClose = document.getElementById("question-dialog-close");
const questionCancelBtn = document.getElementById("question-cancel-btn");
const questionSaveBtn = document.getElementById("question-save-btn");
const questionIdInput = document.getElementById("question-id");
const questionPromptInput = document.getElementById("question-prompt");
const questionOptionInputs = Array.from(document.querySelectorAll(".question-option"));
const correctOptionInputs = Array.from(document.querySelectorAll('input[name="correct-option"]'));
const questionFormError = document.getElementById("question-form-error");

const pageContext = new URLSearchParams(window.location.search);
let activeSubjectFilter = pageContext.get("subject") || "";
let activeChapterFilter = activeSubjectFilter ? (pageContext.get("chapter") || "") : "";
let pendingSubjectId = activeSubjectFilter || localStorage.getItem(CURRENT_SUBJECT_KEY) || "";
let pendingChapterId = activeChapterFilter;

let subjects = loadSubjects();
let quizzes = loadQuizzes();
let currentQuizId = null;
let draftQuestions = [];
let saveStatusTimer = null;

newQuizBtn.addEventListener("click", openNewQuiz);
emptyNewQuizBtn.addEventListener("click", openNewQuiz);
quizForm.addEventListener("submit", saveQuizFromForm);
deleteQuizBtn.addEventListener("click", deleteCurrentQuiz);
addQuestionBtn.addEventListener("click", () => openQuestionDialog());

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
    syncSelectionToVisibleQuizzes();
    renderQuizList();
    updateFilterUrl();
});

chapterFilter.addEventListener("change", () => {
    activeChapterFilter = chapterFilter.value;
    renderFilters();
    syncSelectionToVisibleQuizzes();
    renderQuizList();
    updateFilterUrl();
});

clearFiltersBtn.addEventListener("click", () => {
    activeSubjectFilter = "";
    activeChapterFilter = "";
    renderFilters();
    syncSelectionToVisibleQuizzes();
    renderQuizList();
    updateFilterUrl();
});

quizSearch.addEventListener("input", () => {
    syncSelectionToVisibleQuizzes();
    renderQuizList();
});

questionDialogClose.addEventListener("click", closeQuestionDialog);
questionCancelBtn.addEventListener("click", closeQuestionDialog);
questionForm.addEventListener("submit", saveQuestionFromForm);
questionDialog.addEventListener("click", event => {
    if (event.target === questionDialog) closeQuestionDialog();
});

validateContext();
renderFilters();
renderQuizList();
selectInitialQuiz();

function loadSubjects() {
    const raw = localStorage.getItem(SUBJECTS_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedSubjects = JSON.parse(raw);
        return Array.isArray(storedSubjects) ? storedSubjects : [];
    } catch (error) {
        console.error("Could not load subjects for quizzes:", error);
        return [];
    }
}

function loadQuizzes() {
    const raw = localStorage.getItem(QUIZZES_STORAGE_KEY);
    if (!raw) return [];

    try {
        const storedQuizzes = JSON.parse(raw);
        if (!Array.isArray(storedQuizzes)) return [];
        return storedQuizzes.map(normalizeQuiz).filter(Boolean);
    } catch (error) {
        console.error("Could not load quizzes:", error);
        return [];
    }
}

function normalizeQuiz(quiz) {
    if (!quiz || typeof quiz !== "object" || !quiz.id) return null;

    const subjectId = subjects.some(subject => subject.id === quiz.subjectId)
        ? String(quiz.subjectId)
        : "";
    const chapter = findChapter(subjectId, quiz.chapterId);

    return {
        id: String(quiz.id),
        title: String(quiz.title || "Untitled Quiz").trim(),
        description: String(quiz.description || "").trim(),
        subjectId,
        chapterId: chapter ? chapter.id : "",
        questions: Array.isArray(quiz.questions)
            ? quiz.questions.map(normalizeQuestion).filter(Boolean)
            : [],
        createdAt: Number(quiz.createdAt) || Date.now(),
        updatedAt: Number(quiz.updatedAt) || Date.now(),
        attemptCount: Math.max(0, Number(quiz.attemptCount) || 0),
        lastAttemptAt: quiz.lastAttemptAt ? Number(quiz.lastAttemptAt) : null
    };
}

function normalizeQuestion(question) {
    if (!question || typeof question !== "object" || !question.id) return null;

    const options = Array.isArray(question.options)
        ? question.options.slice(0, 4).map(option => String(option || "").trim())
        : [];

    while (options.length < 4) options.push("");

    return {
        id: String(question.id),
        prompt: String(question.prompt || "").trim(),
        options,
        correctIndex: Math.min(3, Math.max(0, Number(question.correctIndex) || 0))
    };
}

function saveQuizzes() {
    try {
        localStorage.setItem(QUIZZES_STORAGE_KEY, JSON.stringify(quizzes));
        return true;
    } catch (error) {
        console.error("Could not save quizzes:", error);
        quizFormError.textContent = "Flora could not save this quiz in your browser.";
        return false;
    }
}

function createId(prefix) {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
        return window.crypto.randomUUID();
    }
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneQuestions(questions) {
    return questions.map(question => ({
        id: question.id,
        prompt: question.prompt,
        options: [...question.options],
        correctIndex: question.correctIndex
    }));
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

function createOption(value, label, selected = false) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    option.selected = selected;
    return option;
}

function getFilteredQuizzes() {
    const query = quizSearch.value.trim().toLowerCase();

    return quizzes
        .filter(quiz => !activeSubjectFilter || quiz.subjectId === activeSubjectFilter)
        .filter(quiz => !activeChapterFilter || quiz.chapterId === activeChapterFilter)
        .filter(quiz => {
            if (!query) return true;

            const subject = findSubject(quiz.subjectId);
            const chapter = findChapter(quiz.subjectId, quiz.chapterId);
            const inQuestions = quiz.questions.some(question =>
                question.prompt.toLowerCase().includes(query) ||
                question.options.some(option => option.toLowerCase().includes(query))
            );

            return quiz.title.toLowerCase().includes(query) ||
                quiz.description.toLowerCase().includes(query) ||
                inQuestions ||
                Boolean(subject && subject.name.toLowerCase().includes(query)) ||
                Boolean(chapter && chapter.name.toLowerCase().includes(query));
        })
        .sort((a, b) => b.updatedAt - a.updatedAt);
}

function renderFilters() {
    subjectFilter.innerHTML = "";
    subjectFilter.appendChild(createOption("", "All subjects", !activeSubjectFilter));
    subjects.forEach(subject => {
        subjectFilter.appendChild(createOption(subject.id, subject.name, subject.id === activeSubjectFilter));
    });

    chapterFilter.innerHTML = "";
    chapterFilter.appendChild(createOption("", "All chapters", !activeChapterFilter));
    const subject = findSubject(activeSubjectFilter);
    const chapters = subject && Array.isArray(subject.chapters) ? subject.chapters : [];
    chapters.forEach(chapter => {
        chapterFilter.appendChild(createOption(chapter.id, chapter.name, chapter.id === activeChapterFilter));
    });

    chapterFilter.disabled = !activeSubjectFilter || chapters.length === 0;
    clearFiltersBtn.hidden = !activeSubjectFilter && !activeChapterFilter;

    const chapter = findChapter(activeSubjectFilter, activeChapterFilter);
    filterContext.textContent = subject
        ? `${subject.name}${chapter ? ` / ${chapter.name}` : " / All chapters"}`
        : "Showing quizzes from all subjects";
}

function renderQuizList() {
    const visibleQuizzes = getFilteredQuizzes();
    quizList.innerHTML = "";
    quizResultCount.textContent = `${visibleQuizzes.length} ${visibleQuizzes.length === 1 ? "quiz" : "quizzes"}`;

    if (!visibleQuizzes.length) {
        const empty = document.createElement("p");
        empty.className = "quiz-list-empty";
        empty.textContent = quizSearch.value.trim()
            ? "No quizzes match your search."
            : "No quizzes in this view yet.\nCreate your first quiz above.";
        quizList.appendChild(empty);
        return;
    }

    visibleQuizzes.forEach(quiz => {
        const item = document.createElement("button");
        item.type = "button";
        item.className = "quiz-list-item";
        if (quiz.id === currentQuizId) item.classList.add("active");

        const subject = findSubject(quiz.subjectId);
        const chapter = findChapter(quiz.subjectId, quiz.chapterId);
        const context = [subject && subject.name, chapter && chapter.name].filter(Boolean).join(" / ");

        const contextLabel = document.createElement("small");
        contextLabel.textContent = context || "Unassigned";
        const title = document.createElement("strong");
        title.textContent = quiz.title;
        const meta = document.createElement("span");
        meta.textContent = `${quiz.questions.length} ${quiz.questions.length === 1 ? "question" : "questions"}`;

        item.append(contextLabel, title, meta);
        item.addEventListener("click", () => selectQuiz(quiz.id));
        quizList.appendChild(item);
    });
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

function selectInitialQuiz() {
    const firstVisible = getFilteredQuizzes()[0];
    if (firstVisible) selectQuiz(firstVisible.id);
    else showEmptyEditor();
}

function syncSelectionToVisibleQuizzes() {
    const visibleQuizzes = getFilteredQuizzes();
    if (visibleQuizzes.some(quiz => quiz.id === currentQuizId)) return;

    if (visibleQuizzes.length) selectQuiz(visibleQuizzes[0].id);
    else {
        currentQuizId = null;
        showEmptyEditor();
    }
}

function selectQuiz(quizId) {
    const quiz = quizzes.find(item => item.id === quizId);
    if (!quiz) return;

    currentQuizId = quiz.id;
    draftQuestions = cloneQuestions(quiz.questions);
    quizIdInput.value = quiz.id;
    quizTitleInput.value = quiz.title;
    quizDescriptionInput.value = quiz.description;
    quizFormError.textContent = "";
    quizEditorTitle.textContent = "Edit quiz";
    deleteQuizBtn.hidden = false;

    renderEditorSubjectSelect(quiz.subjectId);
    renderEditorChapterSelect(quiz.chapterId, quiz.subjectId);
    renderQuestions();
    showEditor();
    renderQuizList();
}

function openNewQuiz() {
    currentQuizId = null;
    draftQuestions = [];
    quizForm.reset();
    quizIdInput.value = "";
    quizFormError.textContent = "";
    quizEditorTitle.textContent = "New quiz";
    deleteQuizBtn.hidden = true;

    const subjectId = activeSubjectFilter || pendingSubjectId;
    const chapterId = activeChapterFilter || pendingChapterId;
    renderEditorSubjectSelect(subjectId);
    renderEditorChapterSelect(chapterId, subjectId);
    renderQuestions();
    showEditor();
    renderQuizList();
    quizTitleInput.focus();
}

function showEditor() {
    quizForm.classList.remove("is-hidden");
    quizEditorEmpty.classList.add("is-hidden");
}

function showEmptyEditor() {
    quizForm.classList.add("is-hidden");
    quizEditorEmpty.classList.remove("is-hidden");
    quizEditorTitle.textContent = "Select a quiz";
    quizFormError.textContent = "";
}

function renderQuestions() {
    questionList.innerHTML = "";
    questionCount.textContent = `${draftQuestions.length} ${draftQuestions.length === 1 ? "question" : "questions"}`;

    if (!draftQuestions.length) {
        const empty = document.createElement("p");
        empty.className = "question-list-empty";
        empty.textContent = "No questions yet. Add your first multiple-choice question.";
        questionList.appendChild(empty);
        return;
    }

    draftQuestions.forEach((question, index) => {
        const row = document.createElement("article");
        row.className = "question-row";

        const number = document.createElement("span");
        number.className = "question-number";
        number.textContent = String(index + 1).padStart(2, "0");

        const content = document.createElement("div");
        const prompt = document.createElement("h4");
        prompt.textContent = question.prompt;
        const answer = document.createElement("p");
        answer.textContent = `Correct: ${question.options[question.correctIndex]}`;
        content.append(prompt, answer);

        const actions = document.createElement("div");
        actions.className = "question-actions";
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.className = "question-action-btn";
        editButton.textContent = "Edit";
        editButton.addEventListener("click", () => openQuestionDialog(question));
        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "question-action-btn danger";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => deleteQuestion(question));
        actions.append(editButton, deleteButton);

        row.append(number, content, actions);
        questionList.appendChild(row);
    });
}

function openQuestionDialog(question = null) {
    questionForm.reset();
    questionFormError.textContent = "";
    questionIdInput.value = question ? question.id : "";
    questionPromptInput.value = question ? question.prompt : "";
    questionOptionInputs.forEach((input, index) => {
        input.value = question ? question.options[index] : "";
    });
    const correctIndex = question ? question.correctIndex : 0;
    correctOptionInputs.forEach((input, index) => {
        input.checked = index === correctIndex;
    });
    questionDialogTitle.textContent = question ? "Edit question" : "Add question";
    questionSaveBtn.textContent = question ? "Save Changes" : "Add Question";
    questionDialog.showModal();
    questionPromptInput.focus();
}

function closeQuestionDialog() {
    questionDialog.close();
    questionFormError.textContent = "";
}

function saveQuestionFromForm(event) {
    event.preventDefault();

    const prompt = questionPromptInput.value.trim();
    const options = questionOptionInputs.map(input => input.value.trim());
    const correctInput = correctOptionInputs.find(input => input.checked);
    const correctIndex = correctInput ? Number(correctInput.value) : 0;

    if (!prompt || options.some(option => !option)) {
        questionFormError.textContent = "Add the question and all four answer options.";
        (!prompt ? questionPromptInput : questionOptionInputs[options.findIndex(option => !option)]).focus();
        return;
    }

    const normalizedOptions = options.map(option => option.toLowerCase());
    if (new Set(normalizedOptions).size !== options.length) {
        questionFormError.textContent = "Each answer option must be different.";
        return;
    }

    const id = questionIdInput.value;
    if (id) {
        const question = draftQuestions.find(item => item.id === id);
        if (!question) return;
        question.prompt = prompt;
        question.options = options;
        question.correctIndex = correctIndex;
    } else {
        draftQuestions.push({
            id: createId("question"),
            prompt,
            options,
            correctIndex
        });
    }

    closeQuestionDialog();
    renderQuestions();
}

function deleteQuestion(question) {
    const confirmed = confirm(`Delete this question?\n\n"${question.prompt}"`);
    if (!confirmed) return;
    draftQuestions = draftQuestions.filter(item => item.id !== question.id);
    renderQuestions();
}

function saveQuizFromForm(event) {
    event.preventDefault();

    const title = quizTitleInput.value.trim();
    const description = quizDescriptionInput.value.trim();
    const subjectId = subjectSelect.value;
    const chapterId = chapterSelect.value;

    if (!title) {
        quizFormError.textContent = "Enter a quiz title.";
        quizTitleInput.focus();
        return;
    }

    if (!draftQuestions.length) {
        quizFormError.textContent = "Add at least one question before saving the quiz.";
        addQuestionBtn.focus();
        return;
    }

    const duplicate = quizzes.some(quiz =>
        quiz.id !== quizIdInput.value && quiz.title.toLowerCase() === title.toLowerCase()
    );
    if (duplicate) {
        quizFormError.textContent = "A quiz with this title already exists.";
        quizTitleInput.focus();
        return;
    }

    const now = Date.now();
    const existingId = quizIdInput.value;

    if (existingId) {
        const quiz = quizzes.find(item => item.id === existingId);
        if (!quiz) return;
        quiz.title = title;
        quiz.description = description;
        quiz.subjectId = subjectId;
        quiz.chapterId = findChapter(subjectId, chapterId) ? chapterId : "";
        quiz.questions = cloneQuestions(draftQuestions);
        quiz.updatedAt = now;
        currentQuizId = quiz.id;
    } else {
        const quiz = {
            id: createId("quiz"),
            title,
            description,
            subjectId,
            chapterId: findChapter(subjectId, chapterId) ? chapterId : "",
            questions: cloneQuestions(draftQuestions),
            createdAt: now,
            updatedAt: now,
            attemptCount: 0,
            lastAttemptAt: null
        };
        quizzes.push(quiz);
        currentQuizId = quiz.id;
        quizIdInput.value = quiz.id;
        deleteQuizBtn.hidden = false;
        quizEditorTitle.textContent = "Edit quiz";
    }

    if (subjectId) localStorage.setItem(CURRENT_SUBJECT_KEY, subjectId);
    quizFormError.textContent = "";
    if (!saveQuizzes()) return;
    showSavedStatus();

    if (getFilteredQuizzes().some(quiz => quiz.id === currentQuizId)) renderQuizList();
    else syncSelectionToVisibleQuizzes();
}

function deleteCurrentQuiz() {
    const quiz = quizzes.find(item => item.id === currentQuizId);
    if (!quiz) return;
    const confirmed = confirm(`Delete "${quiz.title}"?\n\nThis also deletes its ${quiz.questions.length} questions. This cannot be undone.`);
    if (!confirmed) return;

    quizzes = quizzes.filter(item => item.id !== quiz.id);
    currentQuizId = null;
    saveQuizzes();
    renderQuizList();
    syncSelectionToVisibleQuizzes();
}

function showSavedStatus() {
    clearTimeout(saveStatusTimer);
    quizSaveStatus.textContent = "Saved";
    quizSaveStatus.className = "quiz-save-status";
    saveStatusTimer = setTimeout(() => {
        quizSaveStatus.className = "quiz-save-status hidden";
    }, 1800);
}

function updateFilterUrl() {
    const url = new URL(window.location.href);
    if (activeSubjectFilter) url.searchParams.set("subject", activeSubjectFilter);
    else url.searchParams.delete("subject");
    if (activeChapterFilter) url.searchParams.set("chapter", activeChapterFilter);
    else url.searchParams.delete("chapter");
    window.history.replaceState({}, "", url);
}