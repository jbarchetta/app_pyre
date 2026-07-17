import { useCallback, useEffect, useState, type FormEvent } from "react";
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

export function DetalleTablero({
  tablero,
  onTableroActualizado,
  vista,
  onZoomChange,
  onCapasChange,
}: DetalleTableroProps) {
  const [secciones, setSecciones] = useState<SeccionConSalidas[]>([]);
  const [nombreSeccion, setNombreSeccion] = useState("");
  const [editandoNivelFalla, setEditandoNivelFalla] = useState(false);
  const [nivelFallaKaEdit, setNivelFallaKaEdit] = useState("");
  const [editandoInterruptorPrincipal, setEditandoInterruptorPrincipal] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      setEditandoNivelFalla(false);
    } catch {
      setError("No se pudo actualizar el nivel de falla");
    }
  }

  async function handleSeleccionarInterruptorPrincipal(componente: ComponenteBusqueda) {
    setError(null);
    try {
      const actualizado = await actualizarTablero(tablero.id, { interruptor_principal_id: componente.id });
      onTableroActualizado(actualizado);
      setEditandoInterruptorPrincipal(false);
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
      <p>
        Nivel de falla: {tablero.nivel_falla_ka} kA{" "}
        {!editandoNivelFalla && (
          <button
            type="button"
            onClick={() => {
              setNivelFallaKaEdit(tablero.nivel_falla_ka);
              setEditandoNivelFalla(true);
            }}
          >
            editar nivel de falla
          </button>
        )}
      </p>
      {editandoNivelFalla && (
        <form onSubmit={handleGuardarNivelFalla}>
          <label htmlFor="nivel-falla-edit">Nuevo nivel de falla (kA)</label>
          <input
            id="nivel-falla-edit"
            value={nivelFallaKaEdit}
            onChange={(e) => setNivelFallaKaEdit(e.target.value)}
          />
          <button type="submit">Guardar</button>
          <button type="button" onClick={() => setEditandoNivelFalla(false)}>
            Cancelar
          </button>
        </form>
      )}
      <p>
        Interruptor principal: {tablero.interruptor_principal_id ? tablero.interruptor_principal_id : "sin definir"}{" "}
        {!editandoInterruptorPrincipal && (
          <button type="button" onClick={() => setEditandoInterruptorPrincipal(true)}>
            editar interruptor principal
          </button>
        )}
      </p>
      {editandoInterruptorPrincipal && (
        <div>
          <ComponentePicker onSelect={handleSeleccionarInterruptorPrincipal} />
          <button type="button" onClick={() => setEditandoInterruptorPrincipal(false)}>
            Cancelar
          </button>
        </div>
      )}

      <EsquemaVisualCanvas
        tieneInterruptorPrincipal={!!tablero.interruptor_principal_id}
        secciones={secciones}
        zoom={vista.zoom}
        onZoomChange={onZoomChange}
        capas={vista.capas}
        onCapasChange={onCapasChange}
      />

      {secciones.map(({ seccion, salidas }) => (
        <SeccionBlock
          key={seccion.id}
          seccion={seccion}
          salidas={salidas}
          onSalidaCreada={(salida) => handleSalidaCreada(seccion.id, salida)}
          onSalidaActualizada={(salida) => handleSalidaActualizada(seccion.id, salida)}
        />
      ))}
      <form onSubmit={handleAgregarSeccion}>
        <label htmlFor="nombre-seccion">Nueva sección</label>
        <input id="nombre-seccion" value={nombreSeccion} onChange={(e) => setNombreSeccion(e.target.value)} />
        {error && <p role="alert">{error}</p>}
        <button type="submit">Agregar sección</button>
      </form>
    </div>
  );
}
