// ============================================================
//  Flora — Settings Page
//  Waits for Firebase auth to be ready before populating.
// ============================================================

const profileForm = document.getElementById("profile-form");
const displayNameInput = document.getElementById("settings-display-name");
const emailInput = document.getElementById("settings-email");
const profileStatus = document.getElementById("profile-status");
const passwordResetBtn = document.getElementById("send-password-reset-btn");

const aiSettingsForm = document.getElementById("ai-settings-form-page");
const aiKeyInput = document.getElementById("settings-ai-key");
const aiModelInput = document.getElementById("settings-ai-model");
const aiSettingsStatus = document.getElementById("ai-settings-status");
const clearAiSettingsBtn = document.getElementById("clear-ai-settings-btn");

const clearLocalDataBtn = document.getElementById("clear-local-data-btn");
const downloadBackupBtn = document.getElementById("download-backup-btn");
const storageStatus = document.getElementById("storage-status");
const signOutBtn = document.getElementById("sign-out-btn");

const LOCAL_KEYS = [
    "flora-subjects",
    "flora-current-subject",
    "flora-notes",
    "flora-folders",
    "flora-flashcards",
    "flora-quizzes",
    "flora-quiz-attempts",
    "flora-resources",
    "flora-planner",
    "flora-ai-key",
    "flora-ai-model"
];

// ── 1. Load AI settings from localStorage immediately ────────
aiKeyInput.value = localStorage.getItem("flora-ai-key") || "";
aiModelInput.value = localStorage.getItem("flora-ai-model") || "";

// ── 2. Wait for Firebase to be ready, then populate profile ──
function populateProfileFromUser(user) {
    if (!user) return;
    displayNameInput.value = user.displayName || "";
    emailInput.value = user.email || "";
}

// Set up a polling interval to catch Firebase the instant it loads
const firebaseCheckInterval = setInterval(() => {
    if (typeof firebase !== "undefined" && firebase.apps && firebase.apps.length > 0) {
        clearInterval(firebaseCheckInterval);
        firebase.auth().onAuthStateChanged(user => {
            populateProfileFromUser(user);
        });
    }
}, 50);

// Safety fallback: stop polling after 5 seconds
setTimeout(() => clearInterval(firebaseCheckInterval), 5000);

// ── 3. Save Profile ──────────────────────────────────────────
profileForm.addEventListener("submit", async event => {
    event.preventDefault();

    if (typeof firebase === "undefined" || !firebase.apps.length) {
        profileStatus.textContent = "Firebase is not configured yet.";
        profileStatus.className = "settings-status error";
        return;
    }

    const auth = firebase.auth();
    const user = auth.currentUser;

    if (!user) {
        profileStatus.textContent = "Not logged in.";
        profileStatus.className = "settings-status error";
        return;
    }

    const newName = displayNameInput.value.trim();
    if (!newName) {
        profileStatus.textContent = "Name cannot be empty.";
        profileStatus.className = "settings-status error";
        return;
    }

    try {
        await user.updateProfile({ displayName: newName });
        profileStatus.textContent = "Profile updated successfully.";
        profileStatus.className = "settings-status success";
    } catch (error) {
        console.error("Profile update error:", error);
        profileStatus.textContent = "Could not save profile. Try again.";
        profileStatus.className = "settings-status error";
    }
});

// ── 4. Password Reset ────────────────────────────────────────
passwordResetBtn.addEventListener("click", async () => {
    if (typeof firebase === "undefined" || !firebase.apps.length) return;

    const auth = firebase.auth();
    const user = auth.currentUser;
    if (!user || !user.email) {
        profileStatus.textContent = "No email address found.";
        profileStatus.className = "settings-status error";
        return;
    }

    try {
        await auth.sendPasswordResetEmail(user.email);
        profileStatus.textContent = `Reset email sent to ${user.email}.`;
        profileStatus.className = "settings-status success";
    } catch (error) {
        console.error("Password reset error:", error);
        profileStatus.textContent = "Could not send reset email.";
        profileStatus.className = "settings-status error";
    }
});

// ── 5. Save AI Settings ──────────────────────────────────────
aiSettingsForm.addEventListener("submit", event => {
    event.preventDefault();
    const key = aiKeyInput.value.trim();
    const model = aiModelInput.value.trim();

    if (key) {
        localStorage.setItem("flora-ai-key", key);
    }
    if (model) {
        localStorage.setItem("flora-ai-model", model);
    }

    aiSettingsStatus.textContent = "AI settings saved.";
    aiSettingsStatus.className = "settings-status success";

    setTimeout(() => {
        aiSettingsStatus.textContent = "";
    }, 2500);
});

// ── 6. Clear AI Settings ─────────────────────────────────────
clearAiSettingsBtn.addEventListener("click", () => {
    if (!confirm("Clear your saved OpenRouter API key and model?")) return;
    localStorage.removeItem("flora-ai-key");
    localStorage.removeItem("flora-ai-model");
    aiKeyInput.value = "";
    aiModelInput.value = "";
    aiSettingsStatus.textContent = "AI settings cleared.";
    aiSettingsStatus.className = "settings-status success";
});

// ── 7. Clear Local Study Data ────────────────────────────────
clearLocalDataBtn.addEventListener("click", () => {
    if (!confirm("This will erase ALL your local Flora notes, subjects, flashcards, quizzes, attempts, resources, and planner tasks.\n\nThis cannot be undone. Continue?")) return;

    LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
    storageStatus.textContent = "Local study data cleared.";
    storageStatus.className = "settings-status success";
});

// ── 8. Download Backup ───────────────────────────────────────
downloadBackupBtn.addEventListener("click", () => {
    const backup = {};
    LOCAL_KEYS.forEach(key => {
        const value = localStorage.getItem(key);
        if (value !== null) backup[key] = value;
    });

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `flora-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);

    storageStatus.textContent = "Backup downloaded successfully.";
    storageStatus.className = "settings-status success";
});

// ── 9. Sign Out ──────────────────────────────────────────────
signOutBtn.addEventListener("click", () => {
    if (typeof firebase === "undefined" || !firebase.apps.length) {
        // No Firebase — just redirect to landing
        window.location.href = "index.html";
        return;
    }

    firebase.auth().signOut()
        .then(() => {
            window.location.href = "index.html";
        })
        .catch(error => {
            console.error("Sign out error:", error);
            storageStatus.textContent = "Could not sign out. Try again.";
            storageStatus.className = "settings-status error";
        });
});
