```html
<script type="module">
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
  import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-analytics.js";

  const firebaseConfig = {
    apiKey: "AIzaSyDQXJZKu7oDsUUlsHlRPWE6RfgCApZ3Lts",
    authDomain: "flora-91d3e.firebaseapp.com",
    projectId: "flora-91d3e",
    storageBucket: "flora-91d3e.firebasestorage.app",
    messagingSenderId: "780458657637",
    appId: "1:780458657637:web:6c80e387a9579ed835038c",
    measurementId: "G-CRP9QKPXGQ"
  };

  window.FLORA_FIREBASE_CONFIG = firebaseConfig;

  const app = initializeApp(firebaseConfig);
  const analytics = getAnalytics(app);
</script>
```
