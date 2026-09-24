// ============================================================
//  Flora — Progress Page
//  Pulls all data from Firestore for real analytics.
// ============================================================

firebase.auth().onAuthStateChanged(async user => {
    if (!user) { window.location.href = "auth.html"; return; }
    await renderProgressPage();
});

async function renderProgressPage() {
    try {
        const [subjects, notes, flashcards, quizzes, attempts, resources] = await Promise.all([
            fetchFromCloud("subjects"),
            fetchFromCloud("notes"),
            fetchFromCloud("flashcards"),
            fetchFromCloud("quizzes"),
            fetchFromCloud("quiz_attempts"),
            fetchFromCloud("resources")
        ]);

        document.getElementById("progress-streak").textContent = calculateStreak(notes, attempts, flashcards);
        document.getElementById("progress-notes").textContent = notes.length;
        document.getElementById("progress-reviews").textContent = flashcards.reduce((sum, card) => sum + (Number(card.reviewCount) || 0), 0);
        document.getElementById("progress-accuracy").textContent = `${calculateAverageAccuracy(attempts)}%`;
        document.getElementById("progress-chapters").textContent = `${calculateCompletion(subjects)}%`;
        document.getElementById("progress-resources").textContent = resources.length;

        renderSubjectBreakdown(subjects);
        renderRecentActivity(subjects, notes, flashcards, quizzes, attempts, resources);
    } catch (error) {
        console.error("Could not load progress from cloud:", error);
    }
}

function calculateAverageAccuracy(attempts) {
    if (!attempts.length) return 0;
    const total = attempts.reduce((sum, attempt) => sum + (Number(attempt.percentage) || 0), 0);
    return Math.round(total / attempts.length);
}

function calculateCompletion(subjects) {
    if (!subjects.length) return 0;
    const ratios = subjects.map(subject => {
        const chapters = Array.isArray(subject.chapters) ? subject.chapters : [];
        if (!chapters.length) return 0;
        const completed = chapters.filter(ch => ch.completed).length;
        return completed / chapters.length;
    });
    const total = ratios.reduce((sum, ratio) => sum + ratio, 0);
    return Math.round((total / subjects.length) * 100);
}

function calculateStreak(notes, attempts, flashcards) {
    const activityDates = new Set();
    notes.forEach(n => n.updatedAt && activityDates.add(dateKey(n.updatedAt)));
    attempts.forEach(a => a.completedAt && activityDates.add(dateKey(a.completedAt)));
    flashcards.forEach(f => f.lastReviewedAt && activityDates.add(dateKey(f.lastReviewedAt)));

    if (!activityDates.size) return 0;

    let streak = 0;
    let curr = new Date();

    while (true) {
        const key = dateKey(curr);
        if (activityDates.has(key)) {
            streak++;
            curr.setDate(curr.getDate() - 1);
        } else {
            if (streak === 0) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (activityDates.has(dateKey(yesterday))) {
                    curr = yesterday;
                    continue;
                }
            }
            break;
        }
    }

    return streak;
}

function dateKey(timestamp) {
    const d = new Date(Number(timestamp) || timestamp);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function renderSubjectBreakdown(subjects) {
    const container = document.getElementById("subject-progress-list");
    container.innerHTML = "";

    if (!subjects.length) {
        container.innerHTML = `<div class="progress-empty"><h3>No subjects yet</h3><p>Create your first subject to start tracking progress.</p></div>`;
        return;
    }

    subjects.forEach(subject => {
        const chapters = Array.isArray(subject.chapters) ? subject.chapters : [];
        const total = chapters.length;
        const completed = total ? chapters.filter(ch => ch.completed).length : 0;
        const percent = total ? Math.round((completed / total) * 100) : 0;

        const item = document.createElement("article");
        item.className = "subject-progress-item";
        item.innerHTML = `
            <h3>${escapeHtml(subject.name || "Untitled")}</h3>
            <p>${completed} of ${total} chapters completed · ${percent}%</p>
            <div class="progress-track"><div class="progress-fill" style="width:${percent}%"></div></div>
        `;
        container.appendChild(item);
    });
}

function renderRecentActivity(subjects, notes, flashcards, quizzes, attempts, resources) {
    const container = document.getElementById("activity-list");
    container.innerHTML = "";

    const subjectMap = new Map(subjects.map(subject => [subject.id, subject.name]));
    const events = [];

    notes.forEach(note => {
        if (note.updatedAt) {
            events.push({
                title: `Updated note: ${note.title || "Untitled Note"}`,
                detail: note.subjectId ? `Subject: ${subjectMap.get(note.subjectId) || "Unknown"}` : "General note",
                time: Number(note.updatedAt)
            });
        }
    });

    flashcards.forEach(card => {
        if (card.lastReviewedAt) {
            events.push({
                title: `Reviewed flashcard`,
                detail: card.front || "Flashcard",
                time: Number(card.lastReviewedAt)
            });
        }
    });

    quizzes.forEach(quiz => {
        if (quiz.updatedAt) {
            events.push({
                title: `Edited quiz: ${quiz.title || "Untitled Quiz"}`,
                detail: `${(quiz.questions && quiz.questions.length) || 0} questions`,
                time: Number(quiz.updatedAt)
            });
        }
    });

    attempts.forEach(attempt => {
        if (attempt.completedAt) {
            events.push({
                title: `Completed a quiz attempt`,
                detail: `${attempt.score}/${attempt.totalQuestions} · ${attempt.percentage}%`,
                time: Number(attempt.completedAt)
            });
        }
    });

    resources.forEach(resource => {
        if (resource.updatedAt) {
            events.push({
                title: `Saved resource: ${resource.title || "Untitled Resource"}`,
                detail: resource.type || "Resource",
                time: Number(resource.updatedAt)
            });
        }
    });

    events.sort((a, b) => b.time - a.time);
    const recent = events.slice(0, 8);

    if (!recent.length) {
        container.innerHTML = `<div class="progress-empty"><h3>No activity yet</h3><p>Use Flora tools and your progress will appear here.</p></div>`;
        return;
    }

    recent.forEach(event => {
        const item = document.createElement("article");
        item.className = "activity-item";
        item.innerHTML = `
            <h3>${escapeHtml(event.title)}</h3>
            <p>${escapeHtml(event.detail)}</p>
            <time>${formatDateTime(event.time)}</time>
        `;
        container.appendChild(item);
    });
}

function formatDateTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit"
    });
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
