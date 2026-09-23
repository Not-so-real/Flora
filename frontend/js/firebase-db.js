// ============================================================
//  Flora — Firestore Database Utility
//  Common functions for database operations.
// ============================================================

// Initialize Firestore
const db = firebase.firestore();

/**
 * Helper to get a collection reference scoped to the current user.
 * Paths will be like: users/{uid}/{collectionName}
 */
function getUserCollection(collectionName) {
    const user = firebase.auth().currentUser;
    if (!user) return null;
    return db.collection("users").doc(user.uid).collection(collectionName);
}

/**
 * Saves or updates a document in a user's collection.
 */
async function saveToCloud(collection, data) {
    const colRef = getUserCollection(collection);
    if (!colRef) throw new Error("User not authenticated");

    const id = data.id;
    return colRef.doc(id).set({
        ...data,
        updatedAt: data.updatedAt || Date.now()
    }, { merge: true });
}

/**
 * Deletes a document from a user's collection.
 */
async function deleteFromCloud(collection, id) {
    const colRef = getUserCollection(collection);
    if (!colRef) throw new Error("User not authenticated");
    return colRef.doc(id).delete();
}

/**
 * Fetches all documents from a user's collection once.
 */
async function fetchFromCloud(collection) {
    const colRef = getUserCollection(collection);
    if (!colRef) return [];
    
    const snapshot = await colRef.get();
    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
    }));
}

/**
 * Listens for live changes in a user's collection.
 * Very powerful for keeping Dashboard/Sidebar in sync!
 */
function onCloudUpdate(collection, callback) {
    const colRef = getUserCollection(collection);
    if (!colRef) return () => {}; // No-op cleanup

    return colRef.onSnapshot(snapshot => {
        const items = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        callback(items);
    }, error => {
        console.error(`Error listening to ${collection}:`, error);
    });
}
