import { useState, type FormEvent } from "react";
import { importarCatalogo, type ResumenImportCatalogo } from "../api/client";

export function CatalogoPage() {
  const [proveedor, setProveedor] = useState("abb");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [resumen, setResumen] = useState<ResumenImportCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setResumen(null);

    if (!archivo) {
      setError("Elegí un archivo");
      return;
    }

    try {
      const result = await importarCatalogo(proveedor, archivo);
      setResumen(result);
    } catch {
      setError("No se pudo importar el catálogo");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-3 border border-surface-stroke bg-white p-8">
      <h1 className="text-xl font-bold">Importar catálogo</h1>
      <label htmlFor="proveedor">Proveedor</label>
      <select id="proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)}>
        <option value="abb">ABB</option>
        <option value="otros">Otros materiales</option>
      </select>
      <label htmlFor="archivo">Archivo Excel</label>
      <input
        id="archivo"
        type="file"
        accept=".xlsx"
        onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
      />
      {error && <p role="alert" className="text-error">{error}</p>}
      <button type="submit" className="self-start bg-abb-red px-6 py-3 text-sm uppercase tracking-widest text-white">
        Importar
      </button>
      {resumen && (
        <p data-testid="resumen" className="font-mono text-sm">
          Total: {resumen.total_filas} — Nuevos: {resumen.nuevos} — Actualizados: {resumen.actualizados} — Sin
          cambios: {resumen.sin_cambios}
        </p>
      )}
    </form>
  );
}
