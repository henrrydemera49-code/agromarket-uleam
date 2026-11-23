// ═══════════════════════════════════════════════════════
// db.js  —  Operaciones con Firestore
//
// ── MOO: ENCAPSULAMIENTO ─────────────────────────────
// Toda la lógica de la base de datos está aquí.
// Las páginas HTML solo llaman las funciones de abajo —
// no saben cómo funciona Firestore internamente.
//
// ── MOO: PATRÓN STATE ────────────────────────────────
// Los estados del pedido controlan qué puede pasar.
// Un pedido "entregado" no puede volver a "pendiente".
// ═══════════════════════════════════════════════════════


// ── PATRÓN STATE — transiciones válidas ──────────────
// Solo se puede cambiar al estado si está en la lista.
const TRANSICIONES_VALIDAS = {
  pendiente:      ["confirmado", "cancelado"],
  confirmado:     ["en_preparacion", "cancelado"],
  en_preparacion: ["en_camino", "listo_para_retirar"],
  en_camino:      ["entregado"],
  listo_para_retirar: ["entregado"],
  entregado:      [],   // estado final
  cancelado:      []    // estado final
};

function puedeTransicionar(estadoActual, nuevoEstado) {
  return (TRANSICIONES_VALIDAS[estadoActual] || []).includes(nuevoEstado);
}

// Etiquetas para mostrar en pantalla
const ETIQUETAS_ESTADO = {
  pendiente:      "Pendiente",
  confirmado:     "Confirmado",
  en_preparacion: "En Preparación",
  en_camino:      "En Camino",
  listo_para_retirar: "Listo para retirar",
  entregado:      "Entregado",
  cancelado:      "Cancelado"
};


// ── USUARIOS ─────────────────────────────────────────

async function obtenerUsuario(uid) {
  const doc = await db.collection("usuarios").doc(uid).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function crearUsuarioDB(uid, datos) {
  // MOO: HERENCIA — todos los usuarios tienen la misma
  // estructura base. El campo "rol" los diferencia.
  await db.collection("usuarios").doc(uid).set({
    nombre:   datos.nombre,
    apellido: datos.apellido,
    correo:   datos.correo,
    rol:      "cliente",   // siempre empieza como cliente
    activo:   true,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  });
}

async function listarUsuarios() {
  const snap = await db.collection("usuarios").orderBy("nombre").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function listarRepartidores() {
  const snap = await db.collection("usuarios")
    .where("rol", "==", "repartidor").get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(usuario => usuario.activo !== false)
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function actualizarUsuarioAdmin(uid, datos) {
  const rolesPermitidos = ["cliente", "administrador", "repartidor"];
  if (!rolesPermitidos.includes(datos.rol) || typeof datos.activo !== "boolean") {
    throw new Error("El rol o el estado del usuario no son válidos.");
  }
  if (!auth.currentUser) throw new Error("Debes iniciar sesión para editar usuarios.");
  if (uid === auth.currentUser.uid
      && (datos.rol !== "administrador" || datos.activo !== true)) {
    throw new Error("No puedes cambiar ni desactivar tu propio acceso de administrador.");
  }
  await db.collection("usuarios").doc(uid).update({
    rol: datos.rol,
    activo: datos.activo,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  });
}


// ── PRODUCTOS ────────────────────────────────────────

async function listarProductos() {
  const snap = await db.collection("productos")
    .where("activo", "==", true).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function listarTodosProductos() {
  const snap = await db.collection("productos").orderBy("nombre").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function obtenerProducto(id) {
  const doc = await db.collection("productos").doc(id).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function listarCategorias(soloActivas = false) {
  let query = db.collection("categorias");
  if (soloActivas) query = query.where("activo", "==", true);
  const snap = await query.get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function guardarCategoria(id, datos) {
  const nombre = String(datos.nombre || "").trim();
  if (!nombre || typeof datos.activo !== "boolean") {
    throw new Error("El nombre y el estado de la categoría son obligatorios.");
  }
  const referencia = id
    ? db.collection("categorias").doc(id)
    : db.collection("categorias").doc();
  const categoria = {
    nombre,
    descripcion: String(datos.descripcion || "").trim(),
    activo: datos.activo,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!id) categoria.created_at = firebase.firestore.FieldValue.serverTimestamp();
  if (id) await referencia.set(categoria, { merge: true });
  else await referencia.set(categoria);
  return referencia.id;
}

async function crearProducto(datos) {
  const cantidadInicial = Number(datos.stock_actual || 0);
  if (!datos.nombre || !Number.isFinite(Number(datos.precio))
      || Number(datos.precio) <= 0 || !Number.isInteger(cantidadInicial)
      || cantidadInicial < 0 || !datos.categoria_id) {
    throw new Error("Los datos del producto no son válidos.");
  }
  if (!auth.currentUser) throw new Error("Debes iniciar sesión para crear productos.");

  const productoRef = db.collection("productos").doc();
  const producto = {
    ...datos,
    stock_actual: cantidadInicial,
    activo: datos.activo !== false,
    created_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  const batch = db.batch();
  batch.set(productoRef, producto);
  if (cantidadInicial > 0) {
    const movimientoRef = db.collection("movimientos_stock").doc();
    batch.set(movimientoRef, {
      producto_id: productoRef.id,
      tipo: "entrada",
      cantidad: cantidadInicial,
      motivo: "Stock inicial",
      usuario_id: auth.currentUser.uid,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  }
  await batch.commit();
  return productoRef.id;
}

async function actualizarProducto(id, datos) {
  await db.collection("productos").doc(id).update({
    ...datos,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  });
}

function normalizarDetallesStock(detalles) {
  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw new Error("El pedido no contiene productos.");
  }

  const cantidades = new Map();
  detalles.forEach(detalle => {
    const productoId = detalle.producto_id || detalle.id;
    const cantidad = Number(detalle.cantidad);
    if (!productoId || !Number.isInteger(cantidad) || cantidad <= 0) {
      throw new Error("El detalle del producto o la cantidad no es válido.");
    }
    cantidades.set(productoId, (cantidades.get(productoId) || 0) + cantidad);
  });
  return cantidades;
}

async function actualizarStockEnTransaccion(transaction, cantidades, usuarioId) {
  const productoIds = Array.from(cantidades.keys());
  const productos = await Promise.all(productoIds.map(id =>
    transaction.get(db.collection("productos").doc(id))
  ));
  const movimientos = [];
  const detallesPedido = [];

  productos.forEach((productoDoc, index) => {
    const cantidad = cantidades.get(productoIds[index]);
    if (!productoDoc.exists) {
      throw new Error("Uno de los productos del pedido ya no existe.");
    }
    const producto = productoDoc.data();
    const stockActual = Number(producto.stock_actual || 0);
    if (producto.activo === false) {
      throw new Error(`El producto "${producto.nombre}" ya no está disponible.`);
    }
    if (stockActual < cantidad) {
      throw new Error(`Stock insuficiente para "${producto.nombre}".`);
    }
    const precio = Number(producto.precio);
    if (!Number.isFinite(precio) || precio <= 0) {
      throw new Error(`El precio de "${producto.nombre}" no es válido.`);
    }

    const movimientoRef = db.collection("movimientos_stock").doc();
    transaction.update(productoDoc.ref, {
      stock_actual: stockActual - cantidad,
      stock_movimiento_id: movimientoRef.id,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    const movimiento = {
      producto_id: productoDoc.id,
      tipo: "salida",
      cantidad,
      motivo: "Compra",
      usuario_id: usuarioId,
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    };
    transaction.set(movimientoRef, movimiento);
    movimientos.push(movimiento);
    detallesPedido.push({
      producto_id: productoDoc.id,
      nombre: producto.nombre,
      cantidad,
      precio_unitario: precio
    });
  });
  return { movimientos, detalles: detallesPedido };
}

async function descontarStock(detalles, usuarioId = auth.currentUser?.uid) {
  if (!usuarioId) throw new Error("Se requiere un usuario autenticado.");
  const cantidades = normalizarDetallesStock(detalles);
  return db.runTransaction(async transaction => {
    const resultado = await actualizarStockEnTransaccion(
      transaction,
      cantidades,
      usuarioId
    );
    return resultado.movimientos;
  });
}


// ── PEDIDOS ──────────────────────────────────────────

async function crearPedido(datos) {
  return crearPedidoConStock(datos);
}

async function crearPedidoConStock(datos) {
  const usuarioAuth = auth.currentUser;
  if (!usuarioAuth) throw new Error("Debes iniciar sesión para crear un pedido.");
  if (!["delivery", "retiro"].includes(datos.tipo)) {
    throw new Error("El tipo de pedido no es válido.");
  }
  if (!["efectivo", "transferencia"].includes(datos.forma_pago)) {
    throw new Error("La forma de pago no es válida.");
  }
  if (datos.forma_pago === "transferencia" && !datos.comprobante_url) {
    throw new Error("Adjunta el comprobante de transferencia.");
  }

  const cliente = await obtenerUsuario(usuarioAuth.uid);
  if (!cliente) throw new Error("No se encontró el perfil del cliente.");
  const cantidades = normalizarDetallesStock(datos.detalles);
  const pedidoRef = db.collection("pedidos").doc();

  return db.runTransaction(async transaction => {
    let zona = null;
    if (datos.tipo === "delivery") {
      if (!datos.zona_id || !datos.direccion_entrega) {
        throw new Error("Indica la zona y dirección de entrega.");
      }
      const zonaDoc = await transaction.get(
        db.collection("zonas_delivery").doc(datos.zona_id)
      );
      if (!zonaDoc.exists || zonaDoc.data().activa === false) {
        throw new Error("La zona de entrega no está disponible.");
      }
      zona = zonaDoc.data();
    }

    const resultado = await actualizarStockEnTransaccion(
      transaction,
      cantidades,
      usuarioAuth.uid
    );
    const detallesPedido = resultado.detalles.map(detalle => ({
      producto_id: detalle.producto_id,
      nombre: detalle.nombre,
      cantidad: detalle.cantidad,
      precio_unitario: detalle.precio_unitario,
      subtotal: detalle.precio_unitario * detalle.cantidad
    }));
    const subtotal = detallesPedido.reduce((total, detalle) =>
      total + detalle.subtotal, 0
    );
    const tarifaEnvio = zona ? Number(zona.tarifa_envio || 0) : 0;
    const formaPago = datos.forma_pago;

    transaction.set(pedidoRef, {
      cliente_id: usuarioAuth.uid,
      cliente_nombre: `${cliente.nombre || ""} ${cliente.apellido || ""}`.trim(),
      tipo: datos.tipo,
      estado: "pendiente",
      subtotal,
      tarifa_envio: tarifaEnvio,
      total: subtotal + tarifaEnvio,
      zona_id: zona ? datos.zona_id : null,
      direccion_entrega: datos.tipo === "delivery" ? datos.direccion_entrega : null,
      forma_pago: formaPago,
      comprobante_url: formaPago === "transferencia" ? datos.comprobante_url : null,
      repartidor_id: null,
      notas: datos.notas || "",
      detalles: detallesPedido,
      historial: [{
        estado_nuevo: "pendiente",
        fecha: new Date().toISOString(),
        nota: "Pedido creado"
      }],
      created_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    return pedidoRef.id;
  });
}

async function listarPedidosCliente(clienteId) {
  const snap = await db.collection("pedidos")
    .where("cliente_id", "==", clienteId)
    .orderBy("created_at", "desc").get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function listarTodosPedidos(estado = "") {
  let query = db.collection("pedidos");
  if (estado) {
    query = query.where("estado", "==", estado);
  } else {
    query = query.orderBy("created_at", "desc");
  }
  const snap = await query.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function listarPedidosRepartidor(repartidorId = auth.currentUser?.uid) {
  if (!repartidorId || !auth.currentUser || auth.currentUser.uid !== repartidorId) {
    throw new Error("Solo puedes consultar las entregas de tu cuenta.");
  }
  const usuario = await obtenerUsuario(repartidorId);
  if (!usuario || usuario.activo === false || usuario.rol !== "repartidor") {
    throw new Error("La cuenta no tiene permisos de repartidor activos.");
  }
  const snap = await db.collection("pedidos")
    .where("repartidor_id", "==", repartidorId).get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(pedido => ["en_camino", "listo_para_retirar"].includes(pedido.estado))
    .sort((a, b) => {
      const fechaA = a.created_at?.toDate?.()?.getTime() || 0;
      const fechaB = b.created_at?.toDate?.()?.getTime() || 0;
      return fechaA - fechaB;
    });
}

async function obtenerPedido(pedidoId) {
  const doc = await db.collection("pedidos").doc(pedidoId).get();
  return doc.exists ? { id: doc.id, ...doc.data() } : null;
}

async function asignarPedidoARepartidor(pedidoId, repartidorId) {
  if (!auth.currentUser) throw new Error("Debes iniciar sesión para asignar pedidos.");
  const pedidoRef = db.collection("pedidos").doc(pedidoId);
  const repartidorRef = db.collection("usuarios").doc(repartidorId);

  await db.runTransaction(async transaction => {
    const pedidoDoc = await transaction.get(pedidoRef);
    const repartidorDoc = await transaction.get(repartidorRef);
    if (!pedidoDoc.exists) throw new Error("El pedido no existe.");
    if (!repartidorDoc.exists
        || repartidorDoc.data().rol !== "repartidor"
        || repartidorDoc.data().activo === false) {
      throw new Error("Selecciona un repartidor activo.");
    }

    const pedido = pedidoDoc.data();
    if (pedido.tipo !== "delivery") {
      throw new Error("Solo se pueden asignar pedidos de delivery.");
    }
    if (!puedeTransicionar(pedido.estado, "en_camino")) {
      throw new Error("El pedido debe estar en preparación para asignarlo.");
    }

    transaction.update(pedidoRef, {
      estado: "en_camino",
      repartidor_id: repartidorId,
      historial: [
        ...(pedido.historial || []),
        {
          estado_nuevo: "en_camino",
          fecha: new Date().toISOString(),
          nota: `Asignado a ${repartidorDoc.data().nombre || "repartidor"}`,
          usuario_id: auth.currentUser.uid
        }
      ],
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function listarZonasDelivery() {
  const snap = await db.collection("zonas_delivery")
    .where("activa", "==", true).get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function listarTodasZonasDelivery() {
  const snap = await db.collection("zonas_delivery").get();
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));
}

async function guardarZonaDelivery(id, datos) {
  const nombre = String(datos.nombre || "").trim();
  const tarifa = Number(datos.tarifa_envio);
  if (!nombre || datos.tarifa_envio === "" || datos.tarifa_envio == null
      || !Number.isFinite(tarifa) || tarifa < 0
      || typeof datos.activa !== "boolean") {
    throw new Error("El nombre, tarifa o estado de la zona no son válidos.");
  }
  const referencia = id
    ? db.collection("zonas_delivery").doc(id)
    : db.collection("zonas_delivery").doc();
  const zona = {
    nombre,
    tarifa_envio: tarifa,
    activa: datos.activa,
    updated_at: firebase.firestore.FieldValue.serverTimestamp()
  };
  if (!id) zona.created_at = firebase.firestore.FieldValue.serverTimestamp();
  if (id) await referencia.set(zona, { merge: true });
  else await referencia.set(zona);
  return referencia.id;
}

async function cambiarEstadoPedido(pedidoId, nuevoEstado, nota = "") {
  const pedidoRef = db.collection("pedidos").doc(pedidoId);
  await db.runTransaction(async transaction => {
    const pedidoDoc = await transaction.get(pedidoRef);
    if (!pedidoDoc.exists) throw new Error("El pedido no existe.");
    const pedido = pedidoDoc.data();
    if (!puedeTransicionar(pedido.estado, nuevoEstado)) {
      throw new Error(`No se puede cambiar de "${pedido.estado}" a "${nuevoEstado}".`);
    }
    const usuarioId = auth.currentUser && auth.currentUser.uid;
    transaction.update(pedidoRef, {
      estado: nuevoEstado,
      historial: [
        ...(pedido.historial || []),
        {
          estado_nuevo: nuevoEstado,
          fecha: new Date().toISOString(),
          nota,
          usuario_id: usuarioId || null
        }
      ],
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
  });
}

async function cargarDatosIniciales() {
  const usuario = auth.currentUser && await obtenerUsuario(auth.currentUser.uid);
  if (!usuario || usuario.activo === false || usuario.rol !== "administrador") {
    throw new Error("Solo un administrador puede cargar los datos iniciales.");
  }

  const categorias = [
    { id: "verduras", nombre: "Verduras", descripcion: "Hortalizas frescas" },
    { id: "frutas", nombre: "Frutas", descripcion: "Frutas de temporada" },
    { id: "lacteos", nombre: "Lácteos", descripcion: "Leche y derivados" },
    { id: "otros", nombre: "Otros", descripcion: "Otros productos" }
  ];
  const zonas = [
    { id: "bloque-a", nombre: "Bloque A", tarifa_envio: 0.5 },
    { id: "bloque-b", nombre: "Bloque B", tarifa_envio: 0.75 },
    { id: "bloque-c", nombre: "Bloque C", tarifa_envio: 1 }
  ];
  const batch = db.batch();
  let cambios = 0;

  for (const categoria of categorias) {
    const ref = db.collection("categorias").doc(categoria.id);
    const doc = await ref.get();
    if (!doc.exists) {
      batch.set(ref, {
        nombre: categoria.nombre,
        descripcion: categoria.descripcion,
        activo: true,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      cambios++;
    }
  }
  for (const zona of zonas) {
    const ref = db.collection("zonas_delivery").doc(zona.id);
    const doc = await ref.get();
    if (!doc.exists) {
      batch.set(ref, {
        nombre: zona.nombre,
        tarifa_envio: zona.tarifa_envio,
        activa: true,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
      cambios++;
    }
  }
  if (cambios > 0) await batch.commit();
}

async function subirImagen(archivo, carpeta) {
  if (!archivo || !archivo.type || !archivo.type.startsWith("image/")) {
    throw new Error("Selecciona un archivo de imagen válido.");
  }
  if (!["comprobantes", "productos"].includes(carpeta)) {
    throw new Error("La carpeta de almacenamiento no está permitida.");
  }
  if (archivo.size > 5 * 1024 * 1024) {
    throw new Error("La imagen no puede superar los 5 MB.");
  }
  const usuario = auth.currentUser;
  if (!usuario) throw new Error("Debes iniciar sesión para subir imágenes.");

  const nombreArchivo = archivo.name.replace(/[^\w.-]/g, "_");
  const nombre = `${Date.now()}_${Math.random().toString(36).slice(2)}_${nombreArchivo}`;
  const referencia = storage.ref().child(`${carpeta}/${usuario.uid}/${nombre}`);
  const resultado = await referencia.put(archivo);
  return resultado.ref.getDownloadURL();
}
