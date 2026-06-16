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

// Memoria caché para evitar que las comillas rompan los botones
let cachePublicaciones = {};

// Generar una firma de identidad anónima permanente en el dispositivo
if (!localStorage.getItem('faro_anon_id')) {
    localStorage.setItem('faro_anon_id', 'anon_' + Math.random().toString(36).substring(2, 11));
}
const obtenerIdUsuarioActual = () => auth.currentUser ? auth.currentUser.uid : localStorage.getItem('faro_anon_id');

// Moderación básica
const palabrasProhibidas = ["insulto", "groseria", "odio"];
function esContenidoLimpio(texto) {
    const textoMin = texto.toLowerCase();
    return !palabrasProhibidas.some(palabra => textoMin.includes(palabra));
}

// 1. --- CONTROL DE ACCESO Y SESIÓN ---
onAuthStateChanged(auth, (user) => {
    const loginSec = document.getElementById('seccion-login');
    const perfilSec = document.getElementById('seccion-perfil');
    if (user) {
        loginSec.style.display = 'none';
        perfilSec.style.display = 'block';
        cargarPerfilUsuario(user);
    } else {
        loginSec.style.display = 'block';
        perfilSec.style.display = 'none';
    }
});

async function cargarPerfilUsuario(user) {
    const userRef = doc(db, "usuarios", user.uid);
    let userSnap = await getDoc(userRef);
    
    if (!userSnap.exists()) {
        await setDoc(userRef, {
            nombre: user.displayName || "Usuario de Faro",
            bio: "¡Bienvenido a Faro!",
            fotoUrl: user.photoURL || "https://api.dicebear.com/8.x/identicon/svg?seed=Lumina1"
        });
        userSnap = await getDoc(userRef);
    }
    
    const datos = userSnap.data();
    document.getElementById('nombre-usuario').textContent = datos.nombre;
    document.getElementById('bio-usuario').textContent = datos.bio;
    document.getElementById('img-perfil').src = datos.fotoUrl;
}

// Conectar botones de Autenticación
document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

// Controles visuales de Modales
document.getElementById('btn-editar-perfil').addEventListener('click', () => {
    document.getElementById('input-bio').value = document.getElementById('bio-usuario').textContent;
    document.getElementById('modal-perfil').style.display = 'flex';
});
document.getElementById('btn-cerrar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'none');
document.getElementById('btn-cerrar-repost').addEventListener('click', () => document.getElementById('modal-repost').style.display = 'none');

// Guardar cambios del Perfil
document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const nuevaBio = document.getElementById('input-bio').value.trim();
    if (!esContenidoLimpio(nuevaBio)) return alert("Tu biografía contiene palabras no permitidas.");
    
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), { bio: nuevaBio });
    document.getElementById('bio-usuario').textContent = nuevaBio || "Sin biografía aún...";
    document.getElementById('modal-perfil').style.display = 'none';
});


// 2. --- PUBLICACIÓN DE MENSAJES (¡Añadido!) ---
document.getElementById('btn-publicar').addEventListener('click', async () => {
    if (!auth.currentUser) return alert("Debes registrarte para publicar mensajes.");
    
    const contenido = document.getElementById('input-publicacion').value.trim();
    if (!contenido) return;
    if (!esContenidoLimpio(contenido)) return alert("Tu mensaje contiene palabras inapropiada.");

    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: document.getElementById('nombre-usuario').textContent,
        userFoto: document.getElementById('img-perfil').src,
        content: contenido,
        timestamp: serverTimestamp(),
        status: "approved",
        reportCount: 0,
        likes: [],
        isRepost: false
    });
    document.getElementById('input-publicacion').value = '';
});


// 3. --- PROCESO DE CITAS / REPOSTS (¡Añadido!) ---
document.getElementById('btn-confirmar-repost').addEventListener('click', async () => {
    if (!auth.currentUser) return alert("Inicia sesión para compartir.");
    
    const comentario = document.getElementById('input-repost-comentario').value.trim();
    if (!esContenidoLimpio(comentario)) return alert("Tu comentario contiene expresiones no permitidas.");
    const idOriginal = document.getElementById('repost-id-original').value;

    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: document.getElementById('nombre-usuario').textContent,
        userFoto: document.getElementById('img-perfil').src,
        content: comentario,
        timestamp: serverTimestamp(),
        status: "approved",
        reportCount: 0,
        likes: [],
        isRepost: true,
        originalQuote: document.getElementById('repost-preview').innerHTML
    });

    document.getElementById('modal-repost').style.display = 'none';
    document.getElementById('input-repost-comentario').value = '';
});


// 4. --- FUNCIONES GLOBALES ASIGNADAS A WINDOW ---
Object.assign(window, {
    darLike: async (postId) => {
        const post = cachePublicaciones[postId];
        if (!post) return;

        const postRef = doc(db, "publicaciones", postId);
        const uid = obtenerIdUsuarioActual();
        const likes = post.likes || [];

        if (likes.includes(uid)) {
            await updateDoc(postRef, { likes: arrayRemove(uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(uid) });
        }
    },

    abrirRepost: (postId) => {
        if (!auth.currentUser) {
            return alert("¡Únete a Faro! Regístrate para poder realizar repost y compartir tu mensaje con la comunidad.");
        }
        const post = cachePublicaciones[postId];
        if (!post) return;

        document.getElementById('repost-id-original').value = postId;
        document.getElementById('repost-preview').innerHTML = `<strong>${post.userName}:</strong> ${post.content}`;
        document.getElementById('modal-repost').style.display = 'flex';
    },

    reportarPost: async (postId) => {
        if (confirm("¿Deseas reportar esta publicación por contenido inapropiado?")) {
            await updateDoc(doc(db, "publicaciones", postId), { reportCount: increment(1) });
            alert("Publicación reportada bajo revisión.");
        }
    }
});


// 5. --- FEED CON RENDERIZADO SEGURO ---
onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), (snap) => {
    const feedPublicaciones = document.getElementById('feed-publicaciones');
    feedPublicaciones.innerHTML = '';
    
    // Limpiar y actualizar la caché con los nuevos datos recibidos
    cachePublicaciones = {};
    
    const postsArray = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    postsArray.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    postsArray.forEach((post) => {
        if ((post.reportCount || 0) >= 3) return; // Filtro automático de moderación

        // Guardamos el objeto en caché usando su ID como llave
        cachePublicaciones[post.id] = post;

        const uid = obtenerIdUsuarioActual();
        const likes = post.likes || [];
        const haDadoLike = likes.includes(uid);
        
        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="profile-header" style="margin-bottom: 10px; display: flex; align-items: center; gap: 10px;">
                <img src="${post.userFoto || 'https://api.dicebear.com/8.x/identicon/svg?seed=Lumina1'}" class="profile-pic" style="width: 40px; height: 40px; border-radius: 50%;">
                <strong>${post.userName}</strong>
            </div>
            <p style="font-size: 15px; margin: 8px 0;">${post.content}</p>
            ${post.isRepost ? `<div class="quote-box">${post.originalQuote}</div>` : ''}
            
            <div class="post-actions">
                <button onclick="darLike('${post.id}')" class="action-btn" style="color: ${haDadoLike ? '#5A9BD5' : '#7F8C8D'}; font-weight: ${haDadoLike ? 'bold' : 'normal'}">
                    👍 ${likes.length}
                </button>
                <button onclick="abrirRepost('${post.id}')" class="action-btn">
                    🔄 Citar
                </button>
                <button onclick="reportarPost('${post.id}')" class="action-btn" style="color: #7F8C8D;">
                    🚩 Reportar
                </button>
            </div>
        `;
        feedPublicaciones.appendChild(div);
    });
});
