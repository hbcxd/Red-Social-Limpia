import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, arrayRemove, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = { /* ... TU CONFIGURACIÓN ... */ };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// --- 1. AUTENTICACIÓN (Lo que faltaba) ---
onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('seccion-login').style.display = 'none';
        document.getElementById('seccion-perfil').style.display = 'block';
        cargarPerfil(user);
    } else {
        document.getElementById('seccion-login').style.display = 'block';
        document.getElementById('seccion-perfil').style.display = 'none';
    }
});

document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

async function cargarPerfil(user) {
    const userSnap = await getDoc(doc(db, "usuarios", user.uid));
    if (userSnap.exists()) {
        const d = userSnap.data();
        document.getElementById('nombre-usuario').textContent = d.nombre;
        document.getElementById('bio-usuario').textContent = d.bio;
        document.getElementById('img-perfil').src = d.fotoUrl;
    }
}

// --- 2. MODALES Y CIERRE ---
window.cerrarModales = () => {
    document.getElementById('modal-perfil').style.display = 'none';
    document.getElementById('modal-repost').style.display = 'none';
};
document.getElementById('btn-cerrar-perfil').addEventListener('click', window.cerrarModales);
document.getElementById('btn-cerrar-repost').addEventListener('click', window.cerrarModales);
document.getElementById('btn-editar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'flex');

// --- 3. LÓGICA DE INTERACCIÓN ---
window.abrirRepost = (id, autor, cont) => {
    if (!auth.currentUser) return alert("Inicia sesión primero");
    document.getElementById('repost-id-original').value = id;
    document.getElementById('repost-preview').innerHTML = `<strong>${autor}:</strong> ${cont}`;
    document.getElementById('modal-repost').style.display = 'flex';
};

window.darLike = async (postId, likesArray) => {
    const ref = doc(db, "publicaciones", postId);
    const uid = auth.currentUser ? auth.currentUser.uid : "anon";
    if (likesArray.includes(uid)) await updateDoc(ref, { likes: arrayRemove(uid) });
    else await updateDoc(ref, { likes: arrayUnion(uid) });
};

window.reportarPost = async (postId) => {
    await updateDoc(doc(db, "publicaciones", postId), { reportCount: increment(1) });
};

// --- 4. FEED ---
onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), (snap) => {
    feedPublicaciones.innerHTML = '';
    snap.forEach(doc => {
        const post = doc.data();
        const uid = auth.currentUser?.uid;
        const likes = post.likes || [];
        
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <strong>${post.userName}</strong>
            <p>${post.content}</p>
            <div class="post-actions">
                <button onclick="window.darLike('${doc.id}', ${JSON.stringify(likes)})">👍 ${likes.length}</button>
                <button onclick="window.abrirRepost('${doc.id}', '${post.userName}', '${post.content.replace(/'/g, "\\'")}')">🔄 Citar</button>
                <button onclick="window.reportarPost('${doc.id}')" style="color:red">🚩</button>
            </div>`;
        feedPublicaciones.appendChild(div);
    });
});
