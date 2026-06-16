import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, arrayUnion, arrayRemove, serverTimestamp, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAzb71Y1IHcGhWqRmX5E3-Va5258wrhdk0",
  authDomain: "red-social-de-dios.firebaseapp.com",
  projectId: "red-social-de-dios",
  storageBucket: "red-social-de-dios.firebasestorage.app",
  messagingSenderId: "256126083920",
  appId: "1:256126083920:web:f9265cbac956d1efe38255"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let cachePublicaciones = {};
let usuarioActualData = null;
let filtroFeedActual = "global"; // global, oraciones, seguidos, guardados, mi-perfil
let terminoBusqueda = "";
let avatarSeleccionadoLocal = "https://api.iconify.design/fa6-solid:book-bible.svg?color=%235A9BD5";

onAuthStateChanged(auth, async (user) => {
    if (user) await verificarYProcederPerfil(user);
    else cambiarVisibilidadPlataforma(false);
    escucharFeed();
});

async function verificarYProcederPerfil(user) {
    const userRef = doc(db, "usuarios", user.uid);
    let snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        document.getElementById('modal-legal').style.display = 'flex';
        document.getElementById('check-legal').addEventListener('change', e => document.getElementById('btn-aceptar-legal').disabled = !e.target.checked);
        
        document.getElementById('btn-aceptar-legal').onclick = async () => {
            document.getElementById('modal-legal').style.display = 'none';
            await setDoc(userRef, {
                nombre: user.displayName || "Hermano",
                username: user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() + Math.floor(Math.random()*100),
                bio: "¡Hola! Acabo de unirme a Faro.",
                fotoUrl: avatarSeleccionadoLocal,
                seguidos: [],
                guardados: [], // Nuevo arreglo para favoritos
                privacidadNombre: "publico", privacidadBio: "todos",
                notifSeguidores: true, notifMensajes: true, modoOscuro: false,
                acuerdoAceptado: true
            });
            let nuevoSnap = await getDoc(userRef);
            inicializarDatosUsuarioLocal(nuevoSnap.data(), user.uid);
        };
    } else {
        inicializarDatosUsuarioLocal(snap.data(), user.uid);
    }
}

function inicializarDatosUsuarioLocal(data, uid) {
    usuarioActualData = { id: uid, guardados: [], ...data };
    cambiarVisibilidadPlataforma(true);
    if(usuarioActualData.modoOscuro) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('chk-modo-oscuro').checked = true;
    }
    actualizarInterfazUsuarioPropia();
}

function cambiarVisibilidadPlataforma(authOk) {
    document.getElementById('seccion-login').style.display = authOk ? 'none' : 'block';
    document.getElementById('seccion-plataforma').style.display = authOk ? 'block' : 'none';
}

function actualizarInterfazUsuarioPropia() {
    if (!usuarioActualData) return;
    document.getElementById('mi-perfil-nombre').textContent = usuarioActualData.nombre;
    document.getElementById('mi-perfil-tag').textContent = `@${usuarioActualData.username}`;
    document.getElementById('mi-perfil-bio').textContent = usuarioActualData.bio;
    document.getElementById('mi-perfil-foto').src = usuarioActualData.fotoUrl;
}

document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

// --- ENRUTADOR DE 5 PESTAÑAS ---
['global', 'oraciones', 'seguidos', 'guardados', 'perfil'].forEach(tab => {
    document.getElementById(`tab-${tab}`).addEventListener('click', (e) => {
        filtroFeedActual = tab === 'perfil' ? 'mi-perfil' : tab;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        
        document.getElementById('contenedor-creacion-post').style.display = (filtroFeedActual === "mi-perfil") ? "none" : "block";
        document.getElementById('bloque-perfil-propio').style.display = (filtroFeedActual === "mi-perfil") ? "block" : "none";
        escucharFeed();
    });
});

// --- MOTOR DE FEED ---
let desubscribirFeed = null;
function escucharFeed() {
    if (desubscribirFeed) desubscribirFeed();
    
    desubscribirFeed = onSnapshot(query(collection(db, "publicaciones"), where("status", "==", "approved")), async (snap) => {
        const feedContainer = document.getElementById('feed-publicaciones');
        feedContainer.innerHTML = '';
        cachePublicaciones = {};

        const usuariosSnaps = await getDocs(query(collection(db, "usuarios")));
        let autoresMap = {};
        usuariosSnaps.forEach(doc => { autoresMap[doc.id] = doc.data(); });

        let lista = snap.docs.map(d => {
            const data = d.data();
            const autorInfo = autoresMap[data.userId] || {};
            return { 
                id: d.id, ...data, 
                autorNombreFinal: autorInfo.privacidadNombre === "anonimo" ? "Miembro" : (autorInfo.nombre || "Hermano"),
                autorUsername: autorInfo.username || "miembro",
                autorFotoFinal: autorInfo.fotoUrl || avatarSeleccionadoLocal
            };
        });

        // Lógica de Filtros por Pestaña
        if (filtroFeedActual === "global") {
            lista = lista.filter(p => !p.isPrayer); // Solo posts normales
        } else if (filtroFeedActual === "oraciones") {
            lista = lista.filter(p => p.isPrayer); // Solo peticiones
        } else if (filtroFeedActual === "seguidos") {
            const listaSeguidos = usuarioActualData?.seguidos || [];
            lista = lista.filter(p => listaSeguidos.includes(p.userId) && !p.isPrayer);
        } else if (filtroFeedActual === "guardados") {
            const listaGuardados = usuarioActualData?.guardados || [];
            lista = lista.filter(p => listaGuardados.includes(p.id));
        } else if (filtroFeedActual === "mi-perfil") {
            lista = lista.filter(p => p.userId === auth.currentUser?.uid);
        }

        if (terminoBusqueda) lista = lista.filter(p => p.content.toLowerCase().includes(terminoBusqueda));
        lista.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if(lista.length === 0) {
            feedContainer.innerHTML = '<div class="card"><p style="text-align:center; font-size:13px; color: var(--text-light);">No hay publicaciones aquí...</p></div>';
            return;
        }

        lista.forEach(post => {
            cachePublicaciones[post.id] = post;
            const uid = auth.currentUser?.uid;
            const haDadoLike = (post.likes || []).includes(uid);
            const estaGuardado = (usuarioActualData?.guardados || []).includes(post.id);
            const esPropio = post.userId === uid;
            
            // Botón Dinámico: Orando vs Útil
            const btnPrincipal = post.isPrayer 
                ? `<button onclick="darLike('${post.id}')" class="action-btn" style="color:${haDadoLike ? 'var(--primary)' : 'var(--text-light)'}">🙏 Orando ${post.likes?.length || 0}</button>`
                : `<button onclick="darLike('${post.id}')" class="action-btn" style="color:${haDadoLike ? 'var(--primary)' : 'var(--text-light)'}">👍 Útil ${post.likes?.length || 0}</button>`;

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="profile-header">
                    <img src="${post.autorFotoFinal}" class="profile-pic">
                    <div class="user-meta"><strong>${post.autorNombreFinal}</strong><span>@${post.autorUsername}</span></div>
                </div>
                <p style="margin: 8px 0; font-size: 14px; line-height: 1.4;">${post.content}</p>
                ${post.isRepost ? `<div class="quote-box">${post.originalQuote}</div>` : ''}
                
                <div class="post-actions">
                    ${btnPrincipal}
                    <button onclick="abrirRepost('${post.id}')" class="action-btn">🔄 Citar</button>
                    <button onclick="alternarGuardado('${post.id}')" class="action-btn" style="color:${estaGuardado ? 'var(--primary)' : 'var(--text-light)'}">
                        ${estaGuardado ? '🔖 Guardado' : '🔖 Guardar'}
                    </button>
                </div>
            `;
            feedContainer.appendChild(div);
        });
    });
}

// --- CREAR PUBLICACIÓN / PETICIÓN ---
document.getElementById('btn-publicar').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const cont = document.getElementById('input-publicacion').value.trim();
    const esPeticion = document.getElementById('chk-peticion').checked;
    if (!cont) return;

    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        status: "approved", likes: [], content: cont,
        isRepost: false,
        isPrayer: esPeticion // Guardamos el tipo
    });

    document.getElementById('input-publicacion').value = '';
    document.getElementById('chk-peticion').checked = false;
});

// --- GUARDAR FAVORITOS ---
window.alternarGuardado = async (postId) => {
    if (!auth.currentUser || !usuarioActualData) return;
    const ref = doc(db, "usuarios", auth.currentUser.uid);
    const guardadosAct = usuarioActualData.guardados || [];
    
    if (guardadosAct.includes(postId)) {
        await updateDoc(ref, { guardados: arrayRemove(postId) });
        usuarioActualData.guardados = guardadosAct.filter(id => id !== postId);
    } else {
        await updateDoc(ref, { guardados: arrayUnion(postId) });
        usuarioActualData.guardados.push(postId);
    }
    escucharFeed(); // Refresca colores de botones
};

window.darLike = async (postId) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    const ref = doc(db, "publicaciones", postId);
    if ((cachePublicaciones[postId].likes || []).includes(uid)) await updateDoc(ref, { likes: arrayRemove(uid) });
    else await updateDoc(ref, { likes: arrayUnion(uid) });
};

// Modales y Ajustes (Omitido el código repetitivo de UI del perfil por concisión, se mantiene igual al paso anterior)
document.getElementById('btn-cerrar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'none');
document.getElementById('btn-editar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'flex');
