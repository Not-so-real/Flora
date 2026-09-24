# 🌿 Flora — AI-Powered Study Platform

> Transform your study materials into smart summaries, flashcards, quizzes and personalized learning paths.

Flora is a student-focused study platform that helps you organize your subjects, take notes, create flashcards, build quizzes, collect resources, and plan your study sessions — all in one place. It also uses AI to generate summaries, explanations, flashcards, and quizzes directly from your notes and uploaded PDFs.

---

## ✨ Features

### 📚 Subjects & Chapters
- Create subjects (e.g. Mathematics, Biology, History)
- Add chapters inside each subject
- Mark chapters as complete and track progress automatically
- View overall completion percentage per subject

### 📝 Notes
- Rich text editor with formatting (bold, italic, headings, lists)
- Organize notes by subject, chapter, and custom folders
- Separate note title from body — the first line is never forced into the sidebar
- Auto-save to cloud after every keystroke (800ms debounce)
- Search notes by title, content, subject, and chapter
- Filter notes by subject and chapter
- Create new subjects and chapters directly from the Notes sidebar

### 🧠 Flashcards
- Create flashcards with a front (question) and back (answer)
- Assign flashcards to subjects and chapters
- Search and filter by subject and chapter
- Study sessions with card reveal, "Know it", and "Review again"
- Track review count, last reviewed date, and mastery
- Study session summary with score breakdown

### ❓ Quizzes
- Build multiple-choice quizzes with 4 answer options per question
- Mark the correct answer when building each question
- Assign quizzes to subjects and chapters
- Take quizzes one question at a time with Previous/Next navigation
- Submit and see your score, percentage, and per-question review
- Save attempt history with best score tracking

### 📁 Resources
- Save study materials: links, videos, books, documents
- Upload and preview PDF files and MP4 videos locally in the browser
- Assign resources to subjects and chapters
- Search and filter by type, subject, and chapter

### 🗓️ Planner
- Create study tasks with title, notes, due date, and priority (Low / Medium / High)
- Assign tasks to subjects and chapters
- Mark tasks as completed
- Filter by subject and status (To Do / Done)
- Cloud-synced so tasks persist across devices

### 📈 Progress
- Real-time analytics pulled from Firestore
- Study streak calculated from notes, quiz attempts, and flashcard reviews
- Total note count, flashcard review total, quiz accuracy average
- Subject breakdown with chapter completion bars
- Recent activity feed across all study tools

### ✨ AI Generation
- **Summarize** — generates bullet-point summaries of your notes
- **Explain** — explains note content in simple, student-friendly language
- **Flashcards** — auto-generates 5 flashcards from note content
- **Quiz** — auto-generates 5 multiple-choice questions from note content
- **Generate from PDF** — upload a PDF in Resources and generate flashcards or a quiz from it
- Uses OpenRouter API (bring your own free API key — stored only in your browser)

### 👤 Authentication
- Email and password sign up and login
- Firebase Authentication
- Protected routes — every workspace requires login
- Profile name synced from Firebase and shown across all pages

### ⚙️ Settings
- Edit your display name
- Send a password reset email
- Manage your OpenRouter AI key and preferred model
- Download a JSON backup of all local study data
- Clear all local data
- Sign out

### 🎨 Design
- Clean, calm, student-focused interface
- Custom delete confirmation dialogs (no ugly browser popups)
- Smooth animations and micro-interactions
- Ambient background gradient
- Custom scrollbars
- Fully responsive for desktop, tablet, and mobile
- Reduced motion support

---

## 🛠️ Tech Stack

| Category | Technology |
|---|---|
| Frontend | HTML5, CSS3, Vanilla JavaScript |
| Authentication | Firebase Authentication |
| Database | Firebase Firestore |
| AI | OpenRouter API (user-supplied key) |
| PDF Reading | PDF.js (CDN) |
| Hosting | Firebase Hosting / Vercel |
| Storage | Firestore + localStorage cache |

---

## 📂 Project Structure

```
Ai-Study-Platform/
│
└── frontend/
    ├── index.html          Landing page
    ├── auth.html           Login and sign up
    ├── dashboard.html      Main student dashboard
    ├── subject.html        Subject workspace
    ├── notes.html          Notes workspace
    ├── flashcards.html     Flashcards workspace
    ├── quiz.html           Quiz builder and quiz-taking
    ├── resources.html      Study resources
    ├── planner.html        Study planner
    ├── progress.html       Study analytics
    ├── settings.html       Account settings
    │
    ├── css/
    │   ├── tokens.css      Design tokens
    │   ├── components.css  Shared components
    │   ├── animations.css  Shared animations
    │   ├── style.css       Landing page styles
    │   ├── dashboard.css   Dashboard styles
    │   ├── notes.css       Notes styles
    │   ├── flashcards.css  Flashcards styles
    │   ├── quiz.css        Quiz styles
    │   ├── resources.css   Resources styles
    │   ├── planner.css     Planner styles
    │   ├── progress.css    Progress styles
    │   ├── settings.css    Settings styles
    │   ├── auth.css        Auth page styles
    │   └── responsive.css  Mobile/tablet breakpoints
    │
    └── js/
        ├── firebase-config.js   Firebase credentials
        ├── firebase-db.js       Firestore utility layer
        ├── auth.js              Firebase auth + custom dialogs
        ├── ai.js                OpenRouter AI engine
        ├── subjects.js          Dashboard subject management
        ├── subject.js           Subject workspace + chapters
        ├── notes.js             Notes workspace
        ├── flashcards.js        Flashcards workspace
        ├── quiz.js              Quiz builder + quiz-taking
        ├── resources.js         Resources workspace
        ├── planner.js           Planner workspace
        ├── progress.js          Progress analytics
        ├── dashboard.js         Dashboard stats
        ├── settings.js          Settings page
        └── faq.js               Landing page FAQ accordion
```

---

## 🚀 Getting Started

### Prerequisites
- A Google account (for Firebase)
- A free [OpenRouter](https://openrouter.ai/keys) API key (for AI features)
- A web server or [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) for local development

### Local Development
1. Clone the repository:
   ```bash
   git clone https://github.com/Not-so-real/Flora.git
   cd Flora
   ```

2. Open `frontend/js/firebase-config.js` and paste your Firebase config:
   ```javascript
   const firebaseConfig = {
     apiKey: "YOUR_API_KEY",
     authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
     projectId: "YOUR_PROJECT_ID",
     storageBucket: "YOUR_PROJECT_ID.appspot.com",
     messagingSenderId: "YOUR_SENDER_ID",
     appId: "YOUR_APP_ID"
   };
   window.FLORA_FIREBASE_CONFIG = firebaseConfig;
   ```

3. Open `frontend/index.html` with Live Server.

4. Sign up for an account and start studying.

5. To enable AI features, open any Notes page, click **⚙️ AI Settings**, and paste your OpenRouter API key.

---

## 🔥 Firebase Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable **Authentication → Email/Password**
4. Enable **Firestore Database** (start in test mode)
5. Add a **Web App** and copy the config into `firebase-config.js`
6. Set Firestore security rules:
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /users/{userId}/{document=**} {
         allow read, write: if request.auth != null
           && request.auth.uid == userId;
       }
     }
   }
   ```

---

## 🗺️ Roadmap

### Completed ✅
- Notes with rich text editor, folders, subjects, chapters, cloud sync
- Flashcards with study sessions and review tracking
- Quizzes with builder, taking, scoring, and attempt history
- Resources with file preview and AI generation
- Planner with tasks, priorities, and due dates
- Progress analytics with subject breakdown and activity feed
- AI summarization, explanation, flashcard generation, quiz generation
- Firebase Authentication
- Firestore cloud sync for all modules
- Custom confirmation dialogs
- Responsive design

### Planned 🔜
- [ ] Quiz sharing with join codes (teacher → student)
- [ ] Firebase Storage for permanent file uploads
- [ ] Teacher and student role separation
- [ ] Spaced repetition for flashcards
- [ ] Flashcard shuffle and review-only modes
- [ ] Note version history
- [ ] Export notes as PDF
- [ ] Import flashcards from CSV
- [ ] Push notifications for planner tasks

---

## 👨‍💻 Developer

Built by **Shivam** — a student building the study tool he always wanted.

---

## 📄 License

This project is currently private and under active development.
