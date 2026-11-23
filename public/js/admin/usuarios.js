let usuariosAdministrados = [];

async function iniciarPagina() {
  cargarNavbar();
  document.getElementById("form-nuevo-usuario")
    .addEventListener("submit", crearUsuarioDesdeFormulario);
  const tabla = document.getElementById("tabla-usuarios");
  tabla.addEventListener("click", async evento => {
    const boton = evento.target.closest("[data-action='save-user']");
    if (!boton) return;
    await guardarCambiosUsuario(boton);
  });
  await cargarUsuarios();
}

async function crearUsuarioDesdeFormulario(evento) {
  evento.preventDefault();
  const form = evento.currentTarget;
  if (!form.reportValidity()) return;

  const boton = document.getElementById("btn-crear-usuario");
  boton.disabled = true;
  try {
    await crearUsuarioAdmin({
      nombre: document.getElementById("nuevo-nombre").value,
      apellido: document.getElementById("nuevo-apellido").value,
      correo: document.getElementById("nuevo-correo").value,
      rol: document.getElementById("nuevo-rol").value,
      password: document.getElementById("nuevo-password").value
    });
    form.reset();
    const modal = bootstrap.Modal.getInstance(
      document.getElementById("modalNuevoUsuario")
    );
    if (modal) modal.hide();
    mostrarMensajeUsuarios(
      "Cuenta creada. Comparte las credenciales temporales por un canal seguro.",
      "success"
    );
    await cargarUsuarios();
  } catch (error) {
    console.error("No se pudo crear el usuario:", error);
    const mensajes = {
      "auth/email-already-in-use": "Ese correo ya tiene una cuenta.",
      "auth/invalid-email": "El correo no es válido.",
      "auth/weak-password": "La contraseña debe tener al menos 6 caracteres."
    };
    mostrarMensajeUsuarios(
      mensajes[error.code] || error.message || "No se pudo crear el usuario.",
      "danger"
    );
  } finally {
    boton.disabled = false;
  }
}

async function cargarUsuarios() {
  const tabla = document.getElementById("tabla-usuarios");
  try {
    usuariosAdministrados = await listarUsuarios();
    if (!usuariosAdministrados.length) {
      tabla.innerHTML = `<p class="text-center text-muted p-4">No hay usuarios registrados.</p>`;
      return;
    }

    tabla.innerHTML = `<table class="table mb-0 align-middle">
      <thead class="table-success"><tr>
        <th>Usuario</th><th>Correo</th><th>Rol</th><th>Acceso</th><th></th>
      </tr></thead>
      <tbody>${usuariosAdministrados.map(usuario => {
        const esUsuarioActual = usuario.id === auth.currentUser.uid;
        const nombre = `${usuario.nombre || ""} ${usuario.apellido || ""}`.trim();
        return `<tr data-user-row="${escaparHTML(usuario.id)}">
          <td class="fw-semibold">${escaparHTML(nombre || "Sin nombre")}
            ${esUsuarioActual ? `<span class="badge text-bg-light">Sesión actual</span>` : ""}
          </td>
          <td><small>${escaparHTML(usuario.correo || "—")}</small></td>
          <td><select class="form-select form-select-sm" data-user-role
            aria-label="Rol de ${escaparHTML(nombre)}" ${esUsuarioActual ? "disabled" : ""}>
            ${["cliente", "administrador", "repartidor"].map(rol => `
              <option value="${rol}" ${usuario.rol === rol ? "selected" : ""}>
                ${rol.charAt(0).toUpperCase() + rol.slice(1)}
              </option>`).join("")}
          </select></td>
          <td><div class="form-check">
            <input class="form-check-input" type="checkbox" data-user-active
              aria-label="Cuenta activa de ${escaparHTML(nombre)}"
              ${usuario.activo !== false ? "checked" : ""} ${esUsuarioActual ? "disabled" : ""}>
          </div></td>
          <td><button class="btn btn-outline-success btn-sm" type="button"
            data-action="save-user" data-user-id="${escaparHTML(usuario.id)}"
            ${esUsuarioActual ? "disabled" : ""}>Guardar</button></td>
        </tr>`;
      }).join("")}</tbody>
    </table>`;
  } catch (error) {
    console.error("No se pudieron cargar los usuarios:", error);
    mostrarMensajeUsuarios("No se pudieron cargar los usuarios.", "danger");
    tabla.textContent = "";
  }
}

async function guardarCambiosUsuario(boton) {
  const fila = boton.closest("[data-user-row]");
  const rol = fila.querySelector("[data-user-role]").value;
  const activo = fila.querySelector("[data-user-active]").checked;
  boton.disabled = true;
  try {
    await actualizarUsuarioAdmin(boton.dataset.userId, { rol, activo });
    mostrarMensajeUsuarios("Usuario actualizado correctamente.", "success");
    await cargarUsuarios();
  } catch (error) {
    console.error("No se pudo actualizar el usuario:", error);
    mostrarMensajeUsuarios(error.message || "No se pudo actualizar el usuario.", "danger");
    boton.disabled = false;
  }
}

function mostrarMensajeUsuarios(mensaje, tipo) {
  const el = document.getElementById("mensaje-usuarios");
  el.textContent = mensaje;
  el.className = `alert alert-${tipo}`;
}

protegerPagina(["administrador"]);
