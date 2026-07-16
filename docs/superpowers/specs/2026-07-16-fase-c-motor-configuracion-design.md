# Fase C (ciclo 1) — Motor de configuración

## Alcance de este ciclo

Motor de configuración manual-asistida: a partir de la carga (kW o A) y el formato de una salida, calcular la corriente nominal necesaria, evaluar selectividad y capacidad de corte, y proponer el componente de catálogo más barato que cumple. Se expone vía API REST y una UI mínima (sin pulido visual) para cargar tablero → secciones → salidas y ver/confirmar la propuesta.

**Fuera de alcance de este ciclo** (se documenta acá para que quede explícito, no porque se vaya a hacer "después sin más"):

- **Poblar `catalogo_componente.atributos` con datos reales del Excel de ABB.** Hoy el importador de Fase B no llena `atributos` — la info de polos/corriente/kA vive solo como texto en `categoria_path`/`descripcion`. Ese parseo es un problema de datos separado de la lógica del motor y queda para un ciclo aparte. Este ciclo asume que `atributos` ya tiene las claves que necesita el motor (sembradas a mano en tests; en catálogo real, mientras no exista el parser, un componente sin esas claves simplemente no matchea ninguna propuesta automática — el analista carga manualmente).
- BOM derivado + exportable a Excel.
- Esquema visual (SVG).
- Selectividad basada en curvas reales de fabricante (este ciclo usa una regla de ratio simple, configurable).
- Agente de extracción CAD/PDF.

## Supuesto de diseño

El modelo de datos actual (`tablero`) no tiene un interruptor por sección, solo `tablero.interruptor_principal_id`. No existe jerarquía de sub-interruptores por sección. Por lo tanto, "el interruptor aguas arriba de la sección" (mencionado en el spec general) se interpreta siempre como el interruptor principal del tablero al que pertenece la sección. Si en un ciclo futuro se agregan interruptores intermedios por sección, este supuesto debe revisarse.

## Modelo de datos (cambios)

1. **`salida.tipo_proteccion`** — nueva columna enum `tipo_proteccion` (`SECCIONAL_TERMOMAGNETICO` | `SECCIONAL_DIFERENCIAL`), `NOT NULL`. La elige el analista al cargar la salida (o, en un ciclo futuro, el agente de extracción CAD). Termomagnético y diferencial son equipos distintos — no son alternativas de un mismo slot, sino una elección explícita de qué tipo de protección va en esa salida.
2. **Contrato de `catalogo_componente.atributos`** (JSONB, no forzado a nivel de esquema — se documenta en `diccionario_datos.md`): para que un componente sea candidato del motor debe tener las claves:
   - `tipo`: `"INTERRUPTOR_PRINCIPAL"` | `"SECCIONAL_TERMOMAGNETICO"` | `"SECCIONAL_DIFERENCIAL"`
   - `polos`: `1` | `2` | `4` (mapea a `formato` unipolar/bipolar/tetrapolar)
   - `corriente_nominal_a`: number
   - `capacidad_corte_ka`: number
3. **Tabla nueva `parametro_calculo`** — fila única con los parámetros configurables del motor:
   - `id` (PK)
   - `tension_mono_v` (Numeric, default 220)
   - `tension_tri_v` (Numeric, default 380)
   - `cos_phi` (Numeric, default 0.9)
   - `ratio_selectividad` (Numeric, default 1.6)
   - `actualizado_por` (FK `usuario`)
   - `actualizado_en` (timestamp)

   Editable desde la app (ambos roles, mismo criterio que catálogo). Cada cambio se registra en `audit_log`, igual que las subidas de catálogo.

## Servicio: motor de configuración (`backend/app/motor/`)

Funciones puras y testeables en aislamiento (reciben datos, no hacen queries ellas mismas — las queries las arma la capa de servicio que las invoca):

```python
def calcular_corriente_nominal(carga_valor: Decimal, carga_unidad: str, formato: FormatoPolos, parametros: ParametroCalculo) -> Decimal:
    ...
```
- `carga_unidad == "A"` → devuelve `carga_valor` tal cual.
- `carga_unidad == "kW"`, formato unipolar/bipolar → `carga_valor * 1000 / (tension_mono_v * cos_phi)`.
- `carga_unidad == "kW"`, formato tetrapolar → `carga_valor * 1000 / (tension_tri_v * √3 * cos_phi)`.

```python
def verificar_selectividad(nominal_aguas_arriba: Decimal, nominal_propuesto: Decimal, ratio_selectividad: Decimal) -> bool:
    ...
```
- `nominal_aguas_arriba >= nominal_propuesto * ratio_selectividad`.

```python
def proponer_componente(candidatos: list[CatalogoComponente], tipo_proteccion, formato, corriente_nominal, capacidad_corte_min, nominal_aguas_arriba, parametros) -> CatalogoComponente | None:
    ...
```
- Filtra `candidatos` (ya pre-filtrados por la capa de servicio vía query: `atributos->>'tipo' = tipo_proteccion`, `atributos->>'corriente_nominal_a'::numeric >= corriente_nominal`, `atributos->>'capacidad_corte_ka'::numeric >= capacidad_corte_min`, `atributos->>'polos'::int` mapeado desde `formato`) por selectividad (`verificar_selectividad`).
- De los que pasan, ordena por `precio_neto` ascendente; desempate estable por `codigo` (para que el resultado sea determinístico en tests con precios iguales).
- Devuelve `None` si no hay match — la salida queda con `componente_id = NULL` y el analista completa manualmente.

## API (FastAPI, `backend/app/routers/`)

Nuevo: CRUD mínimo de `proyecto` no existía todavía (Fase A dejó el modelo, no el router).

- `POST /proyectos`, `GET /proyectos`, `GET /proyectos/{id}`
- `POST /proyectos/{id}/tableros`, `GET /tableros/{id}` — body: `nombre`, `interruptor_principal_id`, `nivel_falla_ka`.
- `POST /tableros/{id}/secciones` — body: `nombre`, `orden`.
- `POST /secciones/{id}/salidas` — body: `carga_valor`, `carga_unidad`, `formato`, `tipo_proteccion`. Internamente corre el motor y crea la salida con `origen=MANUAL` y `componente_id` = propuesta (o `NULL` si no hay match). Devuelve la salida creada.
- `PATCH /salidas/{id}` — permite cambiar `componente_id` manualmente (override de la propuesta) o los datos de carga (re-dispara el motor).
- `GET /parametros-calculo`, `PUT /parametros-calculo` — leer/editar los parámetros configurables.

Todos los endpoints requieren autenticación (reusa `app/auth/dependencies.py`). Sin distinción de permisos entre analista/supervisor para estas operaciones, salvo lo ya definido en reglas de negocio (reasignación de proyectos, visibilidad total del supervisor — no se toca en este ciclo si no es necesario para las pantallas nuevas).

## UI mínima (frontend, sin pulido visual — placeholder funcional)

- Pantalla "Tablero" dentro de un proyecto: form para crear tablero (nombre, `nivel_falla_ka`, selector de interruptor principal con buscador simple sobre catálogo).
- Dentro del tablero: agregar secciones (nombre) y, por sección, agregar salidas (carga + unidad + formato + tipo de protección). Al guardar una salida, se muestra el componente propuesto, o "sin match — elegí manualmente" con un selector de catálogo si `proponer_componente` devolvió `None`.
- Pantalla "Parámetros de cálculo": form simple para editar tensión mono/tri, cos φ, ratio de selectividad.

## Testing

- **Motor (unitario):** `calcular_corriente_nominal` (A directo, kW mono, kW tri), `verificar_selectividad` (ok / no ok en el límite), `proponer_componente` (match simple, sin match por corriente, sin match por kA, sin match por selectividad, empate de precio → desempate por código, catálogo vacío).
- **API (integración, DB real de test):** creación de proyecto → tablero → sección → salida con propuesta automática; salida sin match; `PATCH` de override manual; `GET`/`PUT` de parámetros de cálculo con verificación de `audit_log`.
- **Frontend (Vitest):** formulario de creación de salida muestra la propuesta o el estado "sin match"; formulario de parámetros de cálculo guarda y refleja los valores.

## Documentación a actualizar

- `docs/diccionario_datos.md`: contrato de claves de `atributos` para interruptores, tabla `salida.tipo_proteccion`, tabla `parametro_calculo`.
- `docs/reglas_negocio.md`: fórmulas de corriente nominal, regla de selectividad, marcar el motor como implementado (con la salvedad de que asume `atributos` poblado).
