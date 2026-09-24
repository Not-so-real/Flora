// ============================================================
//  Flora — Dashboard Logic
//  Calculates and displays real study statistics from Firestore.
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
    updateGreeting();
});

function updateGreeting() {
    const greetingEl = document.getElementById("dashboard-greeting");
    const sidebarName = document.getElementById("sidebar-user-name");
    if (!greetingEl) return;

    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17) timeGreeting = "Good evening";

    if (typeof firebase !== "undefined" && firebase.auth) {
        firebase.auth().onAuthStateChanged(user => {
            const name = user && user.displayName ? user.displayName : "";
            greetingEl.textContent = name
                ? `${timeGreeting}, ${name} 👋`
                : `${timeGreeting} 👋`;

            if (sidebarName && name) {
                sidebarName.textContent = name;
            }

            if (user) {
                loadCloudStats();
            }
        });
    } else {
        greetingEl.textContent = `${timeGreeting} 👋`;
    }
}

async function loadCloudStats() {
    try {
        const [subjects, notes, flashcards, attempts] = await Promise.all([
            fetchFromCloud("subjects"),
            fetchFromCloud("notes"),
            fetchFromCloud("flashcards"),
            fetchFromCloud("quiz_attempts")
        ]);

        // Flashcard Reviews
        const totalReviews = flashcards.reduce((sum, card) => sum + (Number(card.reviewCount) || 0), 0);
        document.getElementById("stat-reviews").textContent = totalReviews.toLocaleString();

        // Quiz Accuracy
        let avgAccuracy = 0;
        if (attempts.length > 0) {
            const sum = attempts.reduce((s, a) => s + (Number(a.percentage) || 0), 0);
            avgAccuracy = Math.round(sum / attempts.length);
        }
        document.getElementById("stat-accuracy").textContent = `${avgAccuracy}%`;

        // Content Mastery
        let totalProgress = 0;
        if (subjects.length > 0) {
            const sumProgress = subjects.reduce((s, sub) => {
                const chapters = Array.isArray(sub.chapters) ? sub.chapters : [];
                if (chapters.length === 0) return s;
                const completed = chapters.filter(c => c.completed).length;
                return s + (completed / chapters.length);
            }, 0);
            totalProgress = Math.round((sumProgress / subjects.length) * 100);
        }
        document.getElementById("stat-mastery").textContent = `${totalProgress}%`;

        // Study Streak
        const streak = calculateStreak(notes, attempts, flashcards);
        document.getElementById("stat-streak").textContent = streak;

    } catch (error) {
        console.error("Could not load dashboard stats from cloud:", error);
    }
}

function calculateStreak(notes, attempts, flashcards) {
    const activityDates = new Set();

    notes.forEach(n => {
        if (n.updatedAt) activityDates.add(formatDateKey(n.updatedAt));
    });
    attempts.forEach(a => {
        if (a.completedAt) activityDates.add(formatDateKey(a.completedAt));
    });
    flashcards.forEach(f => {
        if (f.lastReviewedAt) activityDates.add(formatDateKey(f.lastReviewedAt));
    });

    if (activityDates.size === 0) return 0;

    let streak = 0;
    let curr = new Date();

    while (true) {
        const key = formatDateKey(curr);
        if (activityDates.has(key)) {
            streak++;
            curr.setDate(curr.getDate() - 1);
        } else {
            if (streak === 0) {
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (activityDates.has(formatDateKey(yesterday))) {
                    curr = yesterday;
                    continue;
                }
            }
            break;
        }
    }

    return streak;
}

function formatDateKey(timestamp) {
    if (!timestamp) return "";
    const d = new Date(Number(timestamp) || timestamp);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
