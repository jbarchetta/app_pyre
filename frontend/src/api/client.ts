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

export interface Tablero {
  id: string;
  proyecto_id: string;
  nombre: string;
  nivel_falla_ka: string;
  interruptor_principal_id: string | null;
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
  origen: string;
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

export async function actualizarSalida(salidaId: string, componenteId: string | null): Promise<Salida> {
  const response = await fetch(`${API_BASE_URL}/salidas/${salidaId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ componente_id: componenteId }),
  });
  if (!response.ok) throw new Error("No se pudo actualizar la salida");
  return response.json();
}

export interface ComponenteBusqueda {
  id: string;
  codigo: string;
  codigo_comercial: string | null;
  descripcion: string;
  precio_neto: string | null;
}

export async function buscarCatalogo(q: string): Promise<ComponenteBusqueda[]> {
  const response = await fetch(`${API_BASE_URL}/catalogo/buscar?q=${encodeURIComponent(q)}`, {
    credentials: "include",
  });
  if (!response.ok) throw new Error("No se pudo buscar en el catálogo");
  return response.json();
}

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
