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
        authError.textContent = "";
    });

    authForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const name = nameInput.value.trim();

        authSubmitBtn.disabled = true;
        authSubmitBtn.textContent = isSignUp ? "Creating account..." : "Logging in...";
        authError.textContent = "";

        try {
            if (isSignUp) {
                // Sign Up
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                // Update profile with name
                await userCredential.user.updateProfile({ displayName: name });
                console.log("Registered:", userCredential.user);
            } else {
                // Login
                await auth.signInWithEmailAndPassword(email, password);
                console.log("Logged in");
            }
            
            // Redirect on success
            window.location.href = "dashboard.html";
            
        } catch (error) {
            console.error("Auth Error:", error);
            authError.textContent = getFriendlyErrorMessage(error.code);
            authSubmitBtn.disabled = false;
            authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Login";
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
        default: return "An error occurred. Please try again.";
    }
}

// ── Global Auth Guard ───────────────────────────────────────
// This part runs on every page that includes auth.js
if (auth) {
    auth.onAuthStateChanged((user) => {
        const isAuthPage = window.location.pathname.includes("auth.html");
        const isLandingPage = window.location.pathname.endsWith("index.html") || window.location.pathname.endsWith("/");

        if (user) {
            // User is logged in
            if (isAuthPage) {
                window.location.href = "dashboard.html";
            }
            
            // Optional: Update UI on other pages (like header names)
            const profileName = document.querySelector(".sidebar-profile h4, .notes-nav-avatar, .res-avatar, .quiz-avatar, .flashcards-avatar");
            if (profileName && user.displayName) {
                if (profileName.tagName === "H4") profileName.textContent = user.displayName;
                else profileName.textContent = user.displayName.charAt(0).toUpperCase();
            }
        } else {
            // User is logged out
            if (!isAuthPage && !isLandingPage) {
                window.location.href = "auth.html";
            }
        }
    });
}

// ── Logout Function ─────────────────────────────────────────
window.floraLogout = function() {
    if (!auth) {
        window.location.href = "index.html";
        return;
    }

    auth.signOut().then(() => {
        window.location.href = "index.html";
    }).catch((error) => {
        console.error("Logout Error:", error);
    });
};
