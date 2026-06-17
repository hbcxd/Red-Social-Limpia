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
let mapaUsuariosGlobal = {}; // Para el modal de visita
let filtroFeedActual = "global";
let terminoBusqueda = "";
let avatarSeleccionadoLocal = "https://api.iconify.design/fa6-solid:book-bible.svg?color=%235A9BD5";

// --- GESTIÓN DE PWA E INSTALACIÓN ---
let eventoInstalacion;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    document.getElementById('btn-instalar').style.display = 'block';
});

document.getElementById('btn-instalar').addEventListener('click', async () => {
    if (eventoInstalacion) {
        eventoInstalacion.prompt();
        const { outcome } = await eventoInstalacion.userChoice;
        if (outcome === 'accepted') document.getElementById('btn-instalar').style.display = 'none';
        eventoInstalacion = null;
    }
});

// --- SERVICE WORKER Y ACTUALIZACIONES ---
let nuevoWorker;
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
            nuevoWorker = reg.installing;
            nuevoWorker.addEventListener('statechange', () => {
                if (nuevoWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    // Verificación de configuración de red (Simulada para Web API, base para nativo)
                    const redActual = navigator.connection ? navigator.connection.type : 'unknown';
                    const pref = usuarioActualData?.configRed || 'todos';
                    if (pref === 'todos' || (pref === 'wifi' && redActual === 'wifi')) {
                        document.getElementById('banner-actualizacion').style.display = 'block';
                    }
                }
            });
        });
    });
}

window.recargarParaActualizar = () => {
    if (nuevoWorker) nuevoWorker.postMessage({ action: 'skipWaiting' });
    window.location.reload();
};

// --- ALGORITMO VERSÍCULO DIARIO (ZONA HORARIA DEL DISPOSITIVO) ---
const bibliotecaVersiculos = [
    "Jehová es mi pastor; nada me faltará. - Salmo 23:1",
    "Todo lo puedo en Cristo que me fortalece. - Filipenses 4:13",
    "El amor es sufrido, es benigno... - 1 Corintios 13:4",
    "Lámpara es a mis pies tu palabra, y lumbrera a mi camino. - Salmo 119:105",
    "La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da. - Juan 14:27",
    "Es, pues, la fe la certeza de lo que se espera... - Hebreos 11:1"
];

function cargarVersiculoDelDia() {
    // Genera una cadena única basada en la fecha LOCAL del dispositivo
    const hoy = new Date();
    const cadenaFechaLocal = `${hoy.getFullYear()}-${hoy.getMonth()}-${hoy.getDate()}`;
    
    // Convertimos la fecha en un número para elegir consistentemente el índice del versículo
    let suma = 0;
    for(let i=0; i<cadenaFechaLocal.length; i++) suma += cadenaFechaLocal.charCodeAt(i);
    
    const indice = suma % bibliotecaVersiculos.length;
    document.getElementById('texto-versiculo').textContent = bibliotecaVersiculos[indice];
}

// --- SESIÓN Y USUARIOS ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        cargarVersiculoDelDia();
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
            nombre: user.displayName || "Hermano",
            username: user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, "").toLowerCase() + Math.floor(Math.random()*100),
            bio: "¡Hola! Acabo de unirme a Faro.",
            fotoUrl: avatarSeleccionadoLocal,
            seguidos: [], guardados: [], privacidadNombre: "publico", modoOscuro: false, configRed: "todos"
        });
        snap = await getDoc(userRef);
    }
    usuarioActualData = { id: user.uid, ...snap.data() };
    cambiarVisibilidadPlataforma(true);
    
    if(usuarioActualData.modoOscuro) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('chk-modo-oscuro').checked = true;
    }
    document.getElementById('mi-perfil-nombre').textContent = usuarioActualData.nombre;
    document.getElementById('mi-perfil-tag').textContent = `@${usuarioActualData.username}`;
    document.getElementById('mi-perfil-bio').textContent = usuarioActualData.bio;
    document.getElementById('mi-perfil-foto').src = usuarioActualData.fotoUrl;
}

function cambiarVisibilidadPlataforma(authOk) {
    document.getElementById('seccion-login').style.display = authOk ? 'none' : 'block';
    document.getElementById('seccion-plataforma').style.display = authOk ? 'block' : 'none';
    document.getElementById('seccion-versiculo').style.display = authOk ? 'block' : 'none';
}

document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

// --- ENRUTADOR ---
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

// --- MOTOR DE FEED Y LÓGICA DE PRIVACIDAD ---
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
            
            // LOGICA DE PRIVACIDAD EN EL FEED: Si es anónimo y no soy yo, oculta el nombre.
            const nombreMostrar = (autorInfo.privacidadNombre === "anonimo" && !esPropio) 
                ? "Miembro de Faro" : (autorInfo.nombre || "Hermano");

            return { 
                id: d.id, ...data, 
                autorId: data.userId,
                autorNombreFeed: nombreMostrar,
                autorUsername: autorInfo.username || "miembro",
                autorFotoFinal: autorInfo.fotoUrl || avatarSeleccionadoLocal
            };
        });

        if (filtroFeedActual === "global") lista = lista.filter(p => !p.isPrayer);
        else if (filtroFeedActual === "oraciones") lista = lista.filter(p => p.isPrayer);
        else if (filtroFeedActual === "seguidos") lista = lista.filter(p => (usuarioActualData?.seguidos || []).includes(p.userId));
        else if (filtroFeedActual === "guardados") lista = lista.filter(p => (usuarioActualData?.guardados || []).includes(p.id));
        else if (filtroFeedActual === "mi-perfil") lista = lista.filter(p => p.userId === auth.currentUser?.uid);

        lista.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        lista.forEach(post => {
            cachePublicaciones[post.id] = post;
            const estaGuardado = (usuarioActualData?.guardados || []).includes(post.id);
            const btnLike = post.isPrayer 
                ? `<button class="action-btn">🙏 Orando ${(post.likes||[]).length}</button>`
                : `<button class="action-btn">👍 Útil ${(post.likes||[]).length}</button>`;

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="profile-header" onclick="abrirPerfilVisitante('${post.autorId}')">
                    <img src="${post.autorFotoFinal}" class="profile-pic">
                    <div class="user-meta"><strong>${post.autorNombreFeed}</strong><span>@${post.autorUsername}</span></div>
                </div>
                <p style="margin: 8px 0; font-size: 14px;">${post.content}</p>
                <div class="post-actions">
                    ${btnLike}
                    <button onclick="alternarGuardado('${post.id}')" class="action-btn" style="color:${estaGuardado ? 'var(--primary)' : 'var(--text-light)'}">🔖 ${estaGuardado ? 'Guardado' : 'Guardar'}</button>
                </div>
            `;
            feedContainer.appendChild(div);
        });
    });
}

// --- VISITA A PERFIL DE TERCEROS (Ignora Privacidad) ---
window.abrirPerfilVisitante = (uid) => {
    const dataReal = mapaUsuariosGlobal[uid];
    if(!dataReal) return;
    // Aquí siempre se muestra el nombre real, independientemente del ajuste "anónimo" para el feed.
    document.getElementById('visita-foto').src = dataReal.fotoUrl || avatarSeleccionadoLocal;
    document.getElementById('visita-nombre').textContent = dataReal.nombre;
    document.getElementById('visita-tag').textContent = `@${dataReal.username}`;
    document.getElementById('visita-bio').textContent = dataReal.bio || "Sin descripción.";
    document.getElementById('modal-visitante').style.display = 'flex';
};
document.getElementById('btn-cerrar-visitante').addEventListener('click', () => document.getElementById('modal-visitante').style.display = 'none');

// --- CREAR PUBLICACIÓN ---
document.getElementById('btn-publicar').addEventListener('click', async () => {
    const cont = document.getElementById('input-publicacion').value.trim();
    if (!cont) return;
    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid, timestamp: serverTimestamp(), status: "approved",
        likes: [], content: cont, isRepost: false, isPrayer: document.getElementById('chk-peticion').checked
    });
    document.getElementById('input-publicacion').value = '';
    document.getElementById('chk-peticion').checked = false;
});

window.alternarGuardado = async (postId) => {
    const ref = doc(db, "usuarios", auth.currentUser.uid);
    if ((usuarioActualData.guardados || []).includes(postId)) {
        await updateDoc(ref, { guardados: arrayRemove(postId) });
        usuarioActualData.guardados = usuarioActualData.guardados.filter(id => id !== postId);
    } else {
        await updateDoc(ref, { guardados: arrayUnion(postId) });
        usuarioActualData.guardados.push(postId);
    }
    escucharFeed();
};

// --- AJUSTES DE PERFIL ---
window.seleccionarAvatar = (el) => {
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
    el.classList.add('selected');
    avatarSeleccionadoLocal = el.src;
};

document.getElementById('btn-editar-perfil').addEventListener('click', () => {
    document.getElementById('input-nombre').value = usuarioActualData.nombre;
    document.getElementById('input-username').value = usuarioActualData.username;
    document.getElementById('input-bio').value = usuarioActualData.bio;
    document.getElementById('select-privacidad-nombre').value = usuarioActualData.privacidadNombre || "publico";
    document.getElementById('config-red').value = usuarioActualData.configRed || "todos";
    document.getElementById('modal-perfil').style.display = 'flex';
});

document.getElementById('btn-cerrar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'none');

document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
    const objActualizaciones = {
        nombre: document.getElementById('input-nombre').value,
        username: document.getElementById('input-username').value,
        bio: document.getElementById('input-bio').value,
        fotoUrl: avatarSeleccionadoLocal,
        privacidadNombre: document.getElementById('select-privacidad-nombre').value,
        modoOscuro: document.getElementById('chk-modo-oscuro').checked,
        configRed: document.getElementById('config-red').value
    };
    
    await updateDoc(doc(db, "usuarios", auth.currentUser.uid), objActualizaciones);
    Object.assign(usuarioActualData, objActualizaciones);
    
    if(objActualizaciones.modoOscuro) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');
    
    document.getElementById('mi-perfil-nombre').textContent = usuarioActualData.nombre;
    document.getElementById('mi-perfil-tag').textContent = `@${usuarioActualData.username}`;
    document.getElementById('mi-perfil-bio').textContent = usuarioActualData.bio;
    document.getElementById('modal-perfil').style.display = 'none';
    escucharFeed();
});
