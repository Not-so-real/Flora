const firebaseConfig = window.FLORA_FIREBASE_CONFIG;

if (firebaseConfig && firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("YOUR_")) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();

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
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            await userCredential.user.updateProfile({ displayName: name });
        } else {
            await auth.signInWithEmailAndPassword(email, password);
        }
        window.location.href = "dashboard.html";
    } catch (error) {
        console.error(error);
        authError.textContent = getFriendlyError(error.code);
        authSubmitBtn.disabled = false;
        authSubmitBtn.textContent = isSignUp ? "Sign Up" : "Login";
    }
});

function getFriendlyError(code) {
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
        case "auth/unauthorized-domain": return "This domain is not authorized for Firebase Auth.";
        default: return "An error occurred. Please try again.";
    }
}

window.floraLogout = function() {
    auth.signOut().then(() => {
        window.location.href = "index.html";
    });
};

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
                    <button type="button" class="flora-confirm-cancel">Cancel</button>
                    <button type="button" class="flora-confirm-delete">Delete</button>
                </div>
            `;
            document.body.appendChild(dialog);
        }
        dialog.querySelector(".flora-confirm-title").textContent = title || "Are you sure?";
        dialog.querySelector(".flora-confirm-message").textContent = message || "This action cannot be undone.";
        dialog.querySelector(".flora-confirm-cancel").onclick = () => { dialog.close(); resolve(false); };
        dialog.querySelector(".flora-confirm-delete").onclick = () => { dialog.close(); resolve(true); };
        dialog.showModal();
    });
};