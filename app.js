import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// ⚠️ PEGA AQUÍ TU firebaseConfig EXACTAMENTE COMO LO TENÍAS ⚠️
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

let cachePublicaciones = {};
let usuarioActualData = null;
let mapaUsuariosGlobal = {}; 
let filtroFeedActual = "global";
let subFiltroPerfil = "publicaciones";

// --- 🔧 REGISTRO DEL SERVICE WORKER (FALTABA ESTO) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('Service Worker registrado con éxito.', reg.scope))
            .catch(err => console.error('Error al registrar el Service Worker:', err));
    });
}

// --- 📲 PWA INSTALACIÓN ---
let eventoInstalacion;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    document.getElementById('btn-instalar').style.display = 'block'; // Muestra el botón
});

document.getElementById('btn-instalar').addEventListener('click', async () => {
    if (eventoInstalacion) {
        eventoInstalacion.prompt();
        const { outcome } = await eventoInstalacion.userChoice;
        if (outcome === 'accepted') document.getElementById('btn-instalar').style.display = 'none';
        eventoInstalacion = null;
    }
});

// --- SESIÓN Y NAVEGACIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        document.getElementById('menu-navegacion').style.display = 'flex';
        await verificarYProcederPerfil(user);
    } else {
        cambiarVisibilidadPlataforma(false);
    }
    escucharFeed();
});

async function verificarYProcederPerfil(user) {
    const userRef = doc(db, "usuarios", user.uid);
    let snap = await getDoc(userRef);
    if (!snap.exists()) {
        await setDoc(userRef, {
            nombre: user.displayName || "Usuario",
            username: user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() + Math.floor(Math.random()*100),
            bio: "Uniendo propósitos.",
            fotoUrl: "", 
            seguidos: [], seguidores: [], guardados: [], privacidadNombre: "publico", modoOscuro: false
        });
        snap = await getDoc(userRef);
    }
    usuarioActualData = { id: user.uid, ...snap.data() };
    cambiarVisibilidadPlataforma(true);
    
    if(usuarioActualData.modoOscuro) document.documentElement.setAttribute('data-theme', 'dark');
    actualizarVistaPerfilPropio();
}

function actualizarVistaPerfilPropio() {
    document.getElementById('mi-perfil-nombre').textContent = usuarioActualData.nombre;
    document.getElementById('mi-perfil-tag').textContent = `@${usuarioActualData.username}`;
    document.getElementById('mi-perfil-bio').textContent = usuarioActualData.bio;
    document.getElementById('stat-seguidores').textContent = (usuarioActualData.seguidores || []).length;
    document.getElementById('stat-seguidos').textContent = (usuarioActualData.seguidos || []).length;
}

function cambiarVisibilidadPlataforma(authOk) {
    document.getElementById('seccion-login').style.display = authOk ? 'none' : 'block';
    document.getElementById('seccion-plataforma').style.display = authOk ? 'block' : 'none';
    document.getElementById('menu-navegacion').style.display = authOk ? 'flex' : 'none';
}

document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        e.target.classList.add('active');
        filtroFeedActual = e.target.getAttribute('data-tab');
        document.getElementById('contenedor-creacion-post').style.display = (filtroFeedActual === "perfil") ? "none" : "block";
        document.getElementById('bloque-perfil-propio').style.display = (filtroFeedActual === "perfil") ? "block" : "none";
        escucharFeed();
    });
});

document.getElementById('subtab-publicaciones').addEventListener('click', (e) => {
    subFiltroPerfil = "publicaciones";
    document.getElementById('subtab-citas').classList.remove('active');
    e.target.classList.add('active');
    escucharFeed();
});

document.getElementById('subtab-citas').addEventListener('click', (e) => {
    subFiltroPerfil = "citas";
    document.getElementById('subtab-publicaciones').classList.remove('active');
    e.target.classList.add('active');
    escucharFeed();
});

// --- MOTOR DE FEED ---
let desubscribirFeed = null;
function escucharFeed() {
    if (desubscribirFeed) desubscribirFeed();
    desubscribirFeed = onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), async (snap) => {
        const feedContainer = document.getElementById('feed-publicaciones');
        feedContainer.innerHTML = '';
        
        const usuariosSnaps = await getDocs(query(collection(db, "usuarios")));
        usuariosSnaps.forEach(doc => { mapaUsuariosGlobal[doc.id] = doc.data(); });

        let lista = snap.docs.map(d => {
            const data = d.data();
            const autorInfo = mapaUsuariosGlobal[data.userId] || {};
            const esPropio = data.userId === auth.currentUser?.uid;
            
            const nombreMostrar = (autorInfo.privacidadNombre === "anonimo" && !esPropio) 
                ? `@${autorInfo.username}` : (autorInfo.nombre || "Usuario");

            return { id: d.id, ...data, autorId: data.userId, autorNombreFeed: nombreMostrar, autorUsername: autorInfo.username };
        });

        if (filtroFeedActual === "global") lista = lista.filter(p => !p.isPrayer);
        else if (filtroFeedActual === "oraciones") lista = lista.filter(p => p.isPrayer);
        else if (filtroFeedActual === "seguidos") lista = lista.filter(p => (usuarioActualData?.seguidos || []).includes(p.userId));
        else if (filtroFeedActual === "guardados") lista = lista.filter(p => (usuarioActualData?.guardados || []).includes(p.id));
        else if (filtroFeedActual === "perfil") {
            lista = lista.filter(p => p.userId === auth.currentUser?.uid);
            if (subFiltroPerfil === "publicaciones") lista = lista.filter(p => !p.isRepost);
            else if (subFiltroPerfil === "citas") lista = lista.filter(p => p.isRepost);
        }

        lista.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        lista.forEach(post => {
            cachePublicaciones[post.id] = post;
            const uid = auth.currentUser?.uid;
            const haDadoLike = (post.likes || []).includes(uid);
            const estaGuardado = (usuarioActualData?.guardados || []).includes(post.id);
            
            const textoLike = post.isPrayer ? "Orando" : "Me gusta";
            const btnClassLike = haDadoLike ? "action-btn active" : "action-btn";
            const btnClassGuardar = estaGuardado ? "action-btn active" : "action-btn";

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="profile-header">
                    <div class="profile-pic"></div>
                    <div class="user-meta"><strong>${post.autorNombreFeed}</strong><span>@${post.autorUsername}</span></div>
                </div>
                <div class="post-content">${post.content}</div>
                ${post.isRepost ? `<div class="quote-box">${post.originalQuote}</div>` : ''}
                
                <div class="post-actions">
                    <button class="${btnClassLike}">${textoLike} ${(post.likes||[]).length}</button>
                    <button class="action-btn">Citar</button>
                    <button class="${btnClassGuardar}">${estaGuardado ? 'Guardado' : 'Guardar'}</button>
                </div>
            `;
            feedContainer.appendChild(div);
        });
    });
}
