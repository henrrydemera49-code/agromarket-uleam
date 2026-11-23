async function iniciarPagina() {
  cargarNavbar();
  document.getElementById("actualizar-entregas")
    .addEventListener("click", cargarEntregas);
  document.getElementById("lista-entregas").addEventListener("click", evento => {
    const boton = evento.target.closest("[data-action='complete-delivery']");
    if (boton) completarEntrega(boton);
  });
  await cargarEntregas();
}

async function cargarEntregas() {
  const lista = document.getElementById("lista-entregas");
  const boton = document.getElementById("actualizar-entregas");
  boton.disabled = true;
  document.getElementById("mensaje-entregas").classList.add("d-none");
  try {
    const pedidos = await listarPedidosRepartidor();
    if (!pedidos.length) {
      lista.innerHTML = `<div class="card shadow-sm border-0">
        <div class="card-body text-center py-5">
          <i class="bi bi-box-seam fs-1 text-success"></i>
          <p class="text-muted mt-2 mb-0">No tienes entregas pendientes asignadas.</p>
        </div>
      </div>`;
      return;
    }

    lista.innerHTML = `<div class="row g-3">
      ${pedidos.map(pedido => `
        <div class="col-12">
          <article class="card shadow-sm border-0">
            <div class="card-body">
              <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
                <div>
                  <h5 class="fw-bold mb-1">
                    Pedido #${escaparHTML(pedido.id.slice(0, 8).toUpperCase())}
                  </h5>
                  <small class="text-muted">
                    ${pedido.tipo === "delivery" ? "Delivery" : "Retiro"}
                    · ${escaparHTML(ETIQUETAS_ESTADO[pedido.estado] || pedido.estado)}
                  </small>
                </div>
                <strong class="text-success fs-5">${fmt(pedido.total)}</strong>
              </div>
              <div class="row g-3">
                <div class="col-md-4">
                  <div class="small text-muted">Cliente</div>
                  <div class="fw-semibold">${escaparHTML(pedido.cliente_nombre || "—")}</div>
                </div>
                <div class="col-md-5">
                  <div class="small text-muted">Dirección</div>
                  <div class="fw-semibold">${escaparHTML(pedido.direccion_entrega || "Retiro en el punto acordado")}</div>
                </div>
                <div class="col-md-3">
                  <div class="small text-muted">Forma de pago</div>
                  <div class="fw-semibold">${pedido.forma_pago === "transferencia" ? "Transferencia" : "Efectivo"}</div>
                </div>
              </div>
              <hr>
              <div class="fw-semibold mb-2">Productos</div>
              <ul class="mb-3">
                ${(pedido.detalles || []).map(detalle => `
                  <li>${escaparHTML(detalle.nombre || "Producto")} × ${Number(detalle.cantidad || 0)}</li>
                `).join("")}
              </ul>
              ${pedido.notas
                ? `<p class="small text-muted"><strong>Notas:</strong> ${escaparHTML(pedido.notas)}</p>` : ""}
              <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
                <a class="btn btn-outline-success btn-sm"
                  href="../pedido-detalle.html?id=${encodeURIComponent(pedido.id)}">
                  Ver pedido completo
                </a>
                <button class="btn btn-success" type="button"
                  data-action="complete-delivery" data-order-id="${escaparHTML(pedido.id)}">
                  <i class="bi bi-check2-circle"></i> Marcar como entregado
                </button>
              </div>
            </div>
          </article>
        </div>`).join("")}
    </div>`;
  } catch (error) {
    console.error("No se pudieron cargar las entregas:", error);
    mostrarMensajeEntregas(error.message || "No se pudieron cargar las entregas.", "danger");
    lista.textContent = "";
  } finally {
    boton.disabled = false;
  }
}

async function completarEntrega(boton) {
  boton.disabled = true;
  try {
    await cambiarEstadoPedido(
      boton.dataset.orderId,
      "entregado",
      "Entrega confirmada por el repartidor"
    );
    mostrarMensajeEntregas("Pedido marcado como entregado.", "success");
    await cargarEntregas();
  } catch (error) {
    console.error("No se pudo completar la entrega:", error);
    mostrarMensajeEntregas(error.message || "No se pudo completar la entrega.", "danger");
    boton.disabled = false;
  }
}

function mostrarMensajeEntregas(mensaje, tipo) {
  const el = document.getElementById("mensaje-entregas");
  el.textContent = mensaje;
  el.className = `alert alert-${tipo}`;
}

protegerPagina(["repartidor"]);
