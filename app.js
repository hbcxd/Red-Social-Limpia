import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, arrayRemove, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAzb71Y1IHcGhWqRmX5E3-Va5258wrhdk0",
  authDomain: "red-social-de-dios.firebaseapp.com",
  projectId: "red-social-de-dios",
  storageBucket: "red-social-de-dios.firebasestorage.app",
  messagingSenderId: "256126083920",
  appId: "1:256126083920:web:f9265cbac956d1efe38255",
  measurementId: "G-5X7TMJVN71"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referencias del DOM
const modalPerfil = document.getElementById('modal-perfil');
const modalRepost = document.getElementById('modal-repost');
const feedPublicaciones = document.getElementById('feed-publicaciones');

// --- Lógica de Botones (Cancelación y Cierre) ---
window.cerrarModales = () => {
    modalPerfil.style.display = 'none';
    modalRepost.style.display = 'none';
};

// Asegurar que los botones de cancelar en el HTML llamen a esta función
document.getElementById('btn-cerrar-perfil')?.addEventListener('click', window.cerrarModales);
document.getElementById('btn-cerrar-repost')?.addEventListener('click', window.cerrarModales);

// --- Lógica de Likes (Corregida) ---
window.darLike = async (postId, likesArray) => {
    const postRef = doc(db, "publicaciones", postId);
    const uid = auth.currentUser ? auth.currentUser.uid : "anon_" + Math.random().toString(36).substr(2, 9);
    
    // Si el usuario ya está en el array, removemos. Si no, agregamos.
    if (likesArray.includes(uid)) {
        await updateDoc(postRef, { likes: arrayRemove(uid) });
    } else {
        await updateDoc(postRef, { likes: arrayUnion(uid) });
    }
};

// --- Lógica de Reportes ---
window.reportarPost = async (postId) => {
    if(!confirm("¿Reportar este contenido?")) return;
    await updateDoc(doc(db, "publicaciones", postId), { reportCount: increment(1) });
};

// --- Renderizado del Feed ---
onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), (snap) => {
    feedPublicaciones.innerHTML = '';
    snap.docs.map(d => ({id: d.id, ...d.data()}))
        .sort((a,b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
        .forEach(post => {
            if ((post.reportCount || 0) >= 3) return;
            
            const uid = auth.currentUser?.uid;
            const likes = post.likes || [];
            const haDadoLike = uid ? likes.includes(uid) : false;
            
            const div = document.createElement('div');
            div.className = 'card';
            // Pasamos el array de likes como un string JSON seguro
            const likesJSON = JSON.stringify(likes).replace(/"/g, '&quot;');
            
            div.innerHTML = `
                <strong>${post.userName}</strong>
                <p>${post.content}</p>
                ${post.isRepost ? `<div class="quote-box"><em>Cita:</em> ${post.originalQuote}</div>` : ''}
                <div class="post-actions">
                    <button onclick="window.darLike('${post.id}', ${JSON.stringify(likes)})" style="color:${haDadoLike ? '#5A9BD5' : '#777'}">
                        👍 ${likes.length}
                    </button>
                    <button onclick="window.abrirRepost('${post.id}', '${post.userName}', '${post.content.replace(/'/g, "\\'")}')">🔄 Citar</button>
                    <button onclick="window.reportarPost('${post.id}')" style="color:red">🚩</button>
                </div>`;
            feedPublicaciones.appendChild(div);
        });
});
