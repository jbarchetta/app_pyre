# Desarrollo local — Configurador de Tableros PYRE

## Requisitos
- Docker Desktop
- Python 3.12 (para iterar en el backend fuera de contenedor)
- Node.js 20+ (para iterar en el frontend fuera de contenedor)

## Levantar solo la base de datos (flujo de desarrollo día a día)

```bash
docker compose up -d db
cd backend && source venv/Scripts/activate && pytest -v
cd frontend && npm run dev -- --port 5180
```

## Levantar el stack completo (integración)

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Frontend: http://localhost:5180 — Backend: http://localhost:8010/health

## Crear un usuario

```bash
docker compose exec backend python -m app.scripts.create_user --email nombre@pyre.com --nombre "Nombre Apellido" --password "clave" --rol analista
```

## Nota sobre puertos
Los puertos de host de este proyecto se eligieron deliberadamente fuera de los defaults más comunes (5173 para Vite, 8000 para FastAPI/Django) porque en la máquina de desarrollo suele haber otros proyectos usando esos mismos puertos por defecto — `docker compose up` no avisa del choque si el otro servicio no está en Docker o está en otra red. Si igualmente hay un conflicto, cambiá el mapeo host en `docker-compose.yml` (ej. `"5190:5173"`) y actualizá `TABLERO_FRONTEND_ORIGIN`/`VITE_API_BASE_URL` en consecuencia.

## Documentos de referencia
- `docs/diccionario_datos.md` — qué significa cada tabla/columna.
- `docs/reglas_negocio.md` — reglas de cálculo y de acceso vigentes.
- `docs/superpowers/specs/` — specs de diseño aprobadas.
- `docs/superpowers/plans/` — planes de implementación.
