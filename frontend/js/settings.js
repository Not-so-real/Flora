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

const authInstance = typeof firebase !== "undefined" && firebase.auth ? firebase.auth() : null;

document.addEventListener("DOMContentLoaded", () => {
    aiKeyInput.value = localStorage.getItem("flora-ai-key") || "";
    aiModelInput.value = localStorage.getItem("flora-ai-model") || "";
});

if (authInstance) {
    authInstance.onAuthStateChanged(user => {
        if (!user) return;
        displayNameInput.value = user.displayName || "";
        emailInput.value = user.email || "";
    });
}

profileForm.addEventListener("submit", async event => {
    event.preventDefault();
    if (!authInstance || !authInstance.currentUser) return;

    try {
        await authInstance.currentUser.updateProfile({ displayName: displayNameInput.value.trim() });
        profileStatus.textContent = "Profile updated.";
        profileStatus.className = "settings-status success";
    } catch (error) {
        console.error(error);
        profileStatus.textContent = "Could not save profile.";
        profileStatus.className = "settings-status error";
    }
});

passwordResetBtn.addEventListener("click", async () => {
    if (!authInstance || !authInstance.currentUser?.email) return;

    try {
        await authInstance.sendPasswordResetEmail(authInstance.currentUser.email);
        profileStatus.textContent = "Password reset email sent.";
        profileStatus.className = "settings-status success";
    } catch (error) {
        console.error(error);
        profileStatus.textContent = "Could not send reset email.";
        profileStatus.className = "settings-status error";
    }
});

aiSettingsForm.addEventListener("submit", event => {
    event.preventDefault();
    localStorage.setItem("flora-ai-key", aiKeyInput.value.trim());
    localStorage.setItem("flora-ai-model", aiModelInput.value.trim());
    aiSettingsStatus.textContent = "AI settings saved.";
    aiSettingsStatus.className = "settings-status success";
});

clearAiSettingsBtn.addEventListener("click", () => {
    localStorage.removeItem("flora-ai-key");
    localStorage.removeItem("flora-ai-model");
    aiKeyInput.value = "";
    aiModelInput.value = "";
    aiSettingsStatus.textContent = "AI settings cleared.";
    aiSettingsStatus.className = "settings-status success";
});

clearLocalDataBtn.addEventListener("click", () => {
    const confirmed = confirm("Clear all local Flora study data on this browser? This cannot be undone.");
    if (!confirmed) return;

    LOCAL_KEYS.forEach(key => localStorage.removeItem(key));
    storageStatus.textContent = "Local study data cleared.";
    storageStatus.className = "settings-status success";
});

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
    storageStatus.textContent = "Backup downloaded.";
    storageStatus.className = "settings-status success";
});

signOutBtn.addEventListener("click", () => {
    if (typeof window.floraLogout === "function") {
        window.floraLogout();
    }
});
