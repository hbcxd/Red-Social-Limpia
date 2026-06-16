import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, deleteDoc, serverTimestamp, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Referencias HTML
const seccionLogin = document.getElementById('seccion-login');
const seccionPerfil = document.getElementById('seccion-perfil');
const nombreUsuario = document.getElementById('nombre-usuario');
const bioUsuario = document.getElementById('bio-usuario');
const imgPerfil = document.getElementById('img-perfil');
const feedPublicaciones = document.getElementById('feed-publicaciones');
const inputPublicacion = document.getElementById('input-publicacion');
const modalPerfil = document.getElementById('modal-perfil');
const modalRepost = document.getElementById('modal-repost');

let avatarSeleccionado = "https://api.dicebear.com/8.x/identicon/svg?seed=Lumina1";

// Funciones Auxiliares
const palabrasProhibidas = ["insulto", "groseria", "odio"];
function esContenidoLimpio(texto) {
    const textoMin = texto.toLowerCase();
    return !palabrasProhibidas.some(palabra => textoMin.includes(palabra));
}

// Autenticación
document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

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
    if (userSnap.exists()) {
        const datos = userSnap.data();
        nombreUsuario.textContent = datos.nombre;
        bioUsuario.textContent = datos.bio || "Sin biografía aún...";
        imgPerfil.src = datos.fotoUrl || avatarSeleccionado;
    } else {
        await setDoc(userRef, { nombre: user.displayName, bio: "", fotoUrl: avatarSeleccionado, email: user.email });
        nombreUsuario.textContent = user.displayName;
        imgPerfil.src = avatarSeleccionado;
    }
}

// Acciones (Publicar, Repost, Like)
document.getElementById('btn-publicar').addEventListener('click', async () => {
    if (!auth.currentUser) return alert("Para publicar, primero debes iniciar sesión.");
    const contenido = inputPublicacion.value.trim();
    if (!contenido || !esContenidoLimpio(contenido)) return alert("Contenido no permitido.");
    
    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: nombreUsuario.textContent,
        userFoto: imgPerfil.src,
        content: contenido,
        timestamp: serverTimestamp(),
        status: "approved", likes: [], isRepost: false
    });
    inputPublicacion.value = '';
});

window.abrirRepost = function(id, autorOriginal, contenidoOriginal) {
    if (!auth.currentUser) return alert("Regístrate para hacer repost.");
    document.getElementById('repost-id-original').value = id;
    document.getElementById('repost-preview').innerHTML = `<strong>${autorOriginal}:</strong> ${contenidoOriginal}`;
    modalRepost.style.display = 'flex';
};

window.darLike = async function(postId, likesStr) {
    const postRef = doc(db, "publicaciones", postId);
    const uid = auth.currentUser ? auth.currentUser.uid : "anonimo_" + Math.floor(Math.random() * 1000);
    const likes = JSON.parse(likesStr);
    if (likes.includes(uid)) await updateDoc(postRef, { likes: arrayRemove(uid) });
    else await updateDoc(postRef, { likes: arrayUnion(uid) });
};

// Renderizado del Feed
onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), (snapshot) => {
    feedPublicaciones.innerHTML = '';
    snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
        .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
        .forEach((post) => {
            const uid = auth.currentUser ? auth.currentUser.uid : null;
            const haDadoLike = uid ? (post.likes || []).includes(uid) : false;
            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <strong>${post.userName}</strong>
                <p>${post.content}</p>
                <div class="post-actions">
                    <button onclick="window.darLike('${post.id}', '${JSON.stringify(post.likes || [])}')" style="color: ${haDadoLike ? '#5A9BD5' : '#7F8C8D'}">👍 ${post.likes?.length || 0}</button>
                    <button onclick="window.abrirRepost('${post.id}', '${post.userName}', '${post.content.replace(/'/g, "\\'")}')">🔄 Citar</button>
                </div>`;
            feedPublicaciones.appendChild(div);
        });
});
