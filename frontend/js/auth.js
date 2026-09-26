// ============================================================
//  Flora — Auth Logic
//  Handles Firebase Authentication flows.
// ============================================================

// Initialize Firebase safely
const hasFirebaseConfig = Boolean(
    window.FLORA_FIREBASE_CONFIG &&
    window.FLORA_FIREBASE_CONFIG.apiKey &&
    !window.FLORA_FIREBASE_CONFIG.apiKey.includes("YOUR_")
);

if (hasFirebaseConfig && !firebase.apps.length) {
    firebase.initializeApp(window.FLORA_FIREBASE_CONFIG);
}

const auth = hasFirebaseConfig ? firebase.auth() : null;

// Track navigation so multiple handlers don't fight
let isRedirecting = false;
function safeRedirect(url) {
    if (isRedirecting) return;
    isRedirecting = true;
    window.location.replace(url);
}

function showAuthBox() {
    const loader = document.getElementById("auth-loader");
    const box = document.getElementById("auth-box");
    if (loader) loader.style.display = "none";
    if (box) {
        box.style.display = "block";
        box.classList.add("fade-in");
    }
}

function showLoading(message) {
    const loader = document.getElementById("auth-loader");
    const box = document.getElementById("auth-box");
    if (loader) {
        loader.querySelector("p").textContent = message || "Please wait...";
        loader.style.display = "flex";
    }
    if (box) box.style.display = "none";
}

// ── DOM Elements (only present on auth.html) ────────────────
const authForm = document.getElementById("auth-form");
const authTitle = document.getElementById("auth-title");
const authSubtitle = document.getElementById("auth-subtitle");
const authSubmitBtn = document.getElementById("auth-submit-btn");
const authToggleBtn = document.getElementById("auth-toggle-btn");
const authToggleText = document.getElementById("auth-toggle-text");
const nameGroup = document.getElementById("name-group");
const authError = document.getElementById("auth-error");

const emailInput = document.getElementById("user-email");
const passwordInput = document.getElementById("user-password");
const nameInput = document.getElementById("user-name");

let isSignUp = false;

// ── Auth Page Event Listeners ───────────────────────────────
if (authForm) {
    if (!auth) {
        authError.textContent = "Firebase is not configured yet. Add your real values to js/firebase-config.js first.";
        authSubmitBtn.disabled = true;
        showAuthBox();
    }

    authToggleBtn.addEventListener("click", () => {
        isSignUp = !isSignUp;

        authTitle.textContent = isSignUp ? "Create Account" : "Welcome Back";
        authSubtitle.textContent = isSignUp ? "Start your learning journey with Flora" : "Log in to your Flora account";
        authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Login";
        authToggleBtn.textContent = isSignUp ? "Login" : "Sign Up";
        authToggleText.firstChild.textContent = isSignUp ? "Already have an account? " : "Don't have an account? ";

        nameGroup.style.display = isSignUp ? "block" : "none";
        nameInput.required = isSignUp;

        emailInput.setAttribute("autocomplete", isSignUp ? "email" : "email");
        passwordInput.setAttribute("autocomplete", isSignUp ? "new-password" : "current-password");

        authError.textContent = "";
    });

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        if (!auth) {
            authError.textContent = "Firebase is not configured.";
            return;
        }

        if (authSubmitBtn.disabled) return;

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const name = nameInput.value.trim();

        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = isSignUp ? "Creating account..." : "Logging in...";
        authError.textContent = "";
        showLoading(isSignUp ? "Creating your account..." : "Logging you in...");

        try {
            if (isSignUp) {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                await userCredential.user.updateProfile({ displayName: name });
                console.log("Registered:", userCredential.user);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
                console.log("Logged in");
            }

            safeRedirect("dashboard.html");

        } catch (error) {
            console.error("Auth Error:", error);
            authError.textContent = getFriendlyErrorMessage(error.code);
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Login";
            showAuthBox();
        }
    });
}

// ── Helper: Error Messages ──────────────────────────────────
function getFriendlyErrorMessage(code) {
    switch (code) {
        case "auth/email-already-in-use": return "This email is already registered.";
        case "auth/invalid-email": return "Please enter a valid email address.";
        case "auth/user-disabled": return "This account has been disabled.";
        case "auth/user-not-found": return "No account found with this email.";
        case "auth/wrong-password": return "Incorrect password. Try again.";
        case "auth/weak-password": return "Password should be at least 6 characters.";
        case "auth/operation-not-allowed": return "Email/Password login is not enabled in Firebase.";
        case "auth/invalid-credential": return "Invalid email or password.";
        case "auth/too-many-requests": return "Too many attempts. Please try again later.";
        default: return "An error occurred. Please try again.";
    }
}

// ── Global Auth Guard ───────────────────────────────────────
// This part runs on every page that includes auth.js
if (auth) {
    // Fast synchronous check on auth pages to avoid flashing the login form
    if (authForm && auth.currentUser) {
        showLoading("Redirecting to your dashboard...");
        safeRedirect("dashboard.html");
    }

    auth.onAuthStateChanged((user) => {
        if (isRedirecting) return;

        const path = window.location.pathname;
        const isAuthPage = path.includes("auth.html");
        const isLandingPage = path.endsWith("index.html") || path.endsWith("/");

        if (user) {
            // User is logged in
            if (isAuthPage) {
                showLoading("Redirecting to your dashboard...");
                safeRedirect("dashboard.html");
                return;
            }

            // Update UI on other pages (like header names and avatars)
            const profileName = document.querySelector(".sidebar-profile h4");
            if (profileName && user.displayName) {
                profileName.textContent = user.displayName;
            }

            const avatarIcons = document.querySelectorAll(".notes-nav-avatar, .res-avatar, .quiz-avatar, .flashcards-avatar");
            if (user.displayName) {
                const initial = user.displayName.charAt(0).toUpperCase();
                avatarIcons.forEach(icon => {
                    icon.textContent = initial;
                });
            }
        } else {
            // User is logged out
            if (isAuthPage) {
                showAuthBox();
            } else if (!isLandingPage) {
                safeRedirect("auth.html");
            }
        }
    });
} else if (authForm) {
    // No Firebase config — show the form anyway with the error
    showAuthBox();
}

// ── Logout Function ─────────────────────────────────────────
window.floraLogout = function() {
    if (!auth) {
        window.location.href = "index.html";
        return;
    }

    auth.signOut().then(() => {
        safeRedirect("index.html");
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
};

// ── Global Custom Confirm Dialog ────────────────────────────
window.floraConfirm = function(title, message) {
    return new Promise((resolve) => {
        let dialog = document.getElementById("flora-global-confirm");
        if (!dialog) {
            dialog = document.createElement("dialog");
            dialog.id = "flora-global-confirm";
            dialog.className = "flora-confirm-dialog";
            dialog.innerHTML = `
                <div class="flora-confirm-icon">!</div>
                <h2 class="flora-confirm-title"></h2>
                <p class="flora-confirm-message"></p>
                <div class="flora-confirm-actions">
                    <button type="button" class="flora-confirm-cancel" id="flora-confirm-cancel-btn">Cancel</button>
                    <button type="button" class="flora-confirm-delete" id="flora-confirm-delete-btn">Delete</button>
                </div>
            `;
            document.body.appendChild(dialog);
        }

        dialog.querySelector(".flora-confirm-title").textContent = title || "Are you sure?";
        dialog.querySelector(".flora-confirm-message").textContent = message || "This action cannot be undone.";

        const cancelBtn = dialog.querySelector("#flora-confirm-cancel-btn");
        const deleteBtn = dialog.querySelector("#flora-confirm-delete-btn");

        const cleanup = () => {
            cancelBtn.removeEventListener("click", onCancel);
            deleteBtn.removeEventListener("click", onDelete);
            dialog.close();
        };

        const onCancel = () => {
            cleanup();
            resolve(false);
        };

        const onDelete = () => {
            cleanup();
            resolve(true);
        };

        cancelBtn.addEventListener("click", onCancel);
        deleteBtn.addEventListener("click", onDelete);

        dialog.showModal();
    });
};
