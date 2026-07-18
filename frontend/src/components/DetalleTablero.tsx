import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import {
  actualizarTablero,
  crearSeccion,
  listarSalidas,
  listarSecciones,
  type ComponenteBusqueda,
  type Salida,
  type Seccion,
  type Tablero,
} from "../api/client";
import type { Capas } from "./EsquemaVisual";
import { EsquemaVisualCanvas } from "./EsquemaVisualCanvas";
import { ComponentePicker } from "./ComponentePicker";
import { SeccionBlock } from "./SeccionBlock";

interface SeccionConSalidas {
  seccion: Seccion;
  salidas: Salida[];
}

interface Vista {
  zoom: number;
  capas: Capas;
}

interface DetalleTableroProps {
  tablero: Tablero;
  onTableroActualizado: (tablero: Tablero) => void;
  vista: Vista;
  onZoomChange: (zoom: number) => void;
  onCapasChange: (capas: Capas) => void;
}

type ModoEdicion = "nivel_falla" | "interruptor_principal" | null;

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  vista,
  onZoomChange,
  onCapasChange,
}: DetalleTableroProps) {
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [seccionSeleccionadaRaw, setSeccionSeleccionadaRaw] = useState<string | null>(null);
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [modoEdicion, setModoEdicion] = useState<ModoEdicion>(null);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [error, setError] = useState<string | null>(null);
  const nivelFallaTriggerRef = useRef<HTMLButtonElement>(null);
  const interruptorTriggerRef = useRef<HTMLButtonElement>(null);
  const nivelFallaInputRef = useRef<HTMLInputElement>(null);
  const interruptorDialogRef = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    const seccionesCargadas = await listarSecciones(tablero.id);
    const conSalidas = await Promise.all(
      seccionesCargadas.map(async (seccion) => ({ seccion, salidas: await listarSalidas(seccion.id) })),
    );
    setSecciones(conSalidas);
  }, [tablero.id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const seccionSeleccionadaId = secciones.some((s) => s.seccion.id === seccionSeleccionadaRaw)
    ? seccionSeleccionadaRaw
    : (secciones[0]?.seccion.id ?? null);
  const seccionSeleccionada = secciones.find((s) => s.seccion.id === seccionSeleccionadaId) ?? null;

  const cerrarModal = useCallback(() => {
    setModoEdicion((modoAnterior) => {
      const triggerAnterior = modoAnterior === "nivel_falla" ? nivelFallaTriggerRef : interruptorTriggerRef;
      triggerAnterior.current?.focus();
      return null;
    });
    setError(null);
  }, []);

  useEffect(() => {
    setError(null);
    if (!modoEdicion) return;
    if (modoEdicion === "nivel_falla") {
      nivelFallaInputRef.current?.focus();
    } else {
      interruptorDialogRef.current?.focus();
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") cerrarModal();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [modoEdicion, cerrarModal]);

  async function handleAgregarSeccion(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const seccion = await crearSeccion(tablero.id, nombreSeccion, secciones.length);
      setSecciones((actuales) => [...actuales, { seccion, salidas: [] }]);
      setNombreSeccion("");
    } catch {
      setError("No se pudo crear la sección");
    }
  }

  async function handleGuardarNivelFalla(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { nivel_falla_ka: nivelFallaKaEdit });
      onTableroActualizado(actualizado);
      cerrarModal();
    } catch {
      setError("No se pudo actualizar el nivel de falla");
    }
  }

  async function handleSeleccionarInterruptorPrincipal(componente: ComponenteBusqueda) {
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { interruptor_principal_id: componente.id });
      onTableroActualizado(actualizado);
      cerrarModal();
    } catch {
      setError("No se pudo actualizar el interruptor principal");
    }
  }

  function handleSalidaCreada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      actuales.map((s) => (s.seccion.id === seccionId ? { ...s, salidas: [...s.salidas, salida] } : s)),
    );
  }

  function handleSalidaActualizada(seccionId: string, salida: Salida) {
    setSecciones((actuales) =>
      actuales.map((s) =>
        s.seccion.id === seccionId
          ? { ...s, salidas: s.salidas.map((sal) => (sal.id === salida.id ? salida : sal)) }
          : s,
      ),
    );
  }

  return (
    <div className="mt-8">
      <div className="flex flex-col gap-2">
        <p className="flex flex-wrap items-center gap-2">
          Nivel de falla (Icc): {tablero.nivel_falla_ka} kA
          <button
            ref={nivelFallaTriggerRef}
            type="button"
            aria-label="Editar nivel de falla"
            onClick={() => {
              setNivelFallaKaEdit(tablero.nivel_falla_ka);
              setModoEdicion("nivel_falla");
            }}
          >
            <span className="material-symbols-outlined text-abb-red text-sm">edit</span>
          </button>
        </p>
        <p className="flex flex-wrap items-center gap-2">
          Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}
          <button
            ref={interruptorTriggerRef}
            type="button"
            aria-label="Editar interruptor principal"
            onClick={() => setModoEdicion("interruptor_principal")}
          >
            <span className="material-symbols-outlined text-abb-red text-sm">edit</span>
          </button>
        </p>
      </div>

      {modoEdicion === "nivel_falla" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModal}>
          <form
            onSubmit={handleGuardarNivelFalla}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="nivel-falla-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="nivel-falla-modal-titulo" className="text-lg font-bold">
              Nivel de falla (Icc)
            </h2>
            <label htmlFor="nivel-falla-edit">Nuevo nivel de falla (kA)</label>
            <input
              id="nivel-falla-edit"
              ref={nivelFallaInputRef}
              value={nivelFallaKaEdit}
              onChange={(e) => setNivelFallaKaEdit(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <div className="mt-4 flex gap-2">
              <button type="submit" className="bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
                Guardar
              </button>
              <button
                type="button"
                onClick={cerrarModal}
                className="border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {modoEdicion === "interruptor_principal" && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40" onClick={cerrarModal}>
          <div
            ref={interruptorDialogRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="interruptor-modal-titulo"
            className="flex w-96 flex-col gap-2 border border-surface-stroke bg-white p-8"
          >
            <h2 id="interruptor-modal-titulo" className="text-lg font-bold">
              Interruptor principal
            </h2>
            <ComponentePicker onSelect={handleSeleccionarInterruptorPrincipal} />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <button
              type="button"
              onClick={cerrarModal}
              className="mt-4 self-start border border-surface-stroke px-6 py-3 text-sm uppercase tracking-widest"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-6 lg:flex-row">
        <div className="w-full lg:w-1/3">
          <EsquemaVisualCanvas
            tieneInterruptorPrincipal={!!tablero.interruptor_principal_id}
            secciones={secciones}
            zoom={vista.zoom}
            onZoomChange={onZoomChange}
            capas={vista.capas}
            onCapasChange={onCapasChange}
          />
        </div>
        <div className="w-full lg:flex-1">
          {secciones.length > 0 && (
            <div
              role="tablist"
              aria-label="Secciones del tablero"
              className="flex flex-wrap gap-1 border-b border-surface-stroke"
            >
              {secciones.map(({ seccion }) => (
                <button
                  key={seccion.id}
                  role="tab"
                  type="button"
                  aria-selected={seccion.id === seccionSeleccionadaId}
                  onClick={() => setSeccionSeleccionadaRaw(seccion.id)}
                  className={`px-4 py-2 text-sm uppercase tracking-widest ${
                    seccion.id === seccionSeleccionadaId
                      ? "border-b-2 border-abb-red text-abb-red"
                      : "text-secondary hover:text-on-background"
                  }`}
                >
                  {seccion.nombre}
                </button>
              ))}
            </div>
          )}
          {seccionSeleccionada && (
            <SeccionBlock
              key={seccionSeleccionada.seccion.id}
              seccion={seccionSeleccionada.seccion}
              salidas={seccionSeleccionada.salidas}
              onSalidaCreada={(salida) => handleSalidaCreada(seccionSeleccionada.seccion.id, salida)}
              onSalidaActualizada={(salida) => handleSalidaActualizada(seccionSeleccionada.seccion.id, salida)}
            />
          )}
          <form onSubmit={handleAgregarSeccion} className="mt-6 flex flex-col gap-2">
            <label htmlFor="nombre-seccion">Nueva sección</label>
            <input id="nombre-seccion" value={nombreSeccion} onChange={(e) => setNombreSeccion(e.target.value)} />
            {error && (
              <p role="alert" className="text-error">
                {error}
              </p>
            )}
            <button
              type="submit"
              className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white"
            >
              Agregar sección
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
