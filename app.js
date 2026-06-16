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

// Variables de Control de Estado (Avatar por defecto actualizado)
let cachePublicaciones = {};
let usuarioActualData = null;
let filtroFeedActual = "global";
let terminoBusqueda = "";
let avatarSeleccionadoLocal = "https://api.iconify.design/fa6-solid:book-bible.svg?color=%235A9BD5";

const libreriaVersiculos = {
    paz: "Jehová es mi pastor; nada me faltará... - Salmo 23:1",
    amor: "El amor es sufrido, es benigno; el amor no tiene envidia... - 1 Corintios 13:4",
    fe: "Es, pues, la fe la certeza de lo que se espera... - Hebreos 11:1",
    general: "Lámpara es a mis pies tu palabra, y lumbrera a mi camino. - Salmo 119:105"
};

// --- OBSERVADOR DE SESIÓN ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
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
        // Usuario Nuevo
        document.getElementById('modal-legal').style.display = 'flex';
        
        document.getElementById('check-legal').addEventListener('change', (e) => {
            document.getElementById('btn-aceptar-legal').disabled = !e.target.checked;
        });
        
        document.getElementById('btn-aceptar-legal').onclick = async () => {
            document.getElementById('modal-legal').style.display = 'none';
            const usernameSugerido = user.email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, "") + Math.floor(Math.random() * 100);
            
            await setDoc(userRef, {
                nombre: user.displayName || "Hermano en la Fe",
                username: usernameSugerido.toLowerCase(),
                bio: "¡Hola! Acabo de unirme a Faro.",
                fotoUrl: avatarSeleccionadoLocal,
                seguidos: [],
                privacidadNombre: "publico",
                privacidadBio: "todos",
                notifSeguidores: true,
                notifMensajes: true,
                modoOscuro: false,
                acuerdoAceptado: true,
                intereses: { paz: 1, amor: 1, fe: 1 }
            });
            
            let nuevoSnap = await getDoc(userRef);
            inicializarDatosUsuarioLocal(nuevoSnap.data(), user.uid);
        };
    } else {
        inicializarDatosUsuarioLocal(snap.data(), user.uid);
    }
}

function inicializarDatosUsuarioLocal(data, uid) {
    usuarioActualData = { id: uid, ...data };
    cambiarVisibilidadPlataforma(true);
    solicitarPermisoNotificaciones();
    
    // Aplicar Modo Oscuro si estaba guardado
    if(usuarioActualData.modoOscuro) {
        document.documentElement.setAttribute('data-theme', 'dark');
        document.getElementById('chk-modo-oscuro').checked = true;
    } else {
        document.documentElement.removeAttribute('data-theme');
        document.getElementById('chk-modo-oscuro').checked = false;
    }
    
    actualizarInterfazUsuarioPropia();
    procesarAlgoritmoYVersiculo();
}

function cambiarVisibilidadPlataforma(autenticado) {
    document.getElementById('seccion-login').style.display = autenticado ? 'none' : 'block';
    document.getElementById('seccion-plataforma').style.display = autenticado ? 'block' : 'none';
    document.getElementById('seccion-versiculo').style.display = autenticado ? 'block' : 'none';
    if(!autenticado) usuarioActualData = null;
}

function actualizarInterfazUsuarioPropia() {
    if (!usuarioActualData) return;
    document.getElementById('mi-perfil-nombre').textContent = usuarioActualData.nombre;
    document.getElementById('mi-perfil-tag').textContent = `@${usuarioActualData.username}`;
    document.getElementById('mi-perfil-bio').textContent = usuarioActualData.bio;
    document.getElementById('mi-perfil-foto').src = usuarioActualData.fotoUrl;
    avatarSeleccionadoLocal = usuarioActualData.fotoUrl;
}

document.getElementById('btn-google').addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()));
document.getElementById('btn-salir').addEventListener('click', () => signOut(auth));

// --- GESTIÓN DE NOTIFICACIONES ---
function solicitarPermisoNotificaciones() {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}

function lanzarNotificacionPush(titulo, cuerpo) {
    if ("Notification" in window && Notification.permission === "granted") {
        new Notification(titulo, { body: cuerpo, icon: 'https://api.iconify.design/lucide:lighthouse.svg?color=%235A9BD5' });
    }
}

// --- AJUSTES DEL PERFIL ---
document.getElementById('btn-editar-perfil').addEventListener('click', () => {
    if (!usuarioActualData) return;
    document.getElementById('input-nombre').value = usuarioActualData.nombre;
    document.getElementById('input-username').value = usuarioActualData.username;
    document.getElementById('input-bio').value = usuarioActualData.bio;
    document.getElementById('select-privacidad-nombre').value = usuarioActualData.privacidadNombre || "publico";
    document.getElementById('select-privacidad-bio').value = usuarioActualData.privacidadBio || "todos";
    document.getElementById('chk-notif-seguidores').checked = usuarioActualData.notifSeguidores !== false;
    document.getElementById('chk-notif-mensajes').checked = usuarioActualData.notifMensajes !== false;
    
    document.querySelectorAll('.avatar-option').forEach(img => {
        img.classList.toggle('selected', img.src === avatarSeleccionadoLocal);
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
    
    const nombreVal = document.getElementById('input-nombre').value.trim();
    const userVal = document.getElementById('input-username').value.trim().toLowerCase().replace(/\s+/g, '');
    const bioVal = document.getElementById('input-bio').value.trim();
    const privNom = document.getElementById('select-privacidad-nombre').value;
    const privBio = document.getElementById('select-privacidad-bio').value;
    const notifSeg = document.getElementById('chk-notif-seguidores').checked;
    const notifMen = document.getElementById('chk-notif-mensajes').checked;
    const oscuroVal = document.getElementById('chk-modo-oscuro').checked;
    
    if (!nombreVal || !userVal) return alert("Por favor, completa los campos obligatorios.");

    const userRef = doc(db, "usuarios", auth.currentUser.uid);
    const actualizaciones = {
        nombre: nombreVal, username: userVal, bio: bioVal, fotoUrl: avatarSeleccionadoLocal,
        privacidadNombre: privNom, privacidadBio: privBio,
        notifSeguidores: notifSeg, notifMensajes: notifMen, modoOscuro: oscuroVal
    };
    
    await updateDoc(userRef, actualizaciones);
    Object.assign(usuarioActualData, actualizaciones);
    
    if(oscuroVal) document.documentElement.setAttribute('data-theme', 'dark');
    else document.documentElement.removeAttribute('data-theme');

    actualizarInterfazUsuarioPropia();
    document.getElementById('modal-perfil').style.display = 'none';
    escucharFeed();
});

// --- ENRUTADOR DE PESTAÑAS ---
document.getElementById('tab-global').addEventListener('click', (e) => cambiarFiltroPestaña("global", e.target));
document.getElementById('tab-seguidos').addEventListener('click', (e) => cambiarFiltroPestaña("seguidos", e.target));
document.getElementById('tab-perfil').addEventListener('click', (e) => cambiarFiltroPestaña("mi-perfil", e.target));

function cambiarFiltroPestaña(tipo, elementoTab) {
    filtroFeedActual = tipo;
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    elementoTab.classList.add('active');
    
    document.getElementById('contenedor-creacion-post').style.display = (tipo === "mi-perfil") ? "none" : "block";
    document.getElementById('bloque-perfil-propio').style.display = (tipo === "mi-perfil") ? "block" : "none";
    
    escucharFeed();
}

// --- INTERACTIVIDAD HOVER ---
window.mostrarPreviewPerfil = function(idCaja) {
    document.getElementById(idCaja).style.display = 'block';
};
window.ocultarPreviewPerfil = function(idCaja) {
    document.getElementById(idCaja).style.display = 'none';
};

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
            
            const nombreFinal = autorInfo.privacidadNombre === "anonimo" ? "Miembro de Faro" : (autorInfo.nombre || "Hermano");
            const miId = auth.currentUser?.uid;
            const loSigo = (usuarioActualData?.seguidos || []).includes(data.userId);
            
            let bioFinal = "Biografía Privada";
            if (autorInfo.privacidadBio === "todos" || data.userId === miId || loSigo) {
                bioFinal = autorInfo.bio || "Sin descripción.";
            }

            return { 
                id: d.id, ...data, autorNombreFinal: nombreFinal,
                autorUsername: autorInfo.username || "miembro",
                autorFotoFinal: autorInfo.fotoUrl || avatarSeleccionadoLocal,
                autorBioFinal: bioFinal,
                autorSeguidoresCount: Object.values(autoresMap).filter(u => (u.seguidos || []).includes(data.userId)).length
            };
        });

        if (filtroFeedActual === "seguidos") {
            const listaSeguidos = usuarioActualData?.seguidos || [];
            lista = lista.filter(p => listaSeguidos.includes(p.userId));
        } else if (filtroFeedActual === "mi-perfil") {
            lista = lista.filter(p => p.userId === auth.currentUser?.uid);
        }

        if (terminoBusqueda) {
            lista = lista.filter(p => p.content.toLowerCase().includes(terminoBusqueda) || p.autorUsername.includes(terminoBusqueda));
        }

        lista.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

        if(lista.length === 0) {
            feedContainer.innerHTML = '<div class="card"><p style="text-align:center; color: var(--text-light);">No hay publicaciones para mostrar en este segmento...</p></div>';
            return;
        }

        lista.forEach(post => {
            if ((post.reportCount || 0) >= 3) return;
            cachePublicaciones[post.id] = post;

            const uid = auth.currentUser?.uid;
            const haDadoLike = (post.likes || []).includes(uid);
            const esPropio = post.userId === uid;
            const loSigo = (usuarioActualData?.seguidos || []).includes(post.userId);
            const previewId = `preview-${post.id}`;

            let botonSeguir = (uid && !esPropio) ? `<button onclick="alternarSeguir('${post.userId}')" class="follow-btn ${loSigo ? 'following' : ''}">${loSigo ? '✓' : '+ Seguir'}</button>` : '';

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="profile-header" onmouseenter="mostrarPreviewPerfil('${previewId}')" onmouseleave="ocultarPreviewPerfil('${previewId}')">
                    <img src="${post.autorFotoFinal}" class="profile-pic">
                    <div class="user-meta">
                        <strong>${post.autorNombreFinal}</strong>
                        <span>@${post.autorUsername}</span>
                    </div>
                    
                    <div class="profile-preview-box" id="${previewId}">
                        <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
                            <img src="${post.autorFotoFinal}" style="width:40px; height:40px; border-radius:50%; object-fit:contain; background:var(--verse-bg); padding:5px;">
                            <div>
                                <h5 style="margin:0; font-size:14px;">${post.autorNombreFinal}</h5>
                                <span style="font-size:11px; color:var(--primary);">@${post.autorUsername}</span>
                            </div>
                        </div>
                        <p style="font-size:12px; color:var(--text-light); margin:5px 0;">${post.autorBioFinal}</p>
                        <span style="font-size:11px; font-weight:bold; color:var(--text);">👥 Seguidores: ${post.autorSeguidoresCount}</span>
                    </div>
                </div>
                ${botonSeguir}
                <p style="margin: 10px 0; font-size: 15px;">${post.content}</p>
                ${post.isRepost ? `<div class="quote-box">${post.originalQuote}</div>` : ''}
                <div class="post-actions">
                    <button onclick="darLike('${post.id}')" class="action-btn" style="color:${haDadoLike ? 'var(--primary)' : 'var(--text-light)'}">👍 ${post.likes?.length || 0}</button>
                    <button onclick="abrirRepost('${post.id}')" class="action-btn">🔄 Citar</button>
                </div>
            `;
            feedContainer.appendChild(div);
        });
    });
}

// --- PUBLICAR ---
document.getElementById('btn-publicar').addEventListener('click', async () => {
    if (!auth.currentUser) return;
    const cont = document.getElementById('input-publicacion').value.trim();
    if (!cont) return;

    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        status: "approved",
        reportCount: 0,
        likes: [],
        content: cont,
        isRepost: false
    });

    document.getElementById('input-publicacion').value = '';
    
    if(usuarioActualData?.notifMensajes) {
        lanzarNotificacionPush("¡Mensaje Compartido!", "Tu palabra ha sido publicada en el feed.");
    }
});

window.alternarSeguir = async (autorId) => {
    if (!auth.currentUser || !usuarioActualData) return;
    const refPropia = doc(db, "usuarios", auth.currentUser.uid);
    const yaLoSigue = (usuarioActualData.seguidos || []).includes(autorId);
    
    if (yaLoSigue) {
        await updateDoc(refPropia, { seguidos: arrayRemove(autorId) });
        usuarioActualData.seguidos = usuarioActualData.seguidos.filter(id => id !== autorId);
    } else {
        await updateDoc(refPropia, { seguidos: arrayUnion(autorId) });
        usuarioActualData.seguidos.push(autorId);
        
        if(usuarioActualData.notifSeguidores) {
            lanzarNotificacionPush("Faro", "¡Has comenzado a seguir una nueva cuenta!");
        }
    }
    escucharFeed();
};

document.getElementById('input-busqueda').addEventListener('input', (e) => {
    terminoBusqueda = e.target.value.toLowerCase().trim();
    escucharFeed();
});

async function procesarAlgoritmoYVersiculo() {
    if (!auth.currentUser) return;
    document.getElementById('texto-versiculo').textContent = libreriaVersiculos.general;
}

window.darLike = async (postId) => {
    const uid = auth.currentUser?.uid || "anonimo";
    const post = cachePublicaciones[postId];
    if (!post) return;
    const ref = doc(db, "publicaciones", postId);
    if ((post.likes || []).includes(uid)) {
        await updateDoc(ref, { likes: arrayRemove(uid) });
    } else {
        await updateDoc(ref, { likes: arrayUnion(uid) });
    }
};

window.abrirRepost = (postId) => {
    const post = cachePublicaciones[postId];
    if (!post) return;
    document.getElementById('repost-id-original').value = postId;
    document.getElementById('repost-preview').innerHTML = `<strong>@${post.autorUsername}:</strong> ${post.content}`;
    document.getElementById('modal-repost').style.display = 'flex';
};

document.getElementById('btn-cerrar-repost').addEventListener('click', () => document.getElementById('modal-repost').style.display = 'none');

document.getElementById('btn-confirmar-repost').addEventListener('click', async () => {
    const comentario = document.getElementById('input-repost-comentario').value.trim();
    await addDoc(collection(db, "publicaciones"), {
        userId: auth.currentUser.uid,
        timestamp: serverTimestamp(),
        status: "approved",
        reportCount: 0,
        likes: [],
        content: comentario,
        isRepost: true,
        originalQuote: document.getElementById('repost-preview').innerHTML
    });
    document.getElementById('modal-repost').style.display = 'none';
    document.getElementById('input-repost-comentario').value = '';
});
