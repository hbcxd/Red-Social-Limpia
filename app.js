import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, arrayRemove, serverTimestamp, setDoc, getDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Estado de la App
let cachePublicaciones = {};
let usuarioActualData = null;
let filtroFeedActual = "global"; // global o seguidos
let terminoBusqueda = "";
let avatarSeleccionadoLocal = "https://api.dicebear.com/8.x/lorelei/svg?seed=Faro1";

// Base de Datos de Versículos Bíblicos según Algoritmo Temático
const libreriaVersiculos = {
    paz: "Jehová es mi pastor; nada me faltará. En lugares de delicados pastos me hará descansar... - Salmo 23:1-2",
    amor: "El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece... - 1 Corintios 13:4",
    fe: "Es, pues, la fe la certeza de lo que se espera, la convicción de lo que no se ve. - Hebreos 11:1",
    esperanza: "Porque yo sé los pensamientos que tengo acerca de vosotros, dice Jehová, pensamientos de paz, y no de mal... - Jeremías 29:11",
    fortaleza: "Todo lo puedo en Cristo que me fortalece. - Filipenses 4:13",
    general: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino. - Salmo 119:105"
};

// --- CONTROL DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    const loginSec = document.getElementById('seccion-login');
    const plataformaSec = document.getElementById('seccion-plataforma');
    const versiculoSec = document.getElementById('seccion-versiculo');
    
    if (user) {
        loginSec.style.display = 'none';
        plataformaSec.style.display = 'block';
        versiculoSec.style.display = 'block';
        await cargarOcrearPerfil(user);
        procesarAlgoritmoYVersiculo();
    } else {
        loginSec.style.display = 'block';
        plataformaSec.style.display = 'none';
        versiculoSec.style.display = 'none';
        usuarioActualData = null;
    }
    escucharFeed();
});

async function cargarOcrearPerfil(user) {
    const userRef = doc(db, "usuarios", user.uid);
    let snap = await getDoc(userRef);
    
    if (!snap.exists()) {
        const usernameSugerido = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, "") + Math.floor(Math.random() * 100);
        await setDoc(userRef, {
            nombre: user.displayName || "Hermano en la Fe",
            username: usernameSugerido.toLowerCase(),
            bio: "¡Bienvenido a mi cuenta en Faro!",
            fotoUrl: avatarSeleccionadoLocal,
            seguidos: [],
            intereses: { paz: 1, amor: 1, fe: 1, fortaleza: 1, esperanza: 1 } // Intereses iniciales balanceados
        });
        snap = await getDoc(userRef);
    }
    
    usuarioActualData = { id: user.uid, ...snap.data() };
    document.getElementById('nombre-usuario').textContent = usuarioActualData.nombre;
    document.getElementById('tag-usuario').textContent = `@${usuarioActualData.username}`;
    document.getElementById('bio-usuario').textContent = usuarioActualData.bio;
    document.getElementById('img-perfil').src = usuarioActualData.fotoUrl;
    avatarSeleccionadoLocal = usuarioActualData.fotoUrl;
}

// Interacción de Auth Básica
document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

// --- MODAL DE PERFIL Y CONTROL DE USERNAME ÚNICO ---
document.getElementById('btn-editar-perfil').addEventListener('click', () => {
    if (!usuarioActualData) return;
    document.getElementById('input-nombre').value = usuarioActualData.nombre;
    document.getElementById('input-username').value = usuarioActualData.username;
    document.getElementById('input-bio').value = usuarioActualData.bio;
    
    // Marcar avatar actual
    document.querySelectorAll('.avatar-option').forEach(img => {
        if(img.src === avatarSeleccionadoLocal) img.classList.add('selected');
        else img.classList.remove('selected');
    });
    
    document.getElementById('modal-perfil').style.display = 'flex';
});

document.getElementById('btn-cerrar-perfil').addEventListener('click', () => document.getElementById('modal-perfil').style.display = 'none');

window.seleccionarAvatar = function(elemento) {
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
    elemento.classList.add('selected');
    avatarSeleccionadoLocal = elemento.src;
};

document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    
    const nuevoNombre = document.getElementById('input-nombre').value.trim();
    const nuevoUsername = document.getElementById('input-username').value.trim().toLowerCase().replace(/\s+/g, '');
    const nuevaBio = document.getElementById('input-bio').value.trim();
    
    if (!nuevoNombre || !nuevoUsername) return alert("El nombre y el usuario no pueden estar vacíos.");

    // Validación de unicidad de Username
    if (nuevoUsername !== usuarioActualData.username) {
        const qUsername = query(collection(db, "usuarios"), where("username", "==", nuevoUsername));
        const snapCheck = await getDocs(qUsername);
        if (!snapCheck.empty) {
            return alert("Este nombre de usuario ya está tomado por otro miembro. Prueba con otro diferente.");
        }
    }

    const userRef = doc(db, "usuarios", auth.currentUser.uid);
    await updateDoc(userRef, {
        nombre: nuevoNombre,
        username: nuevoUsername,
        bio: nuevaBio,
        fotoUrl: avatarSeleccionadoLocal
    });

    // Actualizar estado local
    usuarioActualData.nombre = nuevoNombre;
    usuarioActualData.username = nuevoUsername;
    usuarioActualData.bio = nuevaBio;
    usuarioActualData.fotoUrl = avatarSeleccionadoLocal;

    // Refrescar UI superior
    document.getElementById('nombre-usuario').textContent = nuevoNombre;
    document.getElementById('tag-usuario').textContent = `@${nuevoUsername}`;
    document.getElementById('bio-usuario').textContent = nuevaBio;
    document.getElementById('img-perfil').src = avatarSeleccionadoLocal;

    document.getElementById('modal-perfil').style.display = 'none';
});

// --- SISTEMA DE ALGORITMO Y PALABRA DIARIA ---
function rastrearInteresesDelContenido(texto) {
    if (!auth.currentUser || !usuarioActualData) return;
    const txt = texto.toLowerCase();
    let cambios = {};
    
    if(txt.includes("paz") || txt.includes("tranquilidad") || txt.includes("calma")) cambios["intereses.paz"] = increment(1);
    if(txt.includes("amor") || txt.includes("amar") || txt.includes("bondad")) cambios["intereses.amor"] = increment(1);
    if(txt.includes("fe") || txt.includes("creer") || txt.includes("confianza")) cambios["intereses.fe"] = increment(1);
    if(txt.includes("esperanza") || txt.includes("futuro") || txt.includes("promesa")) cambios["intereses.esperanza"] = increment(1);
    if(txt.includes("fuerza") || txt.includes("fortaleza") || txt.includes("valiente")) cambios["intereses.fortaleza"] = increment(1);
    
    if (Object.keys(cambios).length > 0) {
        updateDoc(doc(db, "usuarios", auth.currentUser.uid), cambios);
    }
}

async function procesarAlgoritmoYVersiculo() {
    if (!auth.currentUser) return;
    const snap = await getDoc(doc(db, "usuarios", auth.currentUser.uid));
    const intereses = snap.data().intereses || { general: 1 };
    
    // Encontrar la categoría con mayor puntuación
    let categoriaMaxima = "general";
    let valorMaximo = 0;
    
    Object.entries(intereses).forEach(([cat, val]) => {
        if (val > valorMaximo) {
            valorMaximo = val;
            categoriaMaxima = cat;
        }
    });

    document.getElementById('texto-versiculo').textContent = libreriaVersiculos[categoriaMaxima] || libreriaVersiculos.general;
}

// --- PUBLICAR Y REPOST ---
document.getElementById('btn-publicar').addEventListener('click', async () => {
    if (!auth.currentUser) return alert("Inicia sesión para compartir.");
    const cont = document.getElementById('input-publicacion').value.trim();
    if (!cont) return;

    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: usuarioActualData.nombre,
        userUsername: usuarioActualData.username,
        userFoto: usuarioActualData.fotoUrl,
        content: cont,
        timestamp: serverTimestamp(),
        status: "approved",
        reportCount: 0,
        likes: [],
        isRepost: false
    });

    document.getElementById('input-publicacion').value = '';
    rastrearInteresesDelContenido(cont);
});

document.getElementById('btn-cerrar-repost').addEventListener('click', () => document.getElementById('modal-repost').style.display = 'none');

document.getElementById('btn-confirmar-repost').addEventListener('click', async () => {
    const comentario = document.getElementById('input-repost-comentario').value.trim();
    const idOriginal = document.getElementById('repost-id-original').value;

    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        userName: usuarioActualData.nombre,
        userUsername: usuarioActualData.username,
        userFoto: usuarioActualData.fotoUrl,
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
    rastrearInteresesDelContenido(comentario);
});

// --- FUNCIONES ASIGNADAS AL ENTORNO GLOBAL ---
Object.assign(window, {
    darLike: async (postId) => {
        const uid = auth.currentUser ? auth.currentUser.uid : "anon_visitante";
        const post = cachePublicaciones[postId];
        if (!post) return;

        const ref = doc(db, "publicaciones", postId);
        if ((post.likes || []).includes(uid)) {
            await updateDoc(ref, { likes: arrayRemove(uid) });
        } else {
            await updateDoc(ref, { likes: arrayUnion(uid) });
            rastrearInteresesDelContenido(post.content); // Aprende de lo que le das Me Gusta
        }
    },

    abrirRepost: (postId) => {
        if (!auth.currentUser) return alert("Regístrate en Faro para poder citar.");
        const post = cachePublicaciones[postId];
        if (!post) return;

        document.getElementById('repost-id-original').value = postId;
        document.getElementById('repost-preview').innerHTML = `<strong>@${post.userUsername || 'miembro'}:</strong> ${post.content}`;
        document.getElementById('modal-repost').style.display = 'flex';
    },

    reportarPost: async (postId) => {
        if (confirm("¿Quieres reportar este mensaje?")) {
            await updateDoc(doc(db, "publicaciones", postId), { reportCount: increment(1) });
        }
    },

    alternarSeguir: async (autorId) => {
        if (!auth.currentUser || !usuarioActualData) return alert("Inicia sesión para seguir cuentas.");
        const refPropia = doc(db, "usuarios", auth.currentUser.uid);
        
        const yaLoSigue = (usuarioActualData.seguidos || []).includes(autorId);
        if (yaLoSigue) {
            await updateDoc(refPropia, { seguidos: arrayRemove(autorId) });
            usuarioActualData.seguidos = usuarioActualData.seguidos.filter(id => id !== autorId);
        } else {
            await updateDoc(refPropia, { seguidos: arrayUnion(autorId) });
            usuarioActualData.seguidos.push(autorId);
        }
        escucharFeed(); // Re-renderizar feed con prioridades actualizadas
    }
});

// --- GESTIÓN DE NAVEGACIÓN Y BÚSQUEDA ---
document.getElementById('tab-global').addEventListener('click', (e) => {
    cambiarTabFeed("global", e.target);
});
document.getElementById('tab-seguidos').addEventListener('click', (e) => {
    cambiarTabFeed("seguidos", e.target);
});

function cambiarTabFeed(tipo, elementoTab) {
    filtroFeedActual = tipo;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    elementoTab.classList.add('active');
    escucharFeed();
}

document.getElementById('input-busqueda').addEventListener('input', (e) => {
    terminoBusqueda = e.target.value.toLowerCase().trim();
    escucharFeed();
});

// --- MOTOR DEL FEED CON ALGORITMO Y FILTROS ---
let desubscribirFeed = null;

function escucharFeed() {
    if (desubscribirFeed) desubscribirFeed();

    const q = query(collection(db, "publicaciones"), where("status", "==", "approved"));
    
    desubscribirFeed = onSnapshot(q, (snap) => {
        const feedContainer = document.getElementById('feed-publicaciones');
        feedContainer.innerHTML = '';
        cachePublicaciones = {};

        let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        // 1. Filtrar por búsqueda si existe término
        if (terminoBusqueda) {
            lista = lista.filter(p => 
                p.content.toLowerCase().includes(terminoBusqueda) || 
                p.userName.toLowerCase().includes(terminoBusqueda) || 
                (p.userUsername && p.userUsername.toLowerCase().includes(terminoBusqueda))
            );
        }

        // 2. Filtrar por Pestaña de Seguidos
        const listaSeguidos = usuarioActualData?.seguidos || [];
        if (filtroFeedActual === "seguidos") {
            lista = lista.filter(p => listaSeguidos.includes(p.userId));
        }

        // 3. Ordenar por algoritmo: Prioriza seguidos, luego fecha
        lista.sort((a, b) => {
            const aEsSeguido = listaSeguidos.includes(a.userId) ? 1 : 0;
            const bEsSeguido = listaSeguidos.includes(b.userId) ? 1 : 0;
            
            if (filtroFeedActual === "global" && aEsSeguido !== bEsSeguido) {
                return bEsSeguido - aEsSeguido; // Los seguidos salen arriba en el feed global
            }
            return (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0); // Si no, orden cronológico estándar
        });

        if(lista.length === 0) {
            feedContainer.innerHTML = '<div class="card"><p style="text-align:center; color: var(--text-light);">No se encontraron mensajes aquí...</p></div>';
            return;
        }

        lista.forEach(post => {
            if ((post.reportCount || 0) >= 3) return;
            cachePublicaciones[post.id] = post;

            const uid = auth.currentUser?.uid;
            const haDadoLike = (post.likes || []).includes(uid);
            const esPropio = post.userId === uid;
            const loSigo = listaSeguidos.includes(post.userId);

            // Botón de Seguir dinámico
            let botonSeguirHtml = '';
            if (uid && !esPropio) {
                botonSeguirHtml = `<button onclick="alternarSeguir('${post.userId}')" class="follow-btn ${loSigo ? 'following' : ''}">
                    ${loSigo ? '✓ Siguiendo' : '+ Seguir'}
                </button>`;
            }

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                ${botonSeguirHtml}
                <div class="profile-header">
                    <img src="${post.userFoto || 'https://api.dicebear.com/8.x/lorelei/svg?seed=Faro1'}" class="profile-pic">
                    <div class="user-meta">
                        <strong>${post.userName}</strong>
                        <span>@${post.userUsername || 'miembro'}</span>
                    </div>
                </div>
                <p style="font-size: 15px; line-height: 1.5; margin: 5px 0;">${post.content}</p>
                ${post.isRepost ? `<div class="quote-box">${post.originalQuote}</div>` : ''}
                <div class="post-actions">
                    <button onclick="darLike('${post.id}')" class="action-btn" style="color: ${haDadoLike ? 'var(--primary)' : 'var(--text-light)'}">
                        👍 ${post.likes?.length || 0}
                    </button>
                    <button onclick="abrirRepost('${post.id}')" class="action-btn">🔄 Citar</button>
                    <button onclick="reportarPost('${post.id}')" class="action-btn" style="color:#E74C3C;">🚩</button>
                </div>
            `;
            feedContainer.appendChild(div);
        });
    });
}
