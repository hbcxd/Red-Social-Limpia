// Importamos las herramientas de Firebase directamente desde sus servidores
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
// NUEVO: Agregamos addDoc, updateDoc, doc, increment, arrayUnion y serverTimestamp para poder publicar y reportar
import { getFirestore, collection, query, where, onSnapshot, addDoc, updateDoc, doc, increment, arrayUnion, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

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

// Inicializar la app
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referencias a la interfaz web
const btnGoogle = document.getElementById('btn-google');
const btnApple = document.getElementById('btn-apple');
const btnSalir = document.getElementById('btn-salir');
const seccionLogin = document.getElementById('seccion-login');
const seccionPerfil = document.getElementById('seccion-perfil');
const nombreUsuario = document.getElementById('nombre-usuario');
const feedPublicaciones = document.getElementById('feed-publicaciones');
// Referencias a la nueva caja de publicación
const btnPublicar = document.getElementById('btn-publicar');
const inputPublicacion = document.getElementById('input-publicacion');

// Función para iniciar sesión con Google
btnGoogle.addEventListener('click', () => {
    const provider = new GoogleAuthProvider();
    signInWithPopup(auth, provider).catch(error => alert("Error al iniciar sesión: " + error.message));
});

// Función para cerrar sesión
btnSalir.addEventListener('click', () => signOut(auth));

// Detectar si el usuario entró o salió
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

// NUEVO: Función para publicar un mensaje en la base de datos
btnPublicar.addEventListener('click', async () => {
    const contenido = inputPublicacion.value.trim();
    if (!contenido) return alert("Por favor, escribe un mensaje antes de publicar.");
    if (!auth.currentUser) return alert("Debes iniciar sesión para publicar.");

    // Desactivar botón temporalmente para evitar doble publicación
    btnPublicar.disabled = true;
    btnPublicar.textContent = "Publicando...";

    try {
        await addDoc(collection(db, "publicaciones"), {
            userId: auth.currentUser.uid,
            userName: auth.currentUser.displayName || "Hermano",
            content: contenido,
            timestamp: serverTimestamp(),
            status: "approved", // Se aprueba por defecto hasta que integremos la IA de moderación
            reportCount: 0,
            reportedBy: []
        });
        
        // Limpiar la caja de texto tras publicar con éxito
        inputPublicacion.value = '';
    } catch (error) {
        console.error("Error al publicar:", error);
        alert("Hubo un error al publicar tu mensaje.");
    } finally {
        btnPublicar.disabled = false;
        btnPublicar.textContent = "Compartir Mensaje";
    }
});

// NUEVO: Función global para procesar reportes manuales
window.reportarPost = async function(postId) {
    const usuarioActual = auth.currentUser;
    
    if (!usuarioActual) {
        alert("Debes iniciar sesión para poder reportar contenido.");
        return;
    }

    const postRef = doc(db, "publicaciones", postId);

    try {
        await updateDoc(postRef, {
            reportCount: increment(1),
            reportedBy: arrayUnion(usuarioActual.uid)
        });
        alert("Gracias por tu reporte. Evaluaremos este contenido para mantener la comunidad limpia.");
    } catch (error) {
        console.error("Error al reportar:", error);
        alert("Hubo un problema procesando el reporte.");
    }
};

// Cargar las publicaciones aprobadas
const q = query(collection(db, "publicaciones"), where("status", "==", "approved"));
onSnapshot(q, (snapshot) => {
    feedPublicaciones.innerHTML = ''; 
    
    if (snapshot.empty) {
        feedPublicaciones.innerHTML = '<p>No hay publicaciones aún. ¡Sé el primero en compartir la palabra!</p>';
        return;
    }

    // Convertimos los documentos a un array para ordenarlos de más nuevo a más viejo
    const postsArray = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    // Ordenar localmente (en el futuro se puede ordenar en la query de Firebase)
    postsArray.sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0));

    postsArray.forEach((post) => {
        // Ocultar si tiene 3 o más reportes
        if(post.reportCount >= 3) return;

        const div = document.createElement('div');
        div.className = 'post';
        div.innerHTML = `
            <strong>${post.userName}</strong>
            <p>${post.content}</p>
            <button class="btn-reporte" onclick="window.reportarPost('${post.id}')">⚠ Reportar</button>
            <div style="clear: both;"></div>
        `;
        feedPublicaciones.appendChild(div);
    });
});
