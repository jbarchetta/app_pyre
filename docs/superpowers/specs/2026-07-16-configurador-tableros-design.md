# Configurador de Tableros Seccionables PYRE — Diseño (Fase 1, 30 días)

## Contexto y objetivo

PYRE construye tableros eléctricos, muchos de ellos seccionables, con conceptos y distribución que se repiten proyecto a proyecto. El objetivo de este sistema es tomar datos (planos CAD/PDF y/o carga manual asistida) y producir automáticamente: la estructura del tablero, el BOM (bill of materials) y los precios parciales y finales de materiales, más una estimación de mano de obra.

El sistema se aloja en un servidor local propio (Docker), es una app web con control de acceso estricto, y usa agentes de IA (en la nube por ahora; local queda como evolución futura) para asistir la carga.

**Plazo:** 30 días para un producto terminado, funcional y con una UI de calidad "producto", no herramienta interna genérica — es visible a terceros.

## Alcance de esta fase (MVP)

Limitado a **tableros seccionables**: interruptor principal + interruptores seccionales (con o sin disyuntor/diferencial), alimentando cargas e iluminación. Quedan fuera de esta fase (v2+): contactores, guardamotores, soft starters y otras funciones más avanzadas.

El agente de extracción CAD/PDF se desarrolla **en paralelo** desde el día 1 (no como fase posterior), como pista independiente que alimenta el mismo modelo de datos que el configurador manual-asistido. Expectativa explícita: al día 30 el agente debe ser funcional para casos razonablemente ordenados, no perfecto para cualquier plano — la interpretación de casos complejos es iterativa post-lanzamiento.

## Principio de diseño central

**No hay dos caminos paralelos de datos.** Tanto la carga manual-asistida como la extracción por IA terminan escribiendo la misma estructura (`tablero` → `sección` → `salida` → `bom_línea`). El agente de IA nunca escribe directo a una salida confirmada: siempre pasa por una pantalla de revisión donde el analista acepta o corrige antes de que cuente como dato real del proyecto. Esto evita que un error de interpretación de la IA se cuele en una cotización.

## Arquitectura técnica

| Capa | Elección | Motivo |
|---|---|---|
| Backend | Python + FastAPI | Ecosistema fuerte para parsing (pdfplumber/pypdf para PDF, ezdxf para DXF/CAD, pandas para Excel ABB) y orquestación de llamadas a IA. |
| Frontend | React + TypeScript (Vite) | SPA ágil, con librería de componentes (shadcn/ui o Mantine) como base para una UI de calidad "producto" construida en el plazo. |
| Base de datos | PostgreSQL | Relacional para la jerarquía tablero→sección→salida→componente, con JSONB para guardar el resultado crudo del agente de IA (trazabilidad). |
| Cola de tareas | Redis + Celery (o RQ) | El procesamiento de CAD/PDF con IA no debe bloquear el request HTTP; se procesa como job en background con estado visible (pendiente/procesando/listo para revisión). |
| Archivos | Volumen Docker + metadata en Postgres | Suficiente para el plazo; migrable a MinIO más adelante si hace falta versionado tipo S3. |
| Reverse proxy / TLS | Traefik o Nginx con HTTPS (certificado interno) | Punto único de entrada, fuerza login. |
| Orquestación | Docker Compose, un solo host | Kubernetes es complejidad innecesaria para este plazo y escala. |
| IA de extracción | API cloud (Claude u otro modelo con visión) por ahora | Sin restricciones de confidencialidad confirmadas por el cliente del sistema. Diseñar la integración detrás de una interfaz/adaptador para poder sustituir por un modelo local más adelante sin rediseñar el resto del sistema. |

## Modelo de datos (núcleo)

- **catalogo_componente** — código, proveedor (ABB / otro), descripción, tipo (interruptor principal / seccional termomagnético / diferencial), polos, corriente nominal, capacidad de corte (kA), ancho/alto en mm (para el esquema visual), precio vigente, vigente_desde.
- **catalogo_precio_historial** — cada cambio de precio: componente, precio anterior, precio nuevo, usuario que lo subió, timestamp. Visible para todos los analistas (transparencia de cambios de catálogo).
- **proyecto** — cliente, nombre, analista propietario (reasignable a otro analista sin bloquear el trabajo), estado. El supervisor ve y puede revisar todos los proyectos de todos los analistas.
- **tablero** — pertenece a un proyecto; tiene un interruptor principal y un nivel de falla (Icc, kA) declarado por el analista, usado por el motor de configuración para calcular la capacidad de corte mínima de cada salida.
- **seccion** — pertenece a un tablero (módulo/columna física).
- **salida** — la "necesidad" que carga el analista (o propone la IA): pertenece a una sección, guarda carga solicitada (kW/A) + formato (uni/bi/tetrapolar) + componente propuesto/confirmado + posición en el esquema visual + origen (manual / IA-pendiente-revisión / IA-confirmada).
- **bom_linea** — derivada de las salidas + interruptor principal: cantidad, precio unitario congelado al momento de cotizar.
- **extraccion_cad** — archivo origen (CAD/PDF), resultado crudo de la IA (JSON), estado (pendiente revisión / confirmado), referencia a qué `salida` generó cada ítem detectado.
- **usuario** — rol `analista` o `supervisor`. Ambos roles pueden subir/actualizar catálogo; toda subida queda auditada.
- **audit_log** — genérico: quién hizo qué y cuándo, sobre catálogo, proyectos y BOM.

## Motor de configuración (carga manual-asistida)

El analista carga carga (kW o A) + formato (uni/bi/tetrapolar) por cada salida. El motor:

1. Determina la corriente nominal necesaria a partir de la carga.
2. Evalúa selectividad contra el interruptor aguas arriba de esa sección.
3. Determina la capacidad de corte mínima requerida según el nivel de falla del proyecto.
4. Busca en el catálogo el componente que cumple esas condiciones al menor costo.
5. Propone el componente — el analista confirma o lo cambia manualmente. La carga 100% manual (elegir el componente directamente) siempre queda disponible como respaldo.

Las reglas de selectividad/capacidad de corte se implementan como datos configurables (tabla de reglas), no lógica hardcodeada, para poder ajustarlas sin tocar código cuando cambien criterios normativos o de PYRE.

## Esquema visual

Cada `salida` confirmada dibuja un bloque proporcional (usando ancho/alto real en mm del catálogo, no solo "módulos") con un ícono simple según tipo de componente (termomagnético, diferencial, principal), apilado dentro de su sección. Se renderiza en vivo (SVG) a medida que se arma el tablero y es exportable como imagen/PDF junto con el resto de la documentación del tablero.

## Agente de extracción CAD/PDF (pista paralela)

Pipeline:
1. CAD (DWG/DXF) se convierte a PDF/imagen si hace falta (más simple de analizar que CAD nativo).
2. El PDF/imagen se envía a un modelo de IA con visión, con un prompt estructurado para devolver JSON: secciones detectadas, interruptores, formato (polos), valores de carga/corriente.
3. El resultado se guarda en `extraccion_cad`, vinculado al proyecto, en estado "pendiente de revisión".
4. El analista revisa cada ítem detectado en la misma pantalla del configurador manual-asistido: acepta (se confirma como `salida` real) o corrige antes de confirmar.

Diseño de la integración de IA detrás de un adaptador, para poder migrar a un modelo local en el futuro sin rediseñar el pipeline.

## Precios y mano de obra

- **Materiales:** suma de precios vigentes del catálogo para cada línea del BOM (interruptor principal + cada salida confirmada), según la tabla de precios cargada (ABB + otros proveedores).
- **Mano de obra:** estimación del proyecto completo (armado/cableado), **excluyendo** costo de gestión de compra. Se implementa como tabla de tasas/tiempos configurable por tipo de componente o tablero, ajustable sin tocar código.
- **Salida:** exportable a planilla Excel con estos valores, para que el analista continúe externamente con costos financieros, impuestos y tipo de cambio — eso queda fuera de esta fase.

## Roles y seguridad

- Dos roles: **Analista** y **Supervisor**. Ambos pueden crear/editar proyectos propios y subir actualizaciones de catálogo. El supervisor además ve y revisa todos los proyectos de todos los analistas.
- Toda subida de catálogo o cambio de precio queda registrada (usuario + timestamp) y es visible para todos los analistas — transparencia total de cambios.
- Reasignación de proyectos entre analistas sin bloqueos (si un analista empieza y otro continúa, no debe haber locking que impida el trabajo).
- Login obligatorio, contraseñas con hash (bcrypt/argon2), HTTPS con certificado interno, rate limiting en login, sesiones con expiración.

## Diseño de UI

Prioridad alta: producto visualmente pulido y profesional, no una herramienta interna genérica — es visible a terceros. PYRE tiene marca (logo/colores) pero el usuario da libertad creativa; se evaluarán durante la implementación los assets de marca disponibles como referencia de color, sin atarse estrictamente a ellos. El esquema de color (claro/oscuro) queda abierto a prototipar durante la fase de diseño de UI, en vez de decidirse de antemano.

## Documentación de referencia (para minimizar reconsultas)

A medida que se construye el sistema, se documentan en `docs/` del proyecto: diccionario de datos, reglas de negocio (selectividad, capacidad de corte, fórmulas de mano de obra), decisiones de arquitectura y el formato esperado de los Excel de catálogo (ABB y otros proveedores) — de forma que ni el equipo humano ni los agentes que trabajen sobre este repo necesiten re-derivar contexto ya establecido.

## Cronograma (30 días, dos pistas en paralelo)

| Semana | Pista sistema (Track A) | Pista IA/CAD (Track B) |
|---|---|---|
| 1 | Fundaciones: modelo de datos, Docker Compose, autenticación (2 roles), esqueleto de UI | Pipeline de conversión CAD→PDF/imagen + prompt de extracción, primeras pruebas con planos reales de PYRE |
| 2 | Catálogo (importador Excel ABB + otros proveedores, versionado de precios) + motor de configuración (reglas de selectividad/capacidad de corte) | Estructurar el JSON de salida del agente, mapeo a `extraccion_cad`, primeras pruebas end-to-end |
| 3 | Esquema visual (SVG con proporciones e iconografía) + BOM en vivo | Pantalla de revisión de propuestas de IA integrada al configurador |
| 4 | Precios + mano de obra + exportables a Excel + pulido visual de UI + hardening de seguridad | Ajuste de precisión del agente con más ejemplos reales, manejo de errores/casos límite |

## Fuera de alcance (v2+)

- Contactores, guardamotores, soft starters y otras funciones más allá de tableros seccionables.
- Costos financieros, impuestos, tipo de cambio (el analista los calcula fuera del sistema por ahora).
- Modelo de IA local (arquitectura preparada para migrar, pero no implementado en esta fase).
- Edición colaborativa en tiempo real sobre un mismo tablero por varios analistas simultáneamente.
