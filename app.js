import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, arrayRemove, deleteDoc, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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
const seccionLogin = document.getElementById('seccion-login');
const seccionPerfil = document.getElementById('seccion-perfil');
const nombreUsuario = document.getElementById('nombre-usuario');
const bioUsuario = document.getElementById('bio-usuario');
const imgPerfil = document.getElementById('img-perfil');
const feedPublicaciones = document.getElementById('feed-publicaciones');
const inputPublicacion = document.getElementById('input-publicacion');
const modalRepost = document.getElementById('modal-repost');
const btnPublicar = document.getElementById('btn-publicar');

let avatarSeleccionado = "https://api.dicebear.com/8.x/identicon/svg?seed=Lumina1";

// Filtro y Seguridad
function esContenidoLimpio(texto) {
    const prohibidas = ["insulto", "groseria", "odio"];
    return !prohibidas.some(p => texto.toLowerCase().includes(p));
}

// Auth Observer
onAuthStateChanged(auth, (user) => {
    if (user) {
        seccionLogin.style.display = 'none';
        seccionPerfil.style.display = 'block';
        cargarPerfilUsuario(user);
    } else {
        seccionLogin.style.display = 'block';
        seccionPerfil.style.display = 'none';
    }
});

async function cargarPerfilUsuario(user) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
        await setDoc(userRef, { nombre: user.displayName, bio: "", fotoUrl: avatarSeleccionado });
    }
    const datos = (await getDoc(userRef)).data();
    nombreUsuario.textContent = datos.nombre;
    bioUsuario.textContent = datos.bio || "Sin biografía...";
    imgPerfil.src = datos.fotoUrl;
}

// Acciones de Publicación
btnPublicar.addEventListener('click', async () => {
    if (!auth.currentUser) return alert("Inicia sesión para publicar.");
    const cont = inputPublicacion.value.trim();
    if (!cont || !esContenidoLimpio(cont)) return alert("Contenido no permitido.");
    
    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: nombreUsuario.textContent,
        userFoto: imgPerfil.src,
        content: cont,
        timestamp: serverTimestamp(),
        status: "approved",
        likes: [],
        reportCount: 0,
        isRepost: false
    });
    inputPublicacion.value = '';
});

// Lógica Repost
window.abrirRepost = (id, autor, cont) => {
    if (!auth.currentUser) return alert("Regístrate para citar mensajes.");
    document.getElementById('repost-id-original').value = id;
    document.getElementById('repost-preview').innerHTML = `<strong>${autor}:</strong> ${cont}`;
    modalRepost.style.display = 'flex';
};

document.getElementById('btn-confirmar-repost').addEventListener('click', async () => {
    const comentario = document.getElementById('input-repost-comentario').value.trim();
    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: nombreUsuario.textContent,
        userFoto: imgPerfil.src,
        content: comentario,
        timestamp: serverTimestamp(),
        status: "approved",
        likes: [],
        reportCount: 0,
        isRepost: true,
        originalQuote: document.getElementById('repost-preview').innerHTML
    });
    modalRepost.style.display = 'none';
});

// Likes y Reportes
window.darLike = async (postId, likes) => {
    const uid = auth.currentUser ? auth.currentUser.uid : "anon";
    const ref = doc(db, "publicaciones", postId);
    if (likes.includes(uid)) await updateDoc(ref, { likes: arrayRemove(uid) });
    else await updateDoc(ref, { likes: arrayUnion(uid) });
};

window.reportarPost = async (postId) => {
    if(!confirm("¿Reportar este mensaje?")) return;
    await updateDoc(doc(db, "publicaciones", postId), { reportCount: increment(1) });
};

// Renderizado Feed
onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), (snap) => {
    feedPublicaciones.innerHTML = '';
    snap.docs.map(d => ({id: d.id, ...d.data()}))
        .sort((a,b) => b.timestamp?.seconds - a.timestamp?.seconds)
        .forEach(post => {
            if (post.reportCount >= 3) return;
            const uid = auth.currentUser?.uid;
            const haDadoLike = (post.likes || []).includes(uid);
            
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <strong>${post.userName}</strong>
                <p>${post.content}</p>
                ${post.isRepost ? `<div class="quote-box">${post.originalQuote}</div>` : ''}
                <div class="post-actions">
                    <button onclick="window.darLike('${post.id}', ${JSON.stringify(post.likes || [])})" style="color:${haDadoLike ? '#5A9BD5' : '#777'}">👍 ${post.likes?.length || 0}</button>
                    <button onclick="window.abrirRepost('${post.id}', '${post.userName}', '${post.content.replace(/'/g, "\\'")}')">🔄 Citar</button>
                    <button onclick="window.reportarPost('${post.id}')" style="color:red">🚩</button>
                </div>`;
            feedPublicaciones.appendChild(div);
        });
});
