let zonasAdministradas = [];
let zonaEnEdicion = null;

async function iniciarPagina() {
  cargarNavbar();
  document.getElementById("form-zona").addEventListener("submit", guardarFormularioZona);
  document.getElementById("cancelar-edicion").addEventListener("click", limpiarFormularioZona);
  document.getElementById("tabla-zonas").addEventListener("click", gestionarZona);
  await cargarZonasAdmin();
}

async function cargarZonasAdmin() {
  const tabla = document.getElementById("tabla-zonas");
  try {
    zonasAdministradas = await listarTodasZonasDelivery();
    if (!zonasAdministradas.length) {
      tabla.innerHTML = `<p class="text-center text-muted p-4">No hay zonas configuradas.</p>`;
      return;
    }
    tabla.innerHTML = `<table class="table mb-0 align-middle">
      <thead class="table-success"><tr><th>Zona</th><th>Tarifa</th><th>Estado</th><th></th></tr></thead>
      <tbody>${zonasAdministradas.map(zona => `
        <tr>
          <td class="fw-semibold">${escaparHTML(zona.nombre)}</td>
          <td>${fmt(zona.tarifa_envio)}</td>
          <td><span class="badge ${zona.activa ? "text-bg-success" : "text-bg-secondary"}">
            ${zona.activa ? "Activa" : "Inactiva"}</span></td>
          <td class="text-nowrap">
            <button class="btn btn-outline-success btn-sm" type="button"
              data-action="edit" data-id="${escaparHTML(zona.id)}">Editar</button>
            <button class="btn btn-outline-secondary btn-sm" type="button"
              data-action="toggle" data-id="${escaparHTML(zona.id)}">
              ${zona.activa ? "Desactivar" : "Activar"}</button>
          </td>
        </tr>`).join("")}</tbody>
    </table>`;
  } catch (error) {
    console.error("No se pudieron cargar las zonas:", error);
    mostrarMensajeZonas("No se pudieron cargar las zonas.", "danger");
    tabla.textContent = "";
  }
}

async function guardarFormularioZona(evento) {
  evento.preventDefault();
  const boton = document.querySelector("#form-zona button[type='submit']");
  boton.disabled = true;
  try {
    await guardarZonaDelivery(zonaEnEdicion, {
      nombre: document.getElementById("zona-nombre").value,
      tarifa_envio: document.getElementById("zona-tarifa").value,
      activa: document.getElementById("zona-activa").checked
    });
    mostrarMensajeZonas("Zona guardada correctamente.", "success");
    limpiarFormularioZona();
    await cargarZonasAdmin();
  } catch (error) {
    console.error("No se pudo guardar la zona:", error);
    mostrarMensajeZonas(error.message || "No se pudo guardar la zona.", "danger");
  } finally {
    boton.disabled = false;
  }
}

async function gestionarZona(evento) {
  const boton = evento.target.closest("[data-action]");
  if (!boton) return;
  const zona = zonasAdministradas.find(item => item.id === boton.dataset.id);
  if (!zona) return;
  if (boton.dataset.action === "edit") {
    zonaEnEdicion = zona.id;
    document.getElementById("titulo-formulario").textContent = "Editar zona";
    document.getElementById("zona-nombre").value = zona.nombre;
    document.getElementById("zona-tarifa").value = Number(zona.tarifa_envio || 0);
    document.getElementById("zona-activa").checked = zona.activa !== false;
    document.getElementById("cancelar-edicion").classList.remove("d-none");
    document.getElementById("zona-nombre").focus();
    return;
  }

  boton.disabled = true;
  try {
    await guardarZonaDelivery(zona.id, {
      nombre: zona.nombre,
      tarifa_envio: zona.tarifa_envio,
      activa: zona.activa === false
    });
    mostrarMensajeZonas("Estado de zona actualizado.", "success");
    await cargarZonasAdmin();
  } catch (error) {
    console.error("No se pudo cambiar el estado de la zona:", error);
    mostrarMensajeZonas(error.message || "No se pudo actualizar la zona.", "danger");
    boton.disabled = false;
  }
}

function limpiarFormularioZona() {
  zonaEnEdicion = null;
  document.getElementById("form-zona").reset();
  document.getElementById("zona-activa").checked = true;
  document.getElementById("titulo-formulario").textContent = "Nueva zona";
  document.getElementById("cancelar-edicion").classList.add("d-none");
}

function mostrarMensajeZonas(mensaje, tipo) {
  const el = document.getElementById("mensaje-zonas");
  el.textContent = mensaje;
  el.className = `alert alert-${tipo}`;
}

protegerPagina(["administrador"]);
