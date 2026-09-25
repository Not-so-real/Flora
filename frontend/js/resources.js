const RESOURCES_STORAGE_KEY = "flora-resources";
const SUBJECTS_STORAGE_KEY = "flora-subjects";
const CURRENT_SUBJECT_KEY = "flora-current-subject";

const newResBtn = document.getElementById("new-resource-btn");
const emptyNewResBtn = document.getElementById("empty-new-res-btn");
const resList = document.getElementById("res-list");
const resResultCount = document.getElementById("res-result-count");
const resSearch = document.getElementById("res-search");
const typeFilter = document.getElementById("res-type-filter");
const subjectFilter = document.getElementById("res-subject-filter");
const chapterFilter = document.getElementById("res-chapter-filter");
const clearFiltersBtn = document.getElementById("clear-res-filters");
const filterContext = document.getElementById("res-filter-context");

const resForm = document.getElementById("res-form");
const resIdInput = document.getElementById("res-id");
const typeSelect = document.getElementById("res-type-select");
const subjectSelect = document.getElementById("res-subject-select");
const chapterSelect = document.getElementById("res-chapter-select");
const resTitleInput = document.getElementById("res-title");
const resUrlInput = document.getElementById("res-url");
const resFileInput = document.getElementById("res-file");
const fileNameDisplay = document.getElementById("file-name-display");
const urlInputGroup = document.getElementById("url-input-group");
const fileInputGroup = document.getElementById("file-input-group");
const resDescriptionInput = document.getElementById("res-description");
const resFormError = document.getElementById("res-form-error");
const deleteResBtn = document.getElementById("delete-res-btn");
const resEditorTitle = document.getElementById("res-editor-title");
const resEditorEmpty = document.getElementById("res-editor-empty");
const resSaveStatus = document.getElementById("res-save-status");

const resAiTools = document.getElementById("res-ai-tools");
const resAiFlashcardsBtn = document.getElementById("res-ai-flashcards-btn");
const resAiQuizBtn = document.getElementById("res-ai-quiz-btn");
const aiOutput = document.getElementById("ai-output");
const aiOutputLabel = document.getElementById("ai-output-label");
const aiOutputContent = document.getElementById("ai-output-content");
const aiOutputClose = document.getElementById("ai-output-close");
const aiOutputActions = document.getElementById("ai-output-actions");
const aiSaveResultBtn = document.getElementById("ai-save-result-btn");
const aiStatus = document.getElementById("ai-status");

const previewContainer = document.getElementById("res-preview-container");
const previewContent = document.getElementById("preview-content");
const closePreviewBtn = document.getElementById("close-preview-btn");

const pageContext = new URLSearchParams(window.location.search);
let activeTypeFilter = pageContext.get("type") || "";
let activeSubjectFilter = pageContext.get("subject") || "";
let activeChapterFilter = activeSubjectFilter ? (pageContext.get("chapter") || "") : "";
let pendingSubjectId = activeSubjectFilter || localStorage.getItem(CURRENT_SUBJECT_KEY) || "";
let pendingChapterId = activeChapterFilter;

let subjects = [];
let resources = [];
let currentResourceId = null;
let saveStatusTimer = null;
let activeObjectUrl = null;
let currentFile = null;
let pendingAiResult = null;
let unsubRes = null;
let unsubSubjectsR = null;

// ── Event Listeners ──────────────────────────────────────────

newResBtn.addEventListener("click", openNewResource);
emptyNewResBtn.addEventListener("click", openNewResource);
resForm.addEventListener("submit", saveResourceFromForm);
deleteResBtn.addEventListener("click", deleteCurrentResource);
closePreviewBtn.addEventListener("click", hidePreview);

typeSelect.addEventListener("change", () => {
    toggleInputGroups(typeSelect.value);
});

resFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) {
        currentFile = file;
        fileNameDisplay.textContent = file.name;
        if (!resTitleInput.value) {
            resTitleInput.value = file.name.replace(/\.[^/.]+$/, "");
        }
        showFilePreview(file);
        
        // Show AI tools if it's a PDF
        if (file.type === "application/pdf") {
            resAiTools.classList.remove("is-hidden");
        } else {
            resAiTools.classList.add("is-hidden");
        }
    }
});

aiOutputClose.addEventListener("click", hideAiOutput);
resAiFlashcardsBtn.addEventListener("click", () => generateFromPdf("flashcards"));
resAiQuizBtn.addEventListener("click", () => generateFromPdf("quiz"));
aiSaveResultBtn.addEventListener("click", saveAiResult);

subjectSelect.addEventListener("change", () => {
    renderEditorChapterSelect("", subjectSelect.value);
    if (subjectSelect.value) {
        localStorage.setItem(CURRENT_SUBJECT_KEY, subjectSelect.value);
    }
});

typeFilter.addEventListener("change", () => {
    activeTypeFilter = typeFilter.value;
    renderResourceList();
    updateFilterUrl();
});

subjectFilter.addEventListener("change", () => {
    activeSubjectFilter = subjectFilter.value;
    activeChapterFilter = "";
    renderFilters();
    renderResourceList();
    updateFilterUrl();
});

chapterFilter.addEventListener("change", () => {
    activeChapterFilter = chapterFilter.value;
    renderFilters();
    renderResourceList();
    updateFilterUrl();
});

clearFiltersBtn.addEventListener("click", () => {
    activeTypeFilter = "";
    activeSubjectFilter = "";
    activeChapterFilter = "";
    typeFilter.value = "";
    renderFilters();
    renderResourceList();
    updateFilterUrl();
});

resSearch.addEventListener("input", () => {
    renderResourceList();
});

// ── Cloud boot ───────────────────────────────────────────────
firebase.auth().onAuthStateChanged(async user => {
    if (!user) { window.location.href = "auth.html"; return; }

    unsubSubjectsR = onCloudUpdate("subjects", cloudSubjects => {
        subjects = cloudSubjects.filter(s => s && s.id && s.name);
        validateContext();
        renderFilters();
        renderResourceList();
    });

    unsubRes = await migrateAndSync(
        "resources",
        RESOURCES_STORAGE_KEY,
        cloudRes => {
            resources = cloudRes.map(normalizeResource).filter(Boolean);
            validateContext();
            renderFilters();
            renderResourceList();
            selectInitialResource();
        },
        normalizeResource
    );
});

// ── Functions ────────────────────────────────────────────────

function toggleInputGroups(type) {
    if (type === "document" || type === "video") {
        fileInputGroup.classList.remove("is-hidden");
        urlInputGroup.classList.add("is-hidden");
    } else {
        fileInputGroup.classList.add("is-hidden");
        urlInputGroup.classList.remove("is-hidden");
    }
}

function normalizeResource(res) {
    if (!res || !res.id) return null;
    return {
        id: String(res.id),
        title: String(res.title || "Untitled").trim(),
        url: String(res.url || "").trim(),
        description: String(res.description || "").trim(),
        type: res.type || "link",
        subjectId: res.subjectId || "",
        chapterId: res.chapterId || "",
        fileName: res.fileName || "",
        updatedAt: res.updatedAt || Date.now()
    };
}

function saveResources() {
    try {
        localStorage.setItem(RESOURCES_STORAGE_KEY, JSON.stringify(resources));
    } catch(e) {}
}

function persistResource(res) {
    saveResources();
    return saveToCloud("resources", res).catch(err => {
        console.error("Cloud save failed:", err);
    });
}

function removeResource(id) {
    resources = resources.filter(r => r.id !== id);
    saveResources();
    return deleteFromCloud("resources", id).catch(err => {
        console.error("Cloud delete failed:", err);
    });
}

function renderFilters() {
    subjectFilter.innerHTML = '<option value="">All subjects</option>';
    subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        opt.selected = s.id === activeSubjectFilter;
        subjectFilter.appendChild(opt);
    });

    chapterFilter.innerHTML = '<option value="">All chapters</option>';
    const sub = subjects.find(s => s.id === activeSubjectFilter);
    if (sub && sub.chapters) {
        sub.chapters.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            opt.selected = c.id === activeChapterFilter;
            chapterFilter.appendChild(opt);
        });
    }
    chapterFilter.disabled = !activeSubjectFilter;
}

function renderResourceList() {
    const query = resSearch.value.toLowerCase();
    const visible = resources.filter(r => {
        if (activeTypeFilter && r.type !== activeTypeFilter) return false;
        if (activeSubjectFilter && r.subjectId !== activeSubjectFilter) return false;
        if (activeChapterFilter && r.chapterId !== activeChapterFilter) return false;
        return r.title.toLowerCase().includes(query);
    });

    resList.innerHTML = "";
    resResultCount.textContent = `${visible.length} resources`;

    if (!visible.length) {
        resList.innerHTML = '<p class="res-list-empty">No resources found.</p>';
        return;
    }

    visible.forEach(r => {
        const item = document.createElement("button");
        item.className = `res-list-item ${r.id === currentResourceId ? "active" : ""}`;
        item.innerHTML = `
            <small class="res-type-badge type-${r.type}">${r.type}</small>
            <strong>${r.title}</strong>
            <span>${r.fileName || r.url || "No link"}</span>
        `;
        item.addEventListener("click", () => selectResource(r.id));
        resList.appendChild(item);
    });
}

function selectResource(id) {
    currentResourceId = id;
    const res = resources.find(r => r.id === id);
    if (!res) return;

    resIdInput.value = res.id;
    resTitleInput.value = res.title;
    resUrlInput.value = res.url;
    resDescriptionInput.value = res.description;
    typeSelect.value = res.type;
    fileNameDisplay.textContent = res.fileName || "No file selected";
    
    toggleInputGroups(res.type);
    renderEditorSubjectSelect(res.subjectId);
    renderEditorChapterSelect(res.chapterId, res.subjectId);
    
    hidePreview();
    if (res.fileName) {
        showReselectMessage(res.fileName);
    }

    resEditorEmpty.classList.add("is-hidden");
    resForm.classList.remove("is-hidden");
    deleteResBtn.hidden = false;
    resEditorTitle.textContent = "Edit resource";
    
    currentFile = null;
    resAiTools.classList.add("is-hidden");
    hideAiOutput();

    renderResourceList();
}

function showReselectMessage(fileName) {
    previewContainer.classList.remove("is-hidden");
    previewContent.innerHTML = `
        <div class="reselect-msg">
            <p><strong>${fileName}</strong></p>
            <p>To view this file again, please select it from your computer.</p>
            <button type="button" class="primary-btn" onclick="document.getElementById('res-file').click()">Select File</button>
        </div>
    `;
}

function showFilePreview(file) {
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = URL.createObjectURL(file);

    previewContainer.classList.remove("is-hidden");
    previewContent.innerHTML = "";

    if (file.type === "application/pdf") {
        const iframe = document.createElement("iframe");
        iframe.src = activeObjectUrl;
        previewContent.appendChild(iframe);
    } else if (file.type.startsWith("video/")) {
        const video = document.createElement("video");
        video.src = activeObjectUrl;
        video.controls = true;
        previewContent.appendChild(video);
    } else {
        previewContent.innerHTML = `<div class="reselect-msg"><p>Preview not available for this file type, but you can still save the reference.</p></div>`;
    }
}

function hidePreview() {
    previewContainer.classList.add("is-hidden");
    previewContent.innerHTML = "";
    if (activeObjectUrl) URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
}

function openNewResource() {
    currentResourceId = null;
    currentFile = null;
    resForm.reset();
    resIdInput.value = "";
    fileNameDisplay.textContent = "Click to select or drag and drop";
    toggleInputGroups("link");
    hidePreview();
    resAiTools.classList.add("is-hidden");
    hideAiOutput();
    
    renderEditorSubjectSelect(activeSubjectFilter || pendingSubjectId);
    renderEditorChapterSelect(activeChapterFilter || pendingChapterId);
    
    resEditorEmpty.classList.add("is-hidden");
    resForm.classList.remove("is-hidden");
    deleteResBtn.hidden = true;
    resEditorTitle.textContent = "Add resource";
    resTitleInput.focus();
}

function saveResourceFromForm(e) {
    e.preventDefault();
    const title = resTitleInput.value.trim();
    if (!title) return;

    const id = resIdInput.value || "res-" + Date.now();
    const type = typeSelect.value;
    const res = {
        id,
        title,
        type,
        url: resUrlInput.value.trim(),
        description: resDescriptionInput.value.trim(),
        subjectId: subjectSelect.value,
        chapterId: chapterSelect.value,
        fileName: (type === "document" || type === "video") && resFileInput.files[0] ? resFileInput.files[0].name : (resources.find(r => r.id === id)?.fileName || ""),
        updatedAt: Date.now()
    };

    persistResource(res).then(() => {
        currentResourceId = id;
        renderResourceList();
        showSavedStatus();
    });
}

async function deleteCurrentResource() {
    if (!currentResourceId) return;
    
    const confirmed = await window.floraConfirm(
        "Delete Resource?",
        "Delete this resource? This cannot be undone."
    );
    if (!confirmed) return;
    
    removeResource(currentResourceId).then(() => {
        currentResourceId = null;
        resForm.classList.add("is-hidden");
        resEditorEmpty.classList.remove("is-hidden");
        hidePreview();
        renderResourceList();
    });
}

function showSavedStatus() {
    clearTimeout(saveStatusTimer);
    resSaveStatus.textContent = "Saved";
    resSaveStatus.className = "res-save-status";
    saveStatusTimer = setTimeout(() => { resSaveStatus.className = "res-save-status hidden"; }, 1500);
}

function renderEditorSubjectSelect(selId) {
    subjectSelect.innerHTML = '<option value="">No subject</option>';
    subjects.forEach(s => {
        const opt = document.createElement("option");
        opt.value = s.id;
        opt.textContent = s.name;
        opt.selected = s.id === selId;
        subjectSelect.appendChild(opt);
    });
}

function renderEditorChapterSelect(selId, subId) {
    chapterSelect.innerHTML = '<option value="">No chapter</option>';
    const sub = subjects.find(s => s.id === (subId || subjectSelect.value));
    if (sub && sub.chapters) {
        sub.chapters.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c.id;
            opt.textContent = c.name;
            opt.selected = c.id === selId;
            chapterSelect.appendChild(opt);
        });
    }
    chapterSelect.disabled = !subId && !subjectSelect.value;
}

function selectInitialResource() {
    if (resources.length && !currentResourceId) selectResource(resources[0].id);
}

function updateFilterUrl() {
    const url = new URL(window.location.href);
    if (activeTypeFilter) url.searchParams.set("type", activeTypeFilter);
    else url.searchParams.delete("type");
    if (activeSubjectFilter) url.searchParams.set("subject", activeSubjectFilter);
    else url.searchParams.delete("subject");
    if (activeChapterFilter) url.searchParams.set("chapter", activeChapterFilter);
    else url.searchParams.delete("chapter");
    window.history.replaceState({}, "", url);
}

function validateContext() {
    if (!subjects.find(s => s.id === activeSubjectFilter)) {
        activeSubjectFilter = "";
        activeChapterFilter = "";
    }
    renderFilters();
}

// ── AI Generation from PDF ───────────────────────────────────

async function extractTextFromPDF(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = async function() {
            try {
                const typedarray = new Uint8Array(this.result);
                const pdf = await pdfjsLib.getDocument(typedarray).promise;
                let fullText = "";
                const numPages = Math.min(pdf.numPages, 5); 
                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const textContent = await page.getTextContent();
                    const pageText = textContent.items.map(item => item.str).join(" ");
                    fullText += pageText + "\n\n";
                }
                resolve(fullText.trim());
            } catch (error) {
                reject(new Error("Could not read text from this PDF."));
            }
        };
        fileReader.onerror = () => reject(new Error("Failed to read file."));
        fileReader.readAsArrayBuffer(file);
    });
}

async function generateFromPdf(action) {
    if (!currentFile || currentFile.type !== "application/pdf") {
        aiStatus.textContent = "Please select a PDF file first.";
        aiStatus.className = "res-ai-status error";
        return;
    }

    if (!window.hasAiKey || !window.hasAiKey()) {
        aiStatus.textContent = "API key missing. Go to Notes > AI Settings to add your OpenRouter key first.";
        aiStatus.className = "res-ai-status error";
        return;
    }

    const allBtns = [resAiFlashcardsBtn, resAiQuizBtn];
    allBtns.forEach(btn => btn.disabled = true);
    aiStatus.textContent = "Reading PDF...";
    aiStatus.className = "res-ai-status";
    hideAiOutput();
    pendingAiResult = null;

    try {
        const pdfText = await extractTextFromPDF(currentFile);
        if (!pdfText || pdfText.length < 20) throw new Error("Could not find enough readable text in this PDF.");
        aiStatus.textContent = "AI is thinking...";

        let prompt;
        if (action === "flashcards") prompt = window.buildFlashcardsPrompt(pdfText);
        else if (action === "quiz") prompt = window.buildQuizPrompt(pdfText);

        const result = await window.askGemini(prompt);
        aiStatus.textContent = "";
        pendingAiResult = { action, result };

        if (action === "flashcards") {
            const cards = window.parseJsonFromAi(result);
            const preview = cards.map((c, i) => `${i + 1}. Q: ${c.front}\n   A: ${c.back}`).join("\n\n");
            showAiOutput("Generated Flashcards", preview, true);
            pendingAiResult.parsed = cards;
        } else if (action === "quiz") {
            const questions = window.parseJsonFromAi(result);
            const preview = questions.map((q, i) => `${i + 1}. ${q.prompt}`).join("\n\n");
            showAiOutput("Generated Quiz", preview, true);
            pendingAiResult.parsed = questions;
        }
    } catch (error) {
        aiStatus.textContent = error.message;
        aiStatus.className = "res-ai-status error";
    } finally {
        allBtns.forEach(btn => btn.disabled = false);
    }
}

function showAiOutput(label, content, showSaveBtn) {
    aiOutputLabel.textContent = label;
    aiOutputContent.textContent = content;
    aiOutput.classList.remove("is-hidden");
    if (showSaveBtn) aiOutputActions.classList.remove("is-hidden");
    else aiOutputActions.classList.add("is-hidden");
}

function hideAiOutput() {
    aiOutput.classList.add("is-hidden");
    aiOutputContent.textContent = "";
    aiOutputActions.classList.add("is-hidden");
    pendingAiResult = null;
}

function saveAiResult() {
    if (!pendingAiResult) return;
    const subjectId = subjectSelect.value || "";
    const chapterId = chapterSelect.value || "";

    if (pendingAiResult.action === "flashcards" && pendingAiResult.parsed) {
        const now = Date.now();
        pendingAiResult.parsed.forEach(card => {
            saveToCloud("flashcards", {
                id: `fc-${now}-${Math.random().toString(16).slice(2)}`,
                front: card.front,
                back: card.back,
                subjectId,
                chapterId,
                createdAt: now,
                updatedAt: now,
                reviewCount: 0,
                lastReviewedAt: null,
                lastResult: null
            });
        });
        aiStatus.textContent = "Saved to Flashcards!";
    } else if (pendingAiResult.action === "quiz" && pendingAiResult.parsed) {
        const now = Date.now();
        const quiz = {
            id: `quiz-${now}-${Math.random().toString(16).slice(2)}`,
            title: `AI Quiz: ${resTitleInput.value || "Untitled"}`,
            description: `Auto-generated from document`,
            subjectId,
            chapterId,
            questions: pendingAiResult.parsed,
            createdAt: now,
            updatedAt: now,
            attemptCount: 0,
            lastAttemptAt: null
        };
        saveToCloud("quizzes", quiz);
        aiStatus.textContent = "Saved to Quizzes!";
    }
    hideAiOutput();
}

function escapeHtml(value) {
    return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
    