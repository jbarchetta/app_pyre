# Ciclo 11 — Generación de BOM, congelamiento de precios y cotización por tablero — Spec

> **Fecha:** 2026-07-20  
> **Estado:** Propuesto  
> **Rama:** `feat/ciclo-11-bom`  
> **Precede a:** Fase D (Precios y mano de obra)

---

## 1. Contexto y Objetivos

Actualmente, el sistema calcula la propuesta de componentes para cada salida y permite asignar interruptores principales y secundarios a los tableros. Sin embargo, los componentes confirmados no se consolidan ni se "congelan" en una lista de materiales persistente (**BOM — Bill of Materials**).

**Objetivos de este ciclo:**
1. **Consolidar la lista de materiales (BOM):** Agrupar todos los componentes asignados al tablero (interruptor principal + componentes confirmados/asignados de cada salida) calculando sus cantidades totales.
2. **Congelar precios (`bom_linea`):** Persistir las líneas de BOM en la tabla `bom_linea`, guardando el `precio_unitario_congelado` al momento de generar la cotización. Esto garantiza que futuros cambios en el catálogo de proveedores no alteren cotizaciones ya generadas.
3. **Servicios y Cascada de Borrado:** Implementar borrado en cascada explícito de `bom_linea` al eliminar un tablero o un proyecto para prevenir errores de integridad referencial (`IntegrityError`).
4. **API REST y UI de Cotizador / BOM:** Proveer endpoints REST para obtener y generar el BOM, e integrar en la interfaz del tablero (`DetalleTablero`) el módulo del Cotizador / BOM con desglose de ítems, precios congelados y totales de materiales.

---

## 2. Especificación Técnica Backend

### 2.1 Modelo de Datos (`bom_linea`)

La tabla `bom_linea` ya existe en el modelo SQLAlchemy (`backend/app/models/tablero.py`):
```python
class BomLinea(Base):
    __tablename__ = "bom_linea"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tablero_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tablero.id"), nullable=False)
    componente_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("catalogo_componente.id"), nullable=False)
    cantidad: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    precio_unitario_congelado: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    creado_en: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=datetime.utcnow, nullable=False)
```

### 2.2 Lógica de Consolidación del BOM

Se creará un servicio en `backend/app/bom/generador.py`:
1. **Detección de componentes del tablero:**
   - **Interruptor Principal:** Si `tablero.interruptor_principal_id` no es `NULL`, aporta 1 unidad de su `componente_id`.
   - **Salidas por Sección:** Para cada sección del tablero, se buscan las salidas que tengan `componente_id` no `NULL`. Cada salida aporta 1 unidad del `componente_id`.
2. **Agrupación y Conteo:**
   - Se agrupan los `componente_id` contando el total de unidades (`cantidad`).
3. **Congelamiento de Precios:**
   - Para cada `componente_id`, se consulta su `precio_neto` actual en `catalogo_componente`. Si el precio es `NULL` (ej. precio a consultar o sin precio), se congela en `0.00` (con indicador/flag de consulta).
4. **Reemplazo Transaccional:**
   - Para un tablero dado, se borran las filas existentes en `bom_linea` (`DELETE FROM bom_linea WHERE tablero_id = :tablero_id`) y se insertan las nuevas filas consolidadas.

### 2.3 Endpoints REST

Crear router en `backend/app/routers/bom.py`:

- **`GET /tableros/{tablero_id}/bom`**
  - Requiere autenticación y verificación de propiedad (`ownership.py`).
  - Devuelve `BomResponse`:
    ```json
    {
      "tablero_id": "uuid",
      "lineas": [
        {
          "id": "uuid",
          "componente_id": "uuid",
          "componente_codigo": "XT2N 160",
          "componente_codigo_comercial": "1SDA067000R1",
          "componente_descripcion": "Interruptor automático...",
          "cantidad": 1,
          "precio_unitario_congelado": "150.00",
          "subtotal": "150.00"
        }
      ],
      "total_materiales": "150.00",
      "creado_en": "2026-07-20T10:00:00Z"
    }
    ```
  - Si el tablero no tiene BOM generado aún, se puede retornar la lista vacía o calcular un pre-conteo sin persistir (o generar automáticamente la primera vez).

- **`POST /tableros/{tablero_id}/bom/generar`**
  - Genera/refresca transaccionalmente el BOM del tablero con los componentes vigentes y congela precios.
  - Registra el evento en `audit_log` (`accion="generar_bom"`, `entidad="tablero"`).
  - Devuelve `BomResponse` actualizado.

### 2.4 Cascada de Borrado Explícita

En `backend/app/routers/tableros.py` (`eliminar_tablero`) y `backend/app/routers/proyectos.py` (`eliminar_proyecto`):
- Se añade la eliminación preventiva de `bom_linea`:
  ```python
  db.query(BomLinea).filter(BomLinea.tablero_id == tablero_id).delete(synchronize_session=False)
  ```
  Esto evita `IntegrityError` al borrar tableros o proyectos que posean líneas de BOM.

---

## 3. Especificación Técnica Frontend

### 3.1 Cliente API (`frontend/src/api/client.ts`)

Añadir interfaces y funciones API:
```typescript
export interface BomLineaResponse {
  id: string;
  componente_id: string;
  componente_codigo: string;
  componente_codigo_comercial?: string | null;
  componente_descripcion: string;
  cantidad: number;
  precio_unitario_congelado: string;
  subtotal: string;
}

export interface BomResponse {
  tablero_id: string;
  lineas: BomLineaResponse[];
  total_materiales: string;
  creado_en?: string | null;
}

export async function obtenerBomTablero(tableroId: string): Promise<BomResponse>;
export async function generarBomTablero(tableroId: string): Promise<BomResponse>;
```

### 3.2 Componente `DetalleTablero` / Módulo Cotizador BOM

1. **Nueva Pestaña / Vista "BOM / Cotización":**
   - En `DetalleTablero.tsx`, agregar la pestaña "BOM / Cotización" junto a "Principal" y las filas de salidas (o en una sección de acciones/panel colapsable).
   - Al seleccionar "BOM / Cotización", se cargan las líneas del BOM del tablero activo.
2. **Tabla Desglose de Materiales:**
   - Columnas: `Código SAP` · `Código Comercial` · `Descripción` · `Cantidad` · `Precio Unit. ($)` · `Subtotal ($)`.
   - Fila de pie con el **Total de Materiales ($)** en destaque visual.
   - Indicador de estado: "Precios congelados el DD/MM/AAAA hh:mm".
3. **Acción de Regenerar / Congelar:**
   - Botón **"Recalcular / Congelar BOM"** con estado de carga, que llama a `POST /tableros/{tablero_id}/bom/generar`.

---

## 4. Criterios de Aceptación y Tests

1. **Backend Tests (`tests/test_bom.py`):**
   - Test de generación de BOM con 1 interruptor principal + 2 salidas confirmadas (verifica cantidades y subtotales).
   - Test de refresco de BOM cuando cambia un componente.
   - Test de resiliencia si un componente no tiene precio (`precio_neto = None`).
   - Test de cascada de borrado (eliminar tablero/proyecto con BOM no arroja 500/IntegrityError).
   - Test de permisos/propiedad (`ownership.py` devuelve 403 para analistas ajenos).

2. **Frontend Tests (`DetalleTablero.test.tsx` / `ProyectoWorkspacePage.test.tsx`):**
   - Visualización de líneas de BOM y total.
   - Llamada a API al clickear "Recalcular / Congelar BOM".
   - Renderizado limpio cuando el BOM está vacío o en carga.

3. **Verificación de Build:**
   - Pytest en verde (`100% passed`).
   - Vitest en verde (`100% passed`).
   - `npm run build` sin errores TypeScript.
