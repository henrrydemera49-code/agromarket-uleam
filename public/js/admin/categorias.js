let categoriasAdministradas = [];
let categoriaEnEdicion = null;

async function iniciarPagina() {
  cargarNavbar();
  document.getElementById("form-categoria").addEventListener("submit", guardarFormularioCategoria);
  document.getElementById("cancelar-edicion").addEventListener("click", limpiarFormularioCategoria);
  document.getElementById("cargar-iniciales").addEventListener("click", cargarIniciales);
  document.getElementById("tabla-categorias").addEventListener("click", gestionarCategoria);
  await cargarCategoriasAdmin();
}

async function cargarCategoriasAdmin() {
  const tabla = document.getElementById("tabla-categorias");
  try {
    categoriasAdministradas = await listarCategorias();
    if (!categoriasAdministradas.length) {
      tabla.innerHTML = `<p class="text-center text-muted p-4">No hay categorías registradas.</p>`;
      return;
    }
    tabla.innerHTML = `<table class="table mb-0 align-middle">
      <thead class="table-success"><tr><th>Categoría</th><th>Descripción</th><th>Estado</th><th></th></tr></thead>
      <tbody>${categoriasAdministradas.map(categoria => `
        <tr>
          <td class="fw-semibold">${escaparHTML(categoria.nombre)}</td>
          <td>${escaparHTML(categoria.descripcion || "—")}</td>
          <td><span class="badge ${categoria.activo ? "text-bg-success" : "text-bg-secondary"}">
            ${categoria.activo ? "Activa" : "Inactiva"}</span></td>
          <td class="text-nowrap">
            <button class="btn btn-outline-success btn-sm" type="button"
              data-action="edit" data-id="${escaparHTML(categoria.id)}">Editar</button>
            <button class="btn btn-outline-secondary btn-sm" type="button"
              data-action="toggle" data-id="${escaparHTML(categoria.id)}">
              ${categoria.activo ? "Desactivar" : "Activar"}</button>
          </td>
        </tr>`).join("")}</tbody>
    </table>`;
  } catch (error) {
    console.error("No se pudieron cargar las categorías:", error);
    mostrarMensajeCategorias("No se pudieron cargar las categorías.", "danger");
    tabla.textContent = "";
  }
}

async function guardarFormularioCategoria(evento) {
  evento.preventDefault();
  const boton = document.getElementById("guardar-categoria");
  boton.disabled = true;
  try {
    await guardarCategoria(categoriaEnEdicion, {
      nombre: document.getElementById("categoria-nombre").value,
      descripcion: document.getElementById("categoria-descripcion").value,
      activo: document.getElementById("categoria-activa").checked
    });
    mostrarMensajeCategorias("Categoría guardada correctamente.", "success");
    limpiarFormularioCategoria();
    await cargarCategoriasAdmin();
  } catch (error) {
    console.error("No se pudo guardar la categoría:", error);
    mostrarMensajeCategorias(error.message || "No se pudo guardar la categoría.", "danger");
  } finally {
    boton.disabled = false;
  }
}

async function gestionarCategoria(evento) {
  const boton = evento.target.closest("[data-action]");
  if (!boton) return;
  const categoria = categoriasAdministradas.find(item => item.id === boton.dataset.id);
  if (!categoria) return;
  if (boton.dataset.action === "edit") {
    categoriaEnEdicion = categoria.id;
    document.getElementById("titulo-formulario").textContent = "Editar categoría";
    document.getElementById("categoria-nombre").value = categoria.nombre;
    document.getElementById("categoria-descripcion").value = categoria.descripcion || "";
    document.getElementById("categoria-activa").checked = categoria.activo !== false;
    document.getElementById("cancelar-edicion").classList.remove("d-none");
    document.getElementById("categoria-nombre").focus();
    return;
  }

  boton.disabled = true;
  try {
    await guardarCategoria(categoria.id, {
      nombre: categoria.nombre,
      descripcion: categoria.descripcion,
      activo: categoria.activo === false
    });
    mostrarMensajeCategorias("Estado de categoría actualizado.", "success");
    await cargarCategoriasAdmin();
  } catch (error) {
    console.error("No se pudo cambiar el estado de la categoría:", error);
    mostrarMensajeCategorias(error.message || "No se pudo actualizar la categoría.", "danger");
    boton.disabled = false;
  }
}

function limpiarFormularioCategoria() {
  categoriaEnEdicion = null;
  document.getElementById("form-categoria").reset();
  document.getElementById("categoria-activa").checked = true;
  document.getElementById("titulo-formulario").textContent = "Nueva categoría";
  document.getElementById("cancelar-edicion").classList.add("d-none");
}

async function cargarIniciales() {
  const boton = document.getElementById("cargar-iniciales");
  boton.disabled = true;
  try {
    await cargarDatosIniciales();
    mostrarMensajeCategorias("Categorías y zonas iniciales cargadas.", "success");
    await cargarCategoriasAdmin();
  } catch (error) {
    console.error("No se pudieron cargar los datos iniciales:", error);
    mostrarMensajeCategorias(error.message || "No se pudieron cargar los datos iniciales.", "danger");
  } finally {
    boton.disabled = false;
  }
}

function mostrarMensajeCategorias(mensaje, tipo) {
  const el = document.getElementById("mensaje-categorias");
  el.textContent = mensaje;
  el.className = `alert alert-${tipo}`;
}

protegerPagina(["administrador"]);
