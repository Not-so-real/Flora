// ============================================================
//  Flora — Auth Logic
//  Handles Firebase Authentication flows.
// ============================================================

function debugLog(message, isError) {
    const debugBox = document.getElementById("auth-debug");
    if (debugBox) {
        const line = document.createElement("div");
        line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        if (isError) line.style.color = "#B3462F";
        debugBox.appendChild(line);
        debugBox.style.display = "block";
    }
    if (isError) console.error(message);
    else console.log(message);
}

window.onerror = function(msg, url, line) {
    debugLog("JS ERROR: " + msg + " (line " + line + ")", true);
};

// Initialize Firebase safely
const hasFirebaseConfig = Boolean(
    window.FLORA_FIREBASE_CONFIG &&
    window.FLORA_FIREBASE_CONFIG.apiKey &&
    !window.FLORA_FIREBASE_CONFIG.apiKey.includes("YOUR_")
);

debugLog("Firebase config present: " + hasFirebaseConfig);

if (hasFirebaseConfig && typeof firebase !== "undefined" && !firebase.apps.length) {
    try {
        firebase.initializeApp(window.FLORA_FIREBASE_CONFIG);
        debugLog("Firebase initialized");
    } catch (e) {
        debugLog("Firebase init failed: " + e.message, true);
    }
}

const auth = hasFirebaseConfig && typeof firebase !== "undefined" ? firebase.auth() : null;
debugLog("Auth object present: " + !!auth);

// Track navigation so multiple handlers don't fight
let isRedirecting = false;
function safeRedirect(url) {
    if (isRedirecting) return;

    const current = window.location.href.replace(/\/$/, "");
    const target = new URL(url, window.location.href).href.replace(/\/$/, "");
    if (current === target) {
        debugLog("Already on target page: " + url);
        return;
    }

    isRedirecting = true;
    debugLog("Redirecting to: " + target);
    window.location.replace(target);
}

function showAuthBox() {
    const loader = document.getElementById("auth-loader");
    const box = document.getElementById("auth-box");
    if (loader) loader.style.display = "none";
    if (box) {
        box.style.display = "block";
        box.classList.add("fade-in");
    }
    debugLog("Login form shown");
}

function showLoading(message) {
    const loader = document.getElementById("auth-loader");
    const box = document.getElementById("auth-box");
    if (loader) {
        const p = loader.querySelector("p");
        if (p) p.textContent = message || "Please wait...";
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
    debugLog("Auth form found");

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

        emailInput.setAttribute("autocomplete", "email");
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
                debugLog("Registered: " + userCredential.user.email);
            } else {
                await auth.signInWithEmailAndPassword(email, password);
                debugLog("Logged in");
            }

            safeRedirect("dashboard.html");

        } catch (error) {
            debugLog("Auth Error: " + error.code + " — " + error.message, true);
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
        case "auth/unauthorized-domain": return "This domain is not authorized for Firebase Auth. Add it in your Firebase Console.";
        default: return "An error occurred. Please try again.";
    }
}

// ── Global Auth Guard ───────────────────────────────────────
let authStateResolved = false;

function fallbackToAuthBox() {
    if (authStateResolved) return;
    authStateResolved = true;
    debugLog("Auth state timed out — showing login form", true);
    if (authForm) showAuthBox();
}

if (auth) {
    const fallbackTimer = setTimeout(fallbackToAuthBox, 3500);

    auth.onAuthStateChanged((user) => {
        if (isRedirecting) return;
        if (authStateResolved) return;

        authStateResolved = true;
        clearTimeout(fallbackTimer);

        const path = window.location.pathname;
        const isAuthPage = path.includes("auth.html");
        const isLandingPage = path === "/" || path.endsWith("index.html");

        debugLog("Auth state resolved. Path: " + path + " | Logged in: " + !!user);

        // IMPORTANT: On auth pages, do NOT auto-redirect even if logged in.
        // This prevents redirect loops while we debug. The form submit handler
        // will still redirect after a successful login.
        if (isAuthPage) {
            showAuthBox();
            return;
        }

        if (user) {
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
            if (!isLandingPage) {
                safeRedirect("auth.html");
            }
        }
    });
} else if (authForm) {
    debugLog("Firebase not configured — showing form", true);
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
        debugLog("Logout Error: " + error.message, true);
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
