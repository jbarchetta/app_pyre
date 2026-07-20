# Ciclo 10b — Auditoría UX y Mejoras Integrales del Analista — Spec

> **Fecha:** 2026-07-20  
> **Estado:** Propuesto  
> **Rama:** `feat/ciclo-10b-ux-feedback`  
> **Precede a:** Ciclo 11 (BOM / Cotización)

---

## 1. Objetivos y Alcance

Este ciclo aborda los 11 puntos de mejora identificados a partir del uso continuo de la aplicación por parte del equipo de ingeniería/analistas de PYRE:

1. **Landing / Dashboard inicial:** Crear un panel informativo con resumen de proyectos, estadísticas y accesos directos.
2. **Gestión avanzada de Proyectos:** Agregar metadata (`codigo_obra`, `fecha_inicio`, autor), modos de vista (Tarjetas vs Tabla), búsqueda, filtros por estado y agrupación por mes/año.
3. **Hero state para proyectos vacíos:** Rediseñar la pantalla de proyecto sin tableros para tener un llamado a la acción (CTA) claro y visible.
4. **Navegación de retorno visible:** Destacar el botón/breadcrumb de regreso a Proyectos desde el Workspace.
5. **Diagnóstico explícito de "Sin Match":** Explicar la razón por la cual una salida no obtuvo propuesta automática (amperaje alto para Icc, falta de selectividad, etc.).
6. **Rediseño de la Tabla de Salidas:** Agregar campo `etiqueta` (código de circuito ej. "PG01"), mover el ícono de estado junto al código SAP/Comercial y eliminar la columna de estado redundante.
7. **Duplicar / Clonar Salidas:** Botón de 1-click para duplicar salidas dentro de una sección.
8. **Reordenamiento por Drag & Drop:** Permitir reordenar salidas arrastrando y soltando en la tabla.
9. **Blueprint más explicativo:** Rediseñar `EsquemaVisual` con etiquetas de circuito, calibres y preparación para formatos gráficos detallados.
10. **Interactividad Bidireccional (Hover Blueprint ↔ Tabla):** Resaltado dinámico animado al pasar el mouse por el blueprint o por la tabla.
11. **Búsqueda y catalogación de Diferenciales:** Ajustar las reglas de búsqueda en `ComponentePicker` para disyuntores diferenciales y termomagnéticos combinados.

---

## 2. Especificación Técnica por Componente

### 2.1 Base de Datos y Modelos Backend

1. **Tabla `proyecto` (`backend/app/models/proyecto.py`):**
   - Nuevos campos: `codigo_obra: Mapped[str | None]` (Varchar 100), `fecha_inicio: Mapped[datetime | None]`.
   - Modificación de schemas Pydantic: `ProyectoResponse` incluye `codigo_obra`, `fecha_inicio`, `analista_nombre`, `analista_email`.

2. **Tabla `salida` (`backend/app/models/tablero.py`):**
   - Nuevo campo: `etiqueta: Mapped[str | None]` (Varchar 100, ej. `"PG01"`, `"Iluminación"`).
   - Schema Pydantic `SalidaResponse` incluye `etiqueta` y `motivo_sin_match`.

3. **Diagnósticos en Motor de Propuesta (`backend/app/motor/propuesta.py`):**
   - Devuelve un diagnóstico estructurado cuando `componente_id` es `None` (ej. "No hay interruptores de 125A con Icu >= 36kA").

---

### 2.2 Dashboard / Landing Page (`frontend/src/pages/DashboardPage.tsx`)

- Métrica 1: Total de Proyectos.
- Métrica 2: Proyectos Activos (En Curso).
- Métrica 3: Proyectos Finalizados.
- Métrica 4: Total de Tableros Diseñados.
- Lista de "Proyectos Recientes" ordenados por fecha de modificación con botón directo "Abrir Workspace".

---

### 2.3 Vista de Proyectos (`ProyectosPage.tsx`)

- **Controles Superiores:**
  - Selector de vista: `[ Grid ]` / `[ Tabla ]`.
  - Buscador global por Nombre, Cliente, Código de Obra o Autor.
  - Filtro por Estado: Todos, En Curso, Finalizado, Cancelado.
- **Formulario de Proyecto Nuevo / Edición:**
  - Nuevos campos: `codigo_obra`, `fecha_inicio`.
- **Agrupación por Mes:**
  - Separación de tarjetas/filas por secciones mensuales (ej. "Julio 2026", "Junio 2026").

---

### 2.4 Workspace del Proyecto (`ProyectoWorkspacePage.tsx` y `DetalleTablero.tsx`)

- **Botonera / Breadcrumb de Navegación:**
  - Botón prominente `← Volver a Proyectos` en la barra superior.
- **Hero State de Proyecto Nuevo:**
  - Ilustración/bloque central destacado con botón gigante `[ + Crear mi primer tablero ]`.

---

### 2.5 Tabla de Salidas y Duplicación (`SeccionBlock.tsx`)

- **Estructura de Columnas:**
  1. `Drag Handle` (ícono `drag_indicator` para arrastrar)
  2. `Etiqueta / Circuito` (ej. "PG01")
  3. `Carga` (ej. "16 A")
  4. `Formato & Protección` (ej. "2P / Termomagnético")
  5. `Código SAP / Comercial` + **Ícono de Estado con Tooltip de Diagnóstico**
  6. `Acciones` (Editar · Duplicar · Borrar)
- **Acción Duplicar:** `POST /secciones/{id}/salidas` copiando los parámetros de la salida seleccionada.
- **Reordenamiento:** Soporte de drag & drop actualizando `posicion_orden`.

---

### 2.6 Blueprint / Esquema Visual Interactivo (`EsquemaVisual.tsx`)

- Muestra `etiqueta` de circuito, formato y corriente nominal dentro de cada bloque.
- Conecta el estado `salidaHoveredId` entre `EsquemaVisual` y `SeccionBlock`.
- Al hacer click en un bloque del blueprint, realiza scroll suave y enfoca la fila de la salida en la tabla.

---

### 2.7 Filtros de Catálogo y Diferenciales (`ComponentePicker.tsx`)

- Cuando la salida requiere `seccional_diferencial`, el picker selecciona y muestra por defecto las categorías de `Interruptores termomagnéticos con protección diferencial` y `Interruptores Diferenciales`.

---

## 3. Plan de Verificación

- **Backend:** Pruebas unitarias de migración/modelos de `Proyecto` y `Salida`, diagnósticos del motor y ordenamiento.
- **Frontend:** Pruebas Vitest de los componentes `ProyectosPage`, `SeccionBlock`, `EsquemaVisual` y `DashboardPage`.
- **Build:** `npm run build` en frontend sin advertencias ni errores de tipos.
