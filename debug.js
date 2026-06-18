// debug.js
export function activarCapturaDeErrores() {
    const errorDisplay = document.createElement('div');
    errorDisplay.id = 'debug-panel';
    errorDisplay.style.cssText = `
        position: fixed; bottom: 10px; left: 10px; right: 10px;
        background: rgba(200, 0, 0, 0.9); color: white; padding: 15px;
        border-radius: 10px; z-index: 9999; font-size: 12px;
        display: none; box-shadow: 0 4px 10px rgba(0,0,0,0.5);
    `;
    document.body.appendChild(errorDisplay);

    const mostrarError = (msg) => {
        errorDisplay.style.display = 'block';
        errorDisplay.innerHTML = `<strong>Error:</strong> ${msg} <br> <button onclick="this.parentElement.style.display='none'">Cerrar</button>`;
    };

    window.onerror = (message, source, lineno, colno, error) => {
        mostrarError(`${message} (Línea: ${lineno})`);
    };

    window.onunhandledrejection = (event) => {
        const errorMsg = event.reason ? (event.reason.message || event.reason) : 'Promesa fallida desconocida';
        mostrarError(errorMsg);
    };
}
