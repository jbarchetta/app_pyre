const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

// Lee el body de una respuesta de error y usa el campo `detail` que devuelve
// FastAPI (`HTTPException(detail=...)`) en vez de un mensaje genérico
// hardcodeado, para que el analista vea el motivo real (ej. "La carga en
// amperios debe ser un número entero") en vez de "No se pudo crear la salida".
// Si el body no es JSON válido (error de red, 500 sin body, etc.) se usa el
// mensaje de fallback.
async function lanzarSiNoOk(response: Response, mensajePorDefecto: string): Promise<void> {
  if (response.ok) return;
  let detalle: string | undefined;
  try {
    const body = await response.json();
    detalle = typeof body?.detail === "string" ? body.detail : undefined;
  } catch {
    // body no es JSON válido -- se usa el fallback
  }
  throw new Error(detalle ?? mensajePorDefecto);
}

export type RolUsuarioType = "analista" | "supervisor" | "administrador" | "desarrollador";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuarioType;
  activo?: boolean;
}

export interface UsuarioGestion {
  id: string;
  email: string;
  nombre: string;
  rol: RolUsuarioType;
  activo: boolean;
  creado_en: string;
}

export interface AuditLogEntry {
  id: string;
  usuario_id?: string | null;
  usuario_nombre?: string | null;
  usuario_email?: string | null;
  accion: string;
  entidad: string;
  entidad_id?: string | null;
  detalle?: Record<string, any> | null;
  creado_en: string;
}

export async function login(email: string, password: string): Promise<Usuario> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  await lanzarSiNoOk(response, "Credenciales inválidas");

  return response.json();
}

export async function restablecerPassword(email: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, new_password: newPassword }),
  });

  await lanzarSiNoOk(response, "No se pudo restablecer la contraseña");
  return response.json();
}

export async function cambiarPasswordSelf(currentPassword: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/auth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
  });

  await lanzarSiNoOk(response, "No se pudo actualizar la contraseña");
  return response.json();
}

export async function fetchCurrentUser(): Promise<Usuario | null> {
  const response = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" });
}

export async function listarUsuarios(): Promise<UsuarioGestion[]> {
  const response = await fetch(`${API_BASE_URL}/usuarios`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar los usuarios");
  return response.json();
}

export async function crearUsuario(datos: { email: string; nombre: string; rol: RolUsuarioType; password: string }): Promise<UsuarioGestion> {
  const response = await fetch(`${API_BASE_URL}/usuarios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  await lanzarSiNoOk(response, "No se pudo crear el usuario");
  return response.json();
}

export async function actualizarUsuario(
  id: string,
  datos: { nombre?: string; rol?: RolUsuarioType; activo?: boolean }
): Promise<UsuarioGestion> {
  const response = await fetch(`${API_BASE_URL}/usuarios/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  await lanzarSiNoOk(response, "No se pudo actualizar el usuario");
  return response.json();
}

export async function resetPasswordAdmin(id: string, newPassword: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/usuarios/${id}/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ new_password: newPassword }),
  });
  await lanzarSiNoOk(response, "No se pudo resetear la contraseña del usuario");
  return response.json();
}

export async function desactivarUsuario(id: string): Promise<{ message: string }> {
  const response = await fetch(`${API_BASE_URL}/usuarios/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo desactivar el usuario");
  return response.json();
}

export interface OpcionesAuditoria {
  acciones: string[];
  entidades: string[];
}

export async function obtenerOpcionesAuditoria(): Promise<OpcionesAuditoria> {
  const response = await fetch(`${API_BASE_URL}/auditoria/opciones`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron obtener las opciones de auditoría");
  return response.json();
}

export async function listarAuditoria(filtros?: { q?: string; entidad?: string; accion?: string; limit?: number }): Promise<AuditLogEntry[]> {
  const params = new URLSearchParams();
  if (filtros?.q) params.set("q", filtros.q);
  if (filtros?.entidad) params.set("entidad", filtros.entidad);
  if (filtros?.accion) params.set("accion", filtros.accion);
  if (filtros?.limit) params.set("limit", filtros.limit.toString());

  const response = await fetch(`${API_BASE_URL}/auditoria?${params.toString()}`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo consultar el registro de auditoría");
  return response.json();
}

export interface ResumenImportCatalogo {
  total_filas: number;
  nuevos: number;
  actualizados: number;
  sin_cambios: number;
}

export async function importarCatalogo(proveedor: string, archivo: File): Promise<ResumenImportCatalogo> {
  const formData = new FormData();
  formData.append("proveedor", proveedor);
  formData.append("archivo", archivo);

  const response = await fetch(`${API_BASE_URL}/catalogo/importar`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  await lanzarSiNoOk(response, "No se pudo importar el catálogo");

  return response.json();
}

export interface Proyecto {
  id: string;
  cliente: string;
  nombre: string;
  codigo_obra?: string | null;
  fecha_inicio?: string | null;
  analista_id: string;
  analista_nombre?: string | null;
  analista_email?: string | null;
  estado: string;
  creado_en?: string | null;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar los proyectos");
  return response.json();
}

export interface ProyectoCreateInput {
  cliente: string;
  nombre: string;
  codigo_obra?: string;
  fecha_inicio?: string;
}

export async function crearProyecto(datos: { cliente: string; nombre: string; codigo_obra?: string; fecha_inicio?: string }): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  await lanzarSiNoOk(response, "No se pudo crear el proyecto");
  return response.json();
}

export async function obtenerProyecto(id: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo obtener el proyecto");
  return response.json();
}

export interface ProyectoUpdate {
  nombre?: string;
  cliente?: string;
  codigo_obra?: string;
  fecha_inicio?: string;
  estado?: string;
}

export async function actualizarProyecto(id: string, cambios: ProyectoUpdate): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  await lanzarSiNoOk(response, "No se pudo actualizar el proyecto");
  return response.json();
}

export async function eliminarProyecto(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar el proyecto");
}

export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
  interruptor_principal_codigo?: string | null;
  interruptor_principal_codigo_comercial?: string | null;
  interruptor_principal_descripcion?: string | null;
  interruptor_principal_polos?: number | null;
  interruptor_principal_corriente_nominal_a?: string | null;
  interruptor_principal_capacidad_corte_ka?: string | null;
  principal_metodo_entrada?: string | null;
  principal_metodo_salida?: string | null;
  borneras_tipo?: string | null;
  lleva_banquitos?: boolean;
  porcentaje_reserva?: number;
  gabinete_sugerido_id?: string | null;
  gabinete_sugerido_codigo?: string | null;
  gabinete_sugerido_ancho_mm?: number | null;
  gabinete_sugerido_alto_mm?: number | null;
  gabinete_alternativo_id?: string | null;
  gabinete_alternativo_codigo?: string | null;
  gabinete_alternativo_ancho_mm?: number | null;
  gabinete_alternativo_alto_mm?: number | null;
  porcentaje_ocupacion?: number | null;
  excede_largo_riel?: boolean | null;
  max_polos_por_fila?: number | null;
  capacidad_polos_linea?: number | null;
  siguiente_gabinete_ancho_mm?: number | null;
  distribuidor_sugerido_id?: string | null;
  distribuidor_sugerido_codigo?: string | null;
  cablecanal_sugerido?: string | null;
  cablecanal_periferia?: string | null;
  cablecanal_interiores?: string | null;
  paso_mm?: number;
  paso_manual?: number | null;
  gabinete_manual_ancho_mm?: number | null;
  gabinete_manual_alto_mm?: number | null;
}

export async function listarTableros(proyectoId: string): Promise<Tablero[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/tableros`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar los tableros");
  return response.json();
}

export async function crearTablero(
  proyectoId: string,
  nombre: string,
  nivelFallaKa: string,
  interruptorPrincipalId: string | null,
): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/tableros`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({
      nombre,
      nivel_falla_ka: nivelFallaKa,
      interruptor_principal_id: interruptorPrincipalId,
      porcentaje_reserva: 0,
    }),
  });
  await lanzarSiNoOk(response, "No se pudo crear el tablero");
  return response.json();
}

export async function obtenerTablero(id: string): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo obtener el tablero");
  return response.json();
}

export interface TableroUpdate {
  nombre?: string;
  nivel_falla_ka?: string;
  interruptor_principal_id?: string | null;
  principal_metodo_entrada?: string | null;
  principal_metodo_salida?: string | null;
  borneras_tipo?: string | null;
  lleva_banquitos?: boolean;
  porcentaje_reserva?: number;
  paso_manual?: number | null;
  gabinete_manual_ancho_mm?: number | null;
  gabinete_manual_alto_mm?: number | null;
  cablecanal_sugerido?: string | null;
  cablecanal_periferia?: string | null;
  cablecanal_interiores?: string | null;
  gabinete_sugerido_ancho_mm?: number | null;
  gabinete_sugerido_alto_mm?: number | null;
}

export async function actualizarTablero(id: string, cambios: TableroUpdate): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  await lanzarSiNoOk(response, "No se pudo actualizar el tablero");
  return response.json();
}

export async function eliminarTablero(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar el tablero");
}

export interface Seccion {
  id: string;
  tablero_id: string;
  nombre: string;
  orden: number;
  paso_mm?: number;
  paso_manual?: number | null;
}

export async function listarSecciones(tableroId: string): Promise<Seccion[]> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar las secciones");
  return response.json();
}

export async function crearSeccion(tableroId: string, nombre: string, orden: number): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nombre, orden }),
  });
  await lanzarSiNoOk(response, "No se pudo crear la sección");
  return response.json();
}

export interface SeccionUpdate {
  nombre?: string;
  paso_manual?: number | null;
}

export async function actualizarSeccion(id: string, cambios: SeccionUpdate): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  await lanzarSiNoOk(response, "No se pudo actualizar la sección");
  return response.json();
}

export async function eliminarSeccion(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar la sección");
}

export type FormatoPolos = "unipolar" | "bipolar" | "tripolar" | "tetrapolar";
export type TipoProteccion = "seccional_termomagnetico" | "seccional_diferencial";

export interface Salida {
  id: string;
  seccion_id: string;
  etiqueta?: string | null;
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
  sensibilidad_ma?: number | null;
  admite_accesorios?: boolean | null;
  componente_id: string | null;
  componente_codigo?: string | null;
  componente_codigo_comercial?: string | null;
  componente_descripcion?: string | null;
  origen: string;
  asignado_manualmente: boolean;
  posicion_orden: number;
  posicion_codigo?: string | null;
  orden?: number;
  descripcion_personalizada?: string | null;
  corriente_nominal_a?: number | string | null;
  curva?: string | null;
  seccion_cable_mm2?: number | string | null;
  motivo_sin_match?: string | null;
  alimentado_por_salida_id?: string | null;
  alimentado_por_codigo?: string | null;
}

export interface SalidaInput {
  etiqueta?: string;
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
  sensibilidad_ma?: number | null;
  admite_accesorios?: boolean | null;
  alimentado_por_salida_id?: string | null;
}

export async function listarSalidas(seccionId: string): Promise<Salida[]> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar las salidas");
  return response.json();
}

export async function crearSalida(seccionId: string, datos: SalidaInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  await lanzarSiNoOk(response, "No se pudo crear la salida");
  return response.json();
}

export interface SalidaUpdateInput {
  seccion_id?: string;
  etiqueta?: string;
  carga_valor?: string;
  carga_unidad?: string;
  formato?: FormatoPolos;
  tipo_proteccion?: TipoProteccion;
  sensibilidad_ma?: number | null;
  admite_accesorios?: boolean | null;
  componente_id?: string | null;
  asignado_manualmente?: boolean;
  alimentado_por_salida_id?: string | null;
}

export async function actualizarSalida(salidaId: string, cambios: SalidaUpdateInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/salidas/${salidaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  await lanzarSiNoOk(response, "No se pudo actualizar la salida");
  return response.json();
}

export async function duplicarSalida(salidaId: string): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/salidas/${salidaId}/duplicar`, {
    method: "POST",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo duplicar la salida");
  return response.json();
}

export async function reordenarSalidas(seccionId: string, salidasIds: string[]): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas/reordenar`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ salidas_ids: salidasIds }),
  });
  await lanzarSiNoOk(response, "No se pudieron reordenar las salidas");
}

export async function eliminarSalida(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/salidas/${id}`, { method: "DELETE", credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo borrar la salida");
}

export interface SimularPropuestaInput {
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
  carga_valor: string;
  carga_unidad: string;
  sensibilidad_ma?: number | null;
  admite_accesorios?: boolean | null;
}

export interface SimularPropuestaResponse {
  compatible: boolean;
  componente_id: string | null;
  componente_codigo: string | null;
  motivo: string | null;
}

export async function simularPropuesta(seccionId: string, input: SimularPropuestaInput): Promise<SimularPropuestaResponse> {
  const query = new URLSearchParams();
  query.append("formato", input.formato);
  query.append("tipo_proteccion", input.tipo_proteccion);
  query.append("carga_valor", input.carga_valor);
  query.append("carga_unidad", input.carga_unidad);
  if (input.sensibilidad_ma !== undefined && input.sensibilidad_ma !== null) {
    query.append("sensibilidad_ma", String(input.sensibilidad_ma));
  }
  if (input.admite_accesorios !== undefined && input.admite_accesorios !== null) {
    query.append("admite_accesorios", String(input.admite_accesorios));
  }

  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/simular-propuesta?${query.toString()}`, {
    method: "GET",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo simular la propuesta del componente");
  return response.json();
}

export interface ComponenteBusqueda {
  id: string;
  codigo: string;
  codigo_comercial: string | null;
  descripcion: string;
  precio_neto: string | null;
}

export interface ResultadoBusquedaCatalogo {
  resultados: ComponenteBusqueda[];
  total: number;
}

export async function buscarCatalogo(
  q: string,
  opciones?: {
    limit?: number;
    offset?: number;
    categorias?: string[];
    solo_con_atributos?: boolean;
    tipo?: string;
    polos?: number;
    corriente_nominal_a?: string;
    capacidad_corte_ka?: string;
    sensibilidad_ma?: number;
    admite_accesorios?: boolean;
  },
): Promise<ResultadoBusquedaCatalogo> {
  const params = new URLSearchParams({ q });
  if (opciones?.limit !== undefined) params.set("limit", String(opciones.limit));
  if (opciones?.offset !== undefined) params.set("offset", String(opciones.offset));
  for (const categoria of opciones?.categorias ?? []) params.append("categorias", categoria);
  if (opciones?.solo_con_atributos) params.set("solo_con_atributos", "true");
  if (opciones?.tipo !== undefined) params.set("tipo", opciones.tipo);
  if (opciones?.polos !== undefined) params.set("polos", String(opciones.polos));
  if (opciones?.corriente_nominal_a !== undefined) params.set("corriente_nominal_a", opciones.corriente_nominal_a);
  if (opciones?.capacidad_corte_ka !== undefined) params.set("capacidad_corte_ka", opciones.capacidad_corte_ka);
  if (opciones?.sensibilidad_ma !== undefined) params.set("sensibilidad_ma", String(opciones.sensibilidad_ma));
  if (opciones?.admite_accesorios !== undefined) params.set("admite_accesorios", String(opciones.admite_accesorios));
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?${params.toString()}`, {
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo buscar en el catálogo");
  return response.json();
}

export interface OpcionesFiltro {
  polos: number[];
  corrientes_nominales_a: string[];
  capacidades_corte_ka: string[];
  sensibilidades_ma?: number[];
  sensabilidades_ma?: number[];
  admite_accesorios?: boolean[];
}

export async function obtenerOpcionesFiltro(categorias: string[], tipo?: string): Promise<OpcionesFiltro> {
  const params = new URLSearchParams();
  for (const categoria of categorias) params.append("categorias", categoria);
  if (tipo) params.set("tipo", tipo);
  const response = await fetch(`${API_BASE_URL}/catalogo/opciones-filtro?${params.toString()}`, {
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudieron obtener las opciones de filtro");
  return response.json();
}

// Filtro maestro (no editable por el analista) para acotar el picker a
// interruptores -- mismas familias que usa el motor de propuesta en
// backend/app/catalogo/parser_abb.py (FAMILIAS_TERMOMAGNETICO ∪
// FAMILIA_DIFERENCIAL_COMBO). Cuando se agreguen búsquedas para otros tipos
// de material (cables, terminales, riel DIN...) cada una define su propia
// constante de categorías en vez de reusar esta.
export const CATEGORIAS_INTERRUPTORES = [
  "Interruptores Termomagnéticos",
  "Interruptores Termomagnéticos - Con posibilidad de utilizar accesorios",
  "Interruptores Termomagnéticos - Sin posibilidad de utilizar accesorios",
  "Interruptores automáticos en caja moldeada",
  "Interruptores termomagnéticos con protección diferencial",
  "Interruptores Diferenciales",
  "Interruptores Diferenciales - Sin posibilidad de utilizar accesorios",
  "Interruptores Diferenciales - Con posibilidad de utilizar accesorios",
  "Detector de fallas de arco con proteccion Diferencial (AFDD+RCD)",
  "Interruptores diferenciales",
  "Bloques diferenciales",
];

export interface ParametroCalculo {
  tension_mono_v: string;
  tension_tri_v: string;
  cos_phi: string;
  ratio_selectividad: string;
}

export async function obtenerParametrosCalculo(): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron obtener los parámetros de cálculo");
  return response.json();
}

export async function actualizarParametrosCalculo(parametros: ParametroCalculo): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(parametros),
  });
  await lanzarSiNoOk(response, "No se pudieron actualizar los parámetros de cálculo");
  return response.json();
}

export function formatearCorriente(valor: string | number | null | undefined): string {
  if (!valor) return "—";
  const num = Number(valor);
  if (isNaN(num)) return String(valor);
  if (num % 1 === 0) {
    return Math.round(num).toString();
  }
  return num.toString();
}export function existeIncompatibilidadLink(
  childFormato: FormatoPolos | string | undefined | null,
  childTipo: TipoProteccion | string | undefined | null,
  parentFormato: FormatoPolos | string | undefined | null,
  parentTipo: TipoProteccion | string | undefined | null
): boolean {
  if (!childFormato || !childTipo || !parentFormato || !parentTipo) return false;

  const isOneDiff = childTipo === "seccional_diferencial" || parentTipo === "seccional_diferencial";
  const isOneTermo = childTipo === "seccional_termomagnetico" || parentTipo === "seccional_termomagnetico";
  if (!isOneDiff || !isOneTermo) return false;

  const isOneTetra = childFormato === "tetrapolar" || parentFormato === "tetrapolar";
  const isOneMonoBiTri =
    ["unipolar", "bipolar", "tripolar"].includes(childFormato) ||
    ["unipolar", "bipolar", "tripolar"].includes(parentFormato);

  return isOneTetra && isOneMonoBiTri;
}

export interface ReglaCablecanal {
  id: string;
  corriente_minima: string;
  corriente_maxima: string;
  medida_cablecanal: string;
}

export interface ReglaCablecanalInput {
  corriente_minima: string;
  corriente_maxima: string;
  medida_cablecanal: string;
}

export interface AccesoriosSugeridos {
  motorizacion: ComponenteBusqueda | null;
  bobina_apertura: ComponenteBusqueda | null;
  bobina_cero_tension: ComponenteBusqueda | null;
  contactos_auxiliares: ComponenteBusqueda | null;
}

export async function obtenerAccesoriosSugeridos(tableroId: string): Promise<AccesoriosSugeridos> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/accesorios-sugeridos`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron obtener los accesorios sugeridos");
  return response.json();
}

export async function listarAccesoriosPrincipal(tableroId: string): Promise<ComponenteBusqueda[]> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/accesorios`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar los accesorios");
  return response.json();
}

export async function asociarAccesorioPrincipal(tableroId: string, componenteId: string): Promise<ComponenteBusqueda> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/accesorios`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ componente_id: componenteId }),
  });
  await lanzarSiNoOk(response, "No se pudo asociar el accesorio");
  return response.json();
}

export async function desasociarAccesorioPrincipal(tableroId: string, componenteId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/accesorios/${componenteId}`, {
    method: "DELETE",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo desasociar el accesorio");
}

export async function listarReglasCablecanal(): Promise<ReglaCablecanal[]> {
  const response = await fetch(`${API_BASE_URL}/config/reglas-cablecanal`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudieron listar las reglas de cablecanal");
  return response.json();
}

export async function crearReglaCablecanal(datos: ReglaCablecanalInput): Promise<ReglaCablecanal> {
  const response = await fetch(`${API_BASE_URL}/config/reglas-cablecanal`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  await lanzarSiNoOk(response, "No se pudo crear la regla de cablecanal");
  return response.json();
}

export async function eliminarReglaCablecanal(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/config/reglas-cablecanal/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo eliminar la regla de cablecanal");
}

export interface BomLineaItem {
  id: string;
  tablero_id: string;
  componente_id: string;
  componente_codigo: string;
  componente_codigo_comercial: string | null;
  componente_descripcion: string;
  componente_categoria: string | null;
  componente_marca?: string | null;
  cantidad: number;
  precio_unitario_congelado: number;
  subtotal: number;
  creado_en: string;
}

export interface BomResumenTablero {
  tablero_id: string;
  tablero_nombre: string;
  lineas: BomLineaItem[];
  total_items_count: number;
  costo_total: number;
  fecha_congelamiento: string | null;
}

export interface BomResumenProyecto {
  proyecto_id: string;
  proyecto_nombre: string;
  tableros: BomResumenTablero[];
  costo_total_proyecto: number;
}

export async function generarBomTablero(tableroId: string): Promise<BomResumenTablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/bom/generar`, {
    method: "POST",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo generar la lista de materiales (BOM)");
  return response.json();
}

export async function obtenerBomTablero(tableroId: string): Promise<BomResumenTablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/bom`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo obtener el BOM del tablero");
  return response.json();
}

export async function obtenerBomProyecto(proyectoId: string): Promise<BomResumenProyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/bom`, { credentials: "include" });
  await lanzarSiNoOk(response, "No se pudo obtener el BOM del proyecto");
  return response.json();
}

export async function limpiarBomTablero(tableroId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/bom`, {
    method: "DELETE",
    credentials: "include",
  });
  await lanzarSiNoOk(response, "No se pudo eliminar el BOM del tablero");
}
