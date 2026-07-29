import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  PlusIcon,
  FolderIcon,
  CpuChipIcon,
  CheckCircleIcon,
  ArchiveBoxIcon,
  ClockIcon,
  ArrowRightIcon,
  AdjustmentsVerticalIcon,
  FolderOpenIcon,
  DocumentArrowUpIcon,
  Cog6ToothIcon,
} from "@heroicons/react/24/outline";
import { listarProyectos, type Proyecto } from "../api/client";
import { Badge, Card, CardHeader, CardTitle } from "../components/common";

type Tono = "brand" | "info" | "success" | "warning";

const tonoTile: Record<Tono, string> = {
  brand: "bg-brand-tint text-brand",
  info: "bg-info-tint text-info",
  success: "bg-success-tint text-success",
  warning: "bg-warning-tint text-warning",
};

interface MetricaProps {
  icono: React.ComponentType<{ className?: string }>;
  tono: Tono;
  valor: React.ReactNode;
  etiqueta: string;
  /** Los valores numéricos van en monoespaciado tabular; los textuales no. */
  numerico?: boolean;
}

/** Los cuatro tiles eran markup duplicado cuatro veces con colores distintos. */
function Metrica({ icono: Icono, tono, valor, etiqueta, numerico = true }: MetricaProps) {
  return (
    <Card className="flex items-center gap-4">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-card ${tonoTile[tono]}`}>
        <Icono className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <div className={`text-2xl font-bold leading-tight text-ink ${numerico ? "dato-tecnico" : ""}`}>
          {valor}
        </div>
        <div className="etiqueta mt-0.5">{etiqueta}</div>
      </div>
    </Card>
  );
}

const ESTADO: Record<string, { label: string; tono: "success" | "info" | "neutral" }> = {
  finalizado: { label: "Finalizado", tono: "success" },
  en_curso: { label: "En curso", tono: "info" },
};

const ACCESOS = [
  { to: "/proyectos", icono: FolderOpenIcon, label: "Lista de Proyectos y Tableros", destacado: true },
  { to: "/catalogo", icono: DocumentArrowUpIcon, label: "Importar / Actualizar Catálogo", destacado: false },
  {
    to: "/parametros-calculo",
    icono: Cog6ToothIcon,
    label: "Parámetros de Cálculo Electrotécnico",
    destacado: false,
  },
];

export function DashboardPage() {
  const [proyectos, setProyectos] = useState<Proyecto[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarProyectos()
      .then(setProyectos)
      .catch((err) => setError(err instanceof Error ? err.message : "No se pudieron cargar los proyectos"));
  }, []);

  const cargando = proyectos === null && error === null;
  const lista = proyectos ?? [];
  const totalProyectos = lista.length;
  const activos = lista.filter((p) => p.estado === "en_curso").length;
  const finalizados = lista.filter((p) => p.estado === "finalizado").length;
  const recientes = lista.slice(0, 5);

  // Un guion em en vez de "-" mientras carga: se lee como "sin dato todavía"
  // y no como un cero.
  const metrica = (n: number) => (cargando ? "—" : n);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 border-b border-line pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Panel Principal</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Cálculo y dimensionamiento de tableros normalizados ABB
          </p>
        </div>
        <Link
          to="/proyectos"
          className="inline-flex shrink-0 items-center gap-2 rounded-control border border-brand bg-brand px-4 py-2 text-sm font-semibold text-white shadow-control transition-colors hover:border-brand-hover hover:bg-brand-hover active:bg-brand-active"
        >
          <PlusIcon className="h-4 w-4" />
          Nuevo proyecto
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metrica icono={FolderIcon} tono="brand" valor={metrica(totalProyectos)} etiqueta="Total proyectos" />
        <Metrica icono={CpuChipIcon} tono="info" valor={metrica(activos)} etiqueta="En curso" />
        <Metrica icono={CheckCircleIcon} tono="success" valor={metrica(finalizados)} etiqueta="Finalizados" />
        <Metrica
          icono={ArchiveBoxIcon}
          tono="warning"
          valor="ABB"
          etiqueta="Catálogo activo"
          numerico={false}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card flush className="lg:col-span-2">
          <CardHeader
            actions={
              <Link to="/proyectos" className="text-xs font-semibold text-brand hover:underline">
                Ver todos ({totalProyectos})
              </Link>
            }
          >
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-4 w-4 shrink-0 text-brand" />
              Proyectos recientes
            </CardTitle>
          </CardHeader>

          {cargando ? (
            <p className="p-8 text-center text-sm text-ink-subtle">Cargando proyectos…</p>
          ) : error ? (
            <p role="alert" className="m-5 rounded-control bg-danger-tint p-3 text-sm text-danger">
              {error}
            </p>
          ) : recientes.length === 0 ? (
            <div className="p-8 text-center text-sm text-ink-muted">
              Todavía no hay proyectos.{" "}
              <Link to="/proyectos" className="font-semibold text-brand hover:underline">
                Creá el primero
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-line">
              {recientes.map((p) => {
                const estado = ESTADO[p.estado] ?? { label: p.estado, tono: "neutral" as const };
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-sunken"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          to={`/proyectos/${p.id}`}
                          className="truncate text-sm font-semibold text-ink hover:text-brand"
                        >
                          {p.nombre}
                        </Link>
                        {p.codigo_obra && (
                          <Badge mono tone="neutral">
                            {p.codigo_obra}
                          </Badge>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs text-ink-subtle">
                        Cliente: <span className="text-ink-muted">{p.cliente}</span>
                        {p.analista_nombre && <span> · Autor: {p.analista_nombre}</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <Badge tone={estado.tono}>{estado.label}</Badge>
                      <Link
                        to={`/proyectos/${p.id}`}
                        className="rounded-control p-1.5 text-ink-subtle transition-colors hover:bg-surface hover:text-brand"
                        title={`Abrir workspace de ${p.nombre}`}
                      >
                        <ArrowRightIcon className="h-4 w-4" />
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card flush>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AdjustmentsVerticalIcon className="h-4 w-4 shrink-0 text-ink-muted" />
              Acceso rápido
            </CardTitle>
          </CardHeader>
          <nav className="flex flex-col gap-2 p-5" aria-label="Acceso rápido">
            {ACCESOS.map(({ to, icono: Icono, label, destacado }) => (
              <Link
                key={to}
                to={to}
                className="flex items-center gap-3 rounded-control border border-line px-3 py-2.5 text-sm font-medium text-ink transition-colors hover:border-brand-line hover:bg-brand-tint"
              >
                <Icono className={`h-4.5 w-4.5 shrink-0 ${destacado ? "text-brand" : "text-ink-muted"}`} />
                {label}
              </Link>
            ))}
          </nav>
        </Card>
      </div>
    </div>
  );
}
