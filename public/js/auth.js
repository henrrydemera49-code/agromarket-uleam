// ═══════════════════════════════════════════════════════
// auth.js  —  Autenticación y protección de páginas
//
// ── MOO: POLIMORFISMO ────────────────────────────────
// La función protegerPagina() se llama igual en todas
// las páginas, pero actúa diferente según el ROL del
// usuario. Eso es polimorfismo: mismo nombre, distinto
// comportamiento según el objeto (rol) que lo invoca.
// ═══════════════════════════════════════════════════════

// Proteger páginas según rol
// Uso: protegerPagina(["cliente"])         → solo clientes
//      protegerPagina(["administrador"])   → solo admin
//      protegerPagina(["cliente","administrador"]) → ambos
function protegerPagina(rolesPermitidos = []) {
  auth.onAuthStateChanged(async (user) => {
    if (!user) {
      window.location.href = "/login.html";
      return;
    }
    try {
      if (rolesPermitidos.length > 0) {
        const datos = await obtenerUsuario(user.uid);
        if (!datos) {
          window.location.href = "/login.html";
          return;
        }
        if (datos.activo === false) {
          await auth.signOut();
          window.location.href = "/login.html";
          return;
        }
        if (!rolesPermitidos.includes(datos.rol)) {
          const destinos = {
            cliente: "/catalogo.html",
            administrador: "/admin/dashboard.html",
            repartidor: "/repartidor/entregas.html"
          };
          window.location.href = destinos[datos.rol] || "/login.html";
          return;
        }
      }
      if (typeof iniciarPagina === "function") iniciarPagina();
    } catch (error) {
      console.error("No se pudo validar el acceso a la página:", error);
      if (typeof mostrarToast === "function") {
        mostrarToast("No se pudo validar tu acceso. Intenta nuevamente.", "danger");
      }
    }
  });
}

// Cerrar sesión
function cerrarSesion() {
  auth.signOut()
    .then(() => window.location.href = "/login.html")
    .catch(error => {
      console.error("No se pudo cerrar la sesión:", error);
      if (typeof mostrarToast === "function") {
        mostrarToast("No se pudo cerrar la sesión.", "danger");
      }
    });
}

// ── MOO: ATAJO OCULTO (Ctrl+Shift+A) ────────────────
// El panel admin no tiene enlace visible.
// Solo funciona si el usuario tiene rol "administrador".
document.addEventListener("keydown", async (e) => {
  if (e.ctrlKey && e.shiftKey && e.key === "A") {
    e.preventDefault();
    const user = auth.currentUser;
    if (!user) return;
    try {
      const datos = await obtenerUsuario(user.uid);
      if (datos && datos.rol === "administrador") {
        window.location.href = "/admin/dashboard.html";
      }
    } catch (error) {
      console.error("No se pudo comprobar el rol del usuario:", error);
    }
  }
});

// Mostrar nombre en el navbar
async function cargarNavbar() {
  const user = auth.currentUser;
  if (!user) return;
  const datos = await obtenerUsuario(user.uid);
  const el = document.getElementById("usuario-nombre");
  if (el && datos) el.textContent = datos.nombre;
}

// Notificación flotante
function mostrarToast(mensaje, tipo = "success") {
  const colores = { success:"bg-success", danger:"bg-danger", warning:"bg-warning text-dark" };
  const toast = document.createElement("div");
  toast.className = `toast align-items-center text-white ${colores[tipo]||"bg-success"} border-0 show`;
  toast.innerHTML = `<div class="d-flex">
    <div class="toast-body">${mensaje}</div>
    <button class="btn-close btn-close-white me-2 m-auto"
            onclick="this.closest('.toast').remove()"></button>
  </div>`;
  let c = document.querySelector(".toast-container");
  if (!c) { c = document.createElement("div"); c.className="toast-container"; document.body.appendChild(c); }
  c.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// Formatear precio
const fmt = (n) => "$" + parseFloat(n||0).toFixed(2);

function escaparHTML(valor) {
  return String(valor == null ? "" : valor).replace(/[&<>"']/g, caracter => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[caracter]);
}
