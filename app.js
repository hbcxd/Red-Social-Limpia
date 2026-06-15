// Importamos las herramientas de Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// Agregamos deleteDoc y arrayRemove para borrar posts y quitar likes
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, arrayRemove, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Tus claves reales de Firebase
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
const btnGoogle = document.getElementById('btn-google');
const btnApple = document.getElementById('btn-apple');
const btnSalir = document.getElementById('btn-salir');
const seccionLogin = document.getElementById('seccion-login');
const seccionPerfil = document.getElementById('seccion-perfil');
const nombreUsuario = document.getElementById('nombre-usuario');
const feedPublicaciones = document.getElementById('feed-publicaciones');
const btnPublicar = document.getElementById('btn-publicar');
const inputPublicacion = document.getElementById('input-publicacion');

// Autenticación
btnGoogle.addEventListener('click', () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => alert(e.message)));
btnSalir.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
    if (user) {
        seccionLogin.style.display = 'none';
        seccionPerfil.style.display = 'block';
        nombreUsuario.textContent = user.displayName || "Hermano";
    } else {
        seccionLogin.style.display = 'block';
        seccionPerfil.style.display = 'none';
    }
});

// Función para publicar
btnPublicar.addEventListener('click', async () => {
    const contenido = inputPublicacion.value.trim();
    if (!contenido) return alert("Escribe un mensaje de bendición.");
    if (!auth.currentUser) return alert("Inicia sesión para publicar.");

    btnPublicar.disabled = true;
    try {
        await addDoc(collection(db, "publicaciones"), {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || "Hermano",
            content: contenido,
            timestamp: serverTimestamp(),
            status: "approved",
            reportCount: 0,
            reportedBy: [],
            likes: [] // Nuevo arreglo para controlar los me gusta
        });
        inputPublicacion.value = '';
    } catch (error) {
        console.error(error);
        alert("Error al publicar.");
    } finally {
        btnPublicar.disabled = false;
    }
});

// FUNCIONES GLOBALES PARA INTERACCIÓN DE LOS USUARIOS

// 1. Dar o quitar Me Gusta
window.darLike = async function(postId, likesActualesStr) {
    if (!auth.currentUser) return alert("Inicia sesión para interactuar.");
    const uid = auth.currentUser.uid;
    const likesActuales = JSON.parse(likesActualesStr || "[]");
    const postRef = doc(db, "publicaciones", postId);

    try {
        if (likesActuales.includes(uid)) {
            await updateDoc(postRef, { likes: arrayRemove(uid) }); // Quitar like
        } else {
            await updateDoc(postRef, { likes: arrayUnion(uid) }); // Dar like
        }
    } catch (error) {
        console.error("Error al dar like:", error);
    }
};

// 2. Eliminar Post
window.eliminarPost = async function(postId) {
    if(confirm("¿Estás seguro de que deseas eliminar este mensaje?")) {
        try {
            await deleteDoc(doc(db, "publicaciones", postId));
        } catch (error) {
            console.error("Error al borrar:", error);
            alert("No se pudo eliminar la publicación.");
        }
    }
};

// 3. Editar Post
window.editarPost = async function(postId, contenidoActual) {
    const nuevoContenido = prompt("Edita tu mensaje:", contenidoActual);
    if (nuevoContenido !== null && nuevoContenido.trim() !== "") {
        try {
            await updateDoc(doc(db, "publicaciones", postId), {
                content: nuevoContenido.trim()
            });
        } catch (error) {
            console.error("Error al editar:", error);
            alert("No se pudo editar la publicación.");
        }
    }
};

// 4. Reportar
window.reportarPost = async function(postId) {
    if (!auth.currentUser) return alert("Inicia sesión para reportar.");
    try {
        await updateDoc(doc(db, "publicaciones", postId), {
            reportCount: increment(1),
            reportedBy: arrayUnion(auth.currentUser.uid)
        });
        alert("Reporte enviado correctamente.");
    } catch (error) {
        console.error(error);
    }
};

// Renderizar el Feed en tiempo real
const q = query(collection(db, "publicaciones"), where("status", "==", "approved"));
onSnapshot(q, (snapshot) => {
    feedPublicaciones.innerHTML = ''; 
    if (snapshot.empty) {
        feedPublicaciones.innerHTML = '<p>No hay publicaciones aún. ¡Sé el primero en compartir!</p>';
        return;
    }

    const postsArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    postsArray.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    postsArray.forEach((post) => {
        if(post.reportCount >= 3) return;

        const uid = auth.currentUser ? auth.currentUser.uid : null;
        const esAutor = uid === post.userId;
        const likes = post.likes || [];
        const haDadoLike = uid ? likes.includes(uid) : false;
        const totalLikes = likes.length;

        // Botones dinámicos: Solo el autor ve Editar/Eliminar
        const controlesAutor = esAutor ? `
            <button onclick="window.editarPost('${post.id}', '${post.content.replace(/'/g, "\\'")}')" style="color: blue; border:none; background:none; cursor:pointer;">✏ Editar</button>
            <button onclick="window.eliminarPost('${post.id}')" style="color: darkred; border:none; background:none; cursor:pointer;">🗑 Eliminar</button>
        ` : '';

        const div = document.createElement('div');
        div.className = 'post';
        div.innerHTML = `
            <strong>${post.userName}</strong>
            <p>${post.content}</p>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 10px;">
                <div>
                    <button onclick="window.darLike('${post.id}', '${JSON.stringify(likes)}')" style="color: ${haDadoLike ? 'blue' : 'gray'}; border:none; background:none; cursor:pointer;">
                        👍 Me gusta (${totalLikes})
                    </button>
                    ${controlesAutor}
                </div>
                <button onclick="window.reportarPost('${post.id}')" style="color: red; border:none; background:none; cursor:pointer; font-size: 12px;">⚠ Reportar</button>
            </div>
        `;
        feedPublicaciones.appendChild(div);
    });
});
