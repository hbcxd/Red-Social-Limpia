// Importamos las herramientas de Firebase directamente desde sus servidores
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, OAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore, collection, query, where, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// AQUI IRÁN TUS CLAVES DE FIREBASE (Lo configuraremos en el siguiente paso)
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

// Cargar las publicaciones aprobadas
const q = query(collection(db, "publicaciones"), where("status", "==", "approved"));
onSnapshot(q, (snapshot) => {
    feedPublicaciones.innerHTML = ''; // Limpiar el mensaje de "Cargando"
    
    if (snapshot.empty) {
        feedPublicaciones.innerHTML = '<p>No hay publicaciones aún.</p>';
        return;
    }

    snapshot.forEach((doc) => {
        const post = doc.data();
        // Ocultar si tiene 3 o más reportes
        if(post.reportCount >= 3) return;

        const div = document.createElement('div');
        div.className = 'post';
        div.innerHTML = `
            <strong>${post.userName}</strong>
            <p>${post.content}</p>
            <button class="btn-reporte" onclick="alert('Funcionalidad de reporte en construcción para el post ID: ${doc.id}')">⚠ Reportar</button>
        `;
        feedPublicaciones.appendChild(div);
    });
});
