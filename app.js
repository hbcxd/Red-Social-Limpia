import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, arrayRemove, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// 1. --- MANEJO DE ESTADO DE USUARIO ---
onAuthStateChanged(auth, (user) => {
    const loginSec = document.getElementById('seccion-login');
    const perfilSec = document.getElementById('seccion-perfil');
    if (user) {
        loginSec.style.display = 'none';
        perfilSec.style.display = 'block';
        cargarPerfil(user);
    } else {
        loginSec.style.display = 'block';
        perfilSec.style.display = 'none';
    }
});

async function cargarPerfil(user) {
    const docSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (docSnap.exists()) {
        const data = docSnap.data();
        document.getElementById('nombre-usuario').textContent = data.nombre;
        document.getElementById('bio-usuario').textContent = data.bio || "Sin biografía...";
        document.getElementById('img-perfil').src = data.fotoUrl;
    }
}

// 2. --- EVENTOS DE BOTONES (Listeners) ---
document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));
document.getElementById('btn-cerrar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'none');
document.getElementById('btn-cerrar-repost').addEventListener('click', () => document.getElementById('modal-repost').style.display = 'none');
document.getElementById('btn-editar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'flex');

// 3. --- LÓGICA DE INTERACCIÓN (Global para HTML) ---
window.darLike = async (postId, likes) => {
    if (!auth.currentUser) return alert("Inicia sesión para dar like.");
    const ref = doc(db, "publicaciones", postId);
    const uid = auth.currentUser.uid;
    if (likes.includes(uid)) await updateDoc(ref, { likes: arrayRemove(uid) });
    else await updateDoc(ref, { likes: arrayUnion(uid) });
};

window.abrirRepost = (id, autor, cont) => {
    if (!auth.currentUser) return alert("Inicia sesión para citar.");
    document.getElementById('repost-id-original').value = id;
    document.getElementById('repost-preview').innerHTML = `<strong>${autor}:</strong> ${cont}`;
    document.getElementById('modal-repost').style.display = 'flex';
};

window.reportarPost = async (postId) => {
    if (confirm("¿Reportar este post?")) await updateDoc(doc(db, "publicaciones", postId), { reportCount: increment(1) });
};

// 4. --- FEED DINÁMICO ---
onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), (snap) => {
    const feed = document.getElementById('feed-publicaciones');
    feed.innerHTML = '';
    snap.docs.forEach(d => {
        const post = d.data();
        if ((post.reportCount || 0) >= 3) return;
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <strong>${post.userName}</strong>
            <p>${post.content}</p>
            ${post.isRepost ? `<div class="quote-box">Cita: ${post.originalQuote}</div>` : ''}
            <div class="post-actions">
                <button onclick="window.darLike('${d.id}', ${JSON.stringify(post.likes || [])})">👍 ${post.likes?.length || 0}</button>
                <button onclick="window.abrirRepost('${d.id}', '${post.userName}', '${post.content.replace(/'/g, "\\'")}')">🔄 Citar</button>
                <button onclick="window.reportarPost('${d.id}')" style="color:red">🚩</button>
            </div>`;
        feed.appendChild(div);
    });
});
