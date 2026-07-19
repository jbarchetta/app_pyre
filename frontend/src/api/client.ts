const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

export interface Usuario {
  id: string;
  email: string;
  nombre: string;
  rol: "analista" | "supervisor";
}

export async function login(email: string, password: string): Promise<Usuario> {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error("Credenciales inválidas");
  }

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

  if (!response.ok) {
    throw new Error("No se pudo importar el catálogo");
  }

  return response.json();
}

export interface Proyecto {
  id: string;
  cliente: string;
  nombre: string;
  analista_id: string;
  estado: string;
}

export async function listarProyectos(): Promise<Proyecto[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar los proyectos");
  return response.json();
}

export async function crearProyecto(cliente: string, nombre: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ cliente, nombre }),
  });
  if (!response.ok) throw new Error("No se pudo crear el proyecto");
  return response.json();
}

export async function obtenerProyecto(id: string): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudo obtener el proyecto");
  return response.json();
}

export interface ProyectoUpdate {
  nombre?: string;
  cliente?: string;
}

export async function actualizarProyecto(id: string, cambios: ProyectoUpdate): Promise<Proyecto> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  if (!response.ok) throw new Error("No se pudo actualizar el proyecto");
  return response.json();
}

export async function eliminarProyecto(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar el proyecto");
}

export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
  interruptor_principal_codigo?: string | null;
  interruptor_principal_codigo_comercial?: string | null;
}

export async function listarTableros(proyectoId: string): Promise<Tablero[]> {
  const response = await fetch(`${API_BASE_URL}/proyectos/${proyectoId}/tableros`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar los tableros");
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
    }),
  });
  if (!response.ok) throw new Error("No se pudo crear el tablero");
  return response.json();
}

export async function obtenerTablero(id: string): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudo obtener el tablero");
  return response.json();
}

export interface TableroUpdate {
  nombre?: string;
  nivel_falla_ka?: string;
  interruptor_principal_id?: string | null;
}

export async function actualizarTablero(id: string, cambios: TableroUpdate): Promise<Tablero> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  if (!response.ok) throw new Error("No se pudo actualizar el tablero");
  return response.json();
}

export async function eliminarTablero(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/tableros/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar el tablero");
}

export interface Seccion {
  id: string;
  tablero_id: string;
  nombre: string;
  orden: number;
}

export async function listarSecciones(tableroId: string): Promise<Seccion[]> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar las secciones");
  return response.json();
}

export async function crearSeccion(tableroId: string, nombre: string, orden: number): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/tableros/${tableroId}/secciones`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nombre, orden }),
  });
  if (!response.ok) throw new Error("No se pudo crear la sección");
  return response.json();
}

export interface SeccionUpdate {
  nombre?: string;
}

export async function actualizarSeccion(id: string, nombre: string): Promise<Seccion> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nombre }),
  });
  if (!response.ok) throw new Error("No se pudo actualizar la sección");
  return response.json();
}

export async function eliminarSeccion(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/secciones/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar la sección");
}

export type FormatoPolos = "unipolar" | "bipolar" | "tripolar" | "tetrapolar";
export type TipoProteccion = "seccional_termomagnetico" | "seccional_diferencial";

export interface Salida {
  id: string;
  seccion_id: string;
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
  componente_id: string | null;
  componente_codigo?: string | null;
  componente_codigo_comercial?: string | null;
  componente_descripcion?: string | null;
  origen: string;
  asignado_manualmente: boolean;
}

export interface SalidaInput {
  carga_valor: string;
  carga_unidad: string;
  formato: FormatoPolos;
  tipo_proteccion: TipoProteccion;
}

export async function listarSalidas(seccionId: string): Promise<Salida[]> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron listar las salidas");
  return response.json();
}

export async function crearSalida(seccionId: string, datos: SalidaInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/secciones/${seccionId}/salidas`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(datos),
  });
  if (!response.ok) throw new Error("No se pudo crear la salida");
  return response.json();
}

export interface SalidaUpdateInput {
  carga_valor?: string;
  carga_unidad?: string;
  formato?: FormatoPolos;
  tipo_proteccion?: TipoProteccion;
  componente_id?: string | null;
}

export async function actualizarSalida(salidaId: string, cambios: SalidaUpdateInput): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/salidas/${salidaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(cambios),
  });
  if (!response.ok) throw new Error("No se pudo actualizar la salida");
  return response.json();
}

export async function eliminarSalida(id: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/salidas/${id}`, { method: "DELETE", credentials: "include" });
  if (!response.ok) throw new Error("No se pudo borrar la salida");
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
    polos?: number;
    corriente_nominal_a?: string;
    capacidad_corte_ka?: string;
  },
): Promise<ResultadoBusquedaCatalogo> {
  const params = new URLSearchParams({ q });
  if (opciones?.limit !== undefined) params.set("limit", String(opciones.limit));
  if (opciones?.offset !== undefined) params.set("offset", String(opciones.offset));
  for (const categoria of opciones?.categorias ?? []) params.append("categorias", categoria);
  if (opciones?.solo_con_atributos) params.set("solo_con_atributos", "true");
  if (opciones?.polos !== undefined) params.set("polos", String(opciones.polos));
  if (opciones?.corriente_nominal_a !== undefined) params.set("corriente_nominal_a", opciones.corriente_nominal_a);
  if (opciones?.capacidad_corte_ka !== undefined) params.set("capacidad_corte_ka", opciones.capacidad_corte_ka);
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo buscar en el catálogo");
  return response.json();
}

export interface OpcionesFiltro {
  polos: number[];
  corrientes_nominales_a: string[];
  capacidades_corte_ka: string[];
}

export async function obtenerOpcionesFiltro(categorias: string[]): Promise<OpcionesFiltro> {
  const params = new URLSearchParams();
  for (const categoria of categorias) params.append("categorias", categoria);
  const response = await fetch(`${API_BASE_URL}/catalogo/opciones-filtro?${params.toString()}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudieron obtener las opciones de filtro");
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
];

export interface ParametroCalculo {
  tension_mono_v: string;
  tension_tri_v: string;
  cos_phi: string;
  ratio_selectividad: string;
}

export async function obtenerParametrosCalculo(): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, { credentials: "include" });
  if (!response.ok) throw new Error("No se pudieron obtener los parámetros de cálculo");
  return response.json();
}

export async function actualizarParametrosCalculo(parametros: ParametroCalculo): Promise<ParametroCalculo> {
  const response = await fetch(`${API_BASE_URL}/parametros-calculo`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(parametros),
  });
  if (!response.ok) throw new Error("No se pudieron actualizar los parámetros de cálculo");
  return response.json();
}
