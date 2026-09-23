// ============================================================
//  Flora — Dashboard Logic
//  Calculates and displays real study statistics.
// ============================================================

const KEYS = {
    NOTES: "flora-notes",
    SUBJECTS: "flora-subjects",
    FLASHCARDS: "flora-flashcards",
    QUIZZES: "flora-quizzes",
    ATTEMPTS: "flora-quiz-attempts"
};

document.addEventListener("DOMContentLoaded", () => {
    updateDashboardStats();
    updateGreeting();
});

function updateGreeting() {
    const greetingEl = document.getElementById("dashboard-greeting");
    const sidebarName = document.getElementById("sidebar-user-name");
    if (!greetingEl) return;

    // Determine time of day
    const hour = new Date().getHours();
    let timeGreeting = "Good morning";
    if (hour >= 12 && hour < 17) timeGreeting = "Good afternoon";
    else if (hour >= 17) timeGreeting = "Good evening";

    // Try to get name from Firebase auth
    if (typeof firebase !== "undefined" && firebase.auth) {
        firebase.auth().onAuthStateChanged((user) => {
            const name = user && user.displayName ? user.displayName : "";
            greetingEl.textContent = name
                ? `${timeGreeting}, ${name} 👋`
                : `${timeGreeting} 👋`;

            if (sidebarName && name) {
                sidebarName.textContent = name;
            }
        });
    } else {
        greetingEl.textContent = `${timeGreeting} 👋`;
    }
}

function getData(key) {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
    } catch (e) {
        return [];
    }
}

function updateDashboardStats() {
    const notes = getData(KEYS.NOTES);
    const subjects = getData(KEYS.SUBJECTS);
    const flashcards = getData(KEYS.FLASHCARDS);
    const attempts = getData(KEYS.ATTEMPTS);

    // 1. Calculate Flashcard Reviews
    const totalReviews = flashcards.reduce((sum, card) => sum + (card.reviewCount || 0), 0);
    document.getElementById("stat-reviews").textContent = totalReviews.toLocaleString();

    // 2. Calculate Quiz Accuracy
    let avgAccuracy = 0;
    if (attempts.length > 0) {
        const sum = attempts.reduce((s, a) => s + (a.percentage || 0), 0);
        avgAccuracy = Math.round(sum / attempts.length);
    }
    document.getElementById("stat-accuracy").textContent = `${avgAccuracy}%`;

    // 3. Calculate Content Mastery (Overall Progress)
    let totalProgress = 0;
    if (subjects.length > 0) {
        const sumProgress = subjects.reduce((s, sub) => {
            if (!sub.chapters || sub.chapters.length === 0) return s;
            const completed = sub.chapters.filter(c => c.completed).length;
            return s + (completed / sub.chapters.length);
        }, 0);
        totalProgress = Math.round((sumProgress / subjects.length) * 100);
    }
    document.getElementById("stat-mastery").textContent = `${totalProgress}%`;

    // 4. Calculate Study Streak
    const streak = calculateStreak(notes, attempts, flashcards);
    document.getElementById("stat-streak").textContent = streak;
}

/**
 * Calculates current daily streak by looking at the activity timestamps
 * of notes, quiz attempts, and flashcard reviews.
 */
function calculateStreak(notes, attempts, flashcards) {
    const activityDates = new Set();

    // Collect all timestamps
    notes.forEach(n => activityDates.add(formatDateKey(n.updatedAt)));
    attempts.forEach(a => activityDates.add(formatDateKey(a.completedAt)));
    flashcards.forEach(f => {
        if (f.lastReviewedAt) activityDates.add(formatDateKey(f.lastReviewedAt));
    });

    if (activityDates.size === 0) return 0;

    let streak = 0;
    let curr = new Date();
    
    // Check backwards from today
    while (true) {
        const key = formatDateKey(curr);
        if (activityDates.has(key)) {
            streak++;
            curr.setDate(curr.getDate() - 1);
        } else {
            // If we didn't find activity for "today", but found it for "yesterday", 
            // the streak is still alive. If we find nothing for both, it's broken.
            if (streak === 0) {
                // Try checking yesterday
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                if (activityDates.has(formatDateKey(yesterday))) {
                    // Start counting from yesterday
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
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
