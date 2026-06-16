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

// Referencias HTML
const seccionLogin = document.getElementById('seccion-login');
const seccionPerfil = document.getElementById('seccion-perfil');
const nombreUsuario = document.getElementById('nombre-usuario');
const bioUsuario = document.getElementById('bio-usuario');
const imgPerfil = document.getElementById('img-perfil');
const feedPublicaciones = document.getElementById('feed-publicaciones');
const inputPublicacion = document.getElementById('input-publicacion');

// Variables globales para el perfil
let avatarSeleccionado = "https://api.dicebear.com/8.x/identicon/svg?seed=Lumina1";

// Filtro de Moderación
const palabrasProhibidas = ["insulto", "groseria", "odio"];
function esContenidoLimpio(texto) {
    const textoMin = texto.toLowerCase();
    return !palabrasProhibidas.some(palabra => textoMin.includes(palabra));
}

// Cargar perfil
async function cargarPerfilUsuario(user) {
    const userRef = doc(db, "usuarios", user.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
        const datos = userSnap.data();
        nombreUsuario.textContent = datos.nombre;
        bioUsuario.textContent = datos.bio || "Sin biografía aún...";
        imgPerfil.src = datos.fotoUrl || avatarSeleccionado;
    } else {
        await setDoc(userRef, {
            nombre: user.displayName,
            bio: "",
            fotoUrl: avatarSeleccionado,
            email: user.email
        });
        nombreUsuario.textContent = user.displayName;
        imgPerfil.src = avatarSeleccionado;
    }
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

// Selector de Avatares (Lógica visual)
window.seleccionarAvatar = function(elemento) {
    document.querySelectorAll('.avatar-option').forEach(img => img.classList.remove('selected'));
    elemento.classList.add('selected');
    avatarSeleccionado = elemento.src;
};

// Modales de Perfil
const modalPerfil = document.getElementById('modal-perfil');
document.getElementById('btn-editar-perfil').addEventListener('click', () => {
    document.getElementById('input-bio').value = bioUsuario.textContent === "Sin biografía aún..." ? "" : bioUsuario.textContent;
    modalPerfil.style.display = 'flex';
});
document.getElementById('btn-cerrar-perfil').addEventListener('click', () => modalPerfil.style.display = 'none');

// Guardar Perfil
document.getElementById('btn-guardar-perfil').addEventListener('click', async () => {
    const bio = document.getElementById('input-bio').value.trim();
    if (!esContenidoLimpio(bio)) return alert("Por favor, usa un lenguaje edificado en tu biografía.");

    const btn = document.getElementById('btn-guardar-perfil');
    btn.textContent = "Guardando..."; btn.disabled = true;

    try {
        await updateDoc(doc(db, "usuarios", auth.currentUser.uid), {
            bio: bio, 
            fotoUrl: avatarSeleccionado
        });
        bioUsuario.textContent = bio || "Sin biografía aún...";
        imgPerfil.src = avatarSeleccionado;
        modalPerfil.style.display = 'none';
    } catch (error) {
        console.error("Error al actualizar perfil:", error);
    } finally {
        btn.textContent = "Guardar Cambios"; btn.disabled = false;
    }
});

// Publicar Mensaje
document.getElementById('btn-publicar').addEventListener('click', async () => {
    const contenido = inputPublicacion.value.trim();
    if (!contenido) return;
    if (!esContenidoLimpio(contenido)) return alert("Tu mensaje contiene palabras no permitidas.");

    const btn = document.getElementById('btn-publicar');
    btn.disabled = true; btn.textContent = "Publicando...";

    try {
        await addDoc(collection(db, "publicaciones"), {
            userId: auth.currentUser.uid,
            userName: nombreUsuario.textContent,
            userFoto: imgPerfil.src,
            content: contenido,
            timestamp: serverTimestamp(),
            status: "approved", reportCount: 0, likes: [], isRepost: false
        });
        inputPublicacion.value = '';
    } catch (error) { console.error(error); } finally {
        btn.disabled = false; btn.textContent = "Compartir Mensaje";
    }
});
document.getElementById('btn-publicar').addEventListener('click', async () => {
    // Si no hay usuario, bloqueamos la publicación
    if (!auth.currentUser) {
        return alert("Para publicar tus mensajes en Lumina, primero debes iniciar sesión.");
    }

    const contenido = inputPublicacion.value.trim();
    if (!contenido) return;
    if (!esContenidoLimpio(contenido)) return alert("Tu mensaje contiene palabras no permitidas.");

    const btn = document.getElementById('btn-publicar');
    btn.disabled = true; btn.textContent = "Publicando...";

    try {
        await addDoc(collection(db, "publicaciones"), {
            userId: auth.currentUser.uid,
            userName: nombreUsuario.textContent,
            userFoto: imgPerfil.src,
            content: contenido,
            timestamp: serverTimestamp(),
            status: "approved", reportCount: 0, likes: [], isRepost: false
        });
        inputPublicacion.value = '';
    } catch (error) { console.error(error); } finally {
        btn.disabled = false; btn.textContent = "Compartir Mensaje";
    }
});
// Lógica de Repost
window.abrirRepost = function(id, autorOriginal, contenidoOriginal) {
    // Si no hay usuario, bloqueamos y enviamos alerta
    if (!auth.currentUser) {
        return alert("¡Únete a Lumina! Regístrate para poder realizar repost y compartir tu mensaje con la comunidad.");
    }
    
    document.getElementById('repost-id-original').value = id;
    document.getElementById('repost-preview').innerHTML = `<strong>${autorOriginal}:</strong> ${contenidoOriginal}`;
    modalRepost.style.display = 'flex';
};
const modalRepost = document.getElementById('modal-repost');
window.abrirRepost = function(id, autorOriginal, contenidoOriginal) {
    document.getElementById('repost-id-original').value = id;
    document.getElementById('repost-preview').innerHTML = `<strong>${autorOriginal}:</strong> ${contenidoOriginal}`;
    modalRepost.style.display = 'flex';
};
document.getElementById('btn-cerrar-repost').addEventListener('click', () => modalRepost.style.display = 'none');

document.getElementById('btn-confirmar-repost').addEventListener('click', async () => {
    const comentario = document.getElementById('input-repost-comentario').value.trim();
    if (!esContenidoLimpio(comentario)) return alert("Tu comentario contiene palabras no permitidas.");
    
    try {
        await addDoc(collection(db, "publicaciones"), {
            userId: auth.currentUser.uid,
            userName: nombreUsuario.textContent,
            userFoto: imgPerfil.src,
            content: comentario,
            timestamp: serverTimestamp(),
            status: "approved", reportCount: 0, likes: [],
            isRepost: true,
            originalQuote: document.getElementById('repost-preview').innerHTML
        });
        modalRepost.style.display = 'none';
        document.getElementById('input-repost-comentario').value = '';
    } catch (error) { console.error(error); }
});

// Likes y Eliminar
window.darLike = async function(postId, likesStr) {
    const postRef = doc(db, "publicaciones", postId);
    // Si no hay usuario, usamos un ID temporal para que puedan dar like
    const uid = auth.currentUser ? auth.currentUser.uid : "anonimo_" + Math.floor(Math.random() * 1000);
    
    try {
        const likes = JSON.parse(likesStr);
        if (likes.includes(uid)) {
            await updateDoc(postRef, { likes: arrayRemove(uid) });
        } else {
            await updateDoc(postRef, { likes: arrayUnion(uid) });
        }
    } catch (error) {
        console.error("Error al actualizar like:", error);
    }
};
window.eliminarPost = async function(postId) {
    if(confirm("¿Seguro que deseas eliminar este mensaje?")) {
        await deleteDoc(doc(db, "publicaciones", postId));
    }
};

// Renderizar Feed
const q = query(collection(db, "publicaciones"), where("status", "==", "approved"));
onSnapshot(q, (snapshot) => {
    feedPublicaciones.innerHTML = ''; 
    const postsArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    postsArray.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    postsArray.forEach((post) => {
        if(post.reportCount >= 3) return;

        const uid = auth.currentUser ? auth.currentUser.uid : null;
        const esAutor = uid === post.userId;
        const likes = post.likes || [];
        const haDadoLike = uid ? likes.includes(uid) : false;
        
        let contenidoHtml = `<p style="font-size: 16px; line-height: 1.5; margin: 10px 0;">${post.content}</p>`;
        if (post.isRepost) {
            contenidoHtml += `<div class="quote-box">${post.originalQuote}</div>`;
        }

        const controlesAutor = esAutor ? `<button onclick="window.eliminarPost('${post.id}')" class="action-btn" style="color:#E74C3C;">🗑 Borrar</button>` : '';

        const div = document.createElement('div');
        div.className = 'card';
        div.innerHTML = `
            <div class="profile-header" style="margin-bottom: 10px;">
                <img src="${post.userFoto || 'https://api.dicebear.com/8.x/identicon/svg?seed=Lumina1'}" class="profile-pic" style="width: 45px; height: 45px;">
                <div>
                    <strong style="display:block; font-size:16px;">${post.userName}</strong>
                    <span style="font-size: 12px; color: var(--text-light);">Hace un momento</span>
                </div>
            </div>
            ${contenidoHtml}
            
            <div class="post-actions">
                <button onclick="window.darLike('${post.id}', '${JSON.stringify(likes)}')" class="action-btn" style="color: ${haDadoLike ? 'var(--primary)' : 'var(--text-light)'};">
                    👍 Me gusta (${likes.length})
                </button>
                <button onclick="window.abrirRepost('${post.id}', '${post.userName}', '${post.content.replace(/'/g, "\\'")}')" class="action-btn">
                    🔄 Citar
                </button>
                ${controlesAutor}
            </div>
        `;
        feedPublicaciones.appendChild(div);
    });
});
