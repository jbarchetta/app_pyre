# Desarrollo local — Configurador de Tableros PYRE

## Requisitos
- Docker Desktop
- Python 3.12 (para iterar en el backend fuera de contenedor)
- Node.js 20+ (para iterar en el frontend fuera de contenedor)

## Levantar solo la base de datos (flujo de desarrollo día a día)

```bash
docker compose up -d db
cd backend && source venv/Scripts/activate && pytest -v
cd frontend && npm run dev
```

## Levantar el stack completo (integración)

```bash
docker compose up -d --build
docker compose exec backend alembic upgrade head
```

Frontend: http://localhost:5173 — Backend: http://localhost:8000/health

## Crear un usuario

```bash
docker compose exec backend python -m app.scripts.create_user --email nombre@pyre.com --nombre "Nombre Apellido" --password "clave" --rol analista
```

## Nota sobre puertos en desarrollo compartido
Si en tu máquina hay otros procesos escuchando en `localhost:8000` o `localhost:5173` (por ejemplo otro proyecto corriendo en paralelo), `localhost` y `127.0.0.1` pueden resolver a servicios distintos según el stack IPv4/IPv6. Si algo no responde como se espera, verificá con `docker compose ps` qué puertos tiene realmente publicados este proyecto y probá la otra variante de host (`localhost` vs `127.0.0.1`).

## Documentos de referencia
- `docs/diccionario_datos.md` — qué significa cada tabla/columna.
- `docs/reglas_negocio.md` — reglas de cálculo y de acceso vigentes.
- `docs/superpowers/specs/` — specs de diseño aprobadas.
- `docs/superpowers/plans/` — planes de implementación.
