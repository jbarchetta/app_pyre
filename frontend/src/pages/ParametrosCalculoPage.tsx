import { useEffect, useState, type FormEvent } from "react";
import { actualizarParametrosCalculo, obtenerParametrosCalculo, type ParametroCalculo } from "../api/client";
import { Button, Card, CardBody, CardHeader, CardTitle, Field, Input } from "../components/common";

export function ParametrosCalculoPage() {
  const [parametros, setParametros] = useState<ParametroCalculo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  useEffect(() => {
    obtenerParametrosCalculo()
      .then(setParametros)
      .catch(() => setError("No se pudieron cargar los parámetros"));
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!parametros) return;
    setError(null);
    setGuardado(false);
    try {
      const actualizados = await actualizarParametrosCalculo(parametros);
      setParametros(actualizados);
      setGuardado(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron guardar los parámetros");
    }
  }

  if (!parametros) {
    return (
      <div className="p-8 text-center text-xs dato-tecnico text-ink-muted">
        Cargando parámetros de cálculo...
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-6 px-4">
      <Card>
        <CardHeader>
          <CardTitle>Parámetros de cálculo</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Field label="Tensión monofásica (V)">
              {(props) => (
                <Input
                  {...props}
                  value={parametros.tension_mono_v}
                  onChange={(e) => setParametros({ ...parametros, tension_mono_v: e.target.value })}
                  mono
                />
              )}
            </Field>

            <Field label="Tensión trifásica (V)">
              {(props) => (
                <Input
                  {...props}
                  value={parametros.tension_tri_v}
                  onChange={(e) => setParametros({ ...parametros, tension_tri_v: e.target.value })}
                  mono
                />
              )}
            </Field>

            <Field label="Cos φ">
              {(props) => (
                <Input
                  {...props}
                  value={parametros.cos_phi}
                  onChange={(e) => setParametros({ ...parametros, cos_phi: e.target.value })}
                  mono
                />
              )}
            </Field>

            <Field label="Ratio de selectividad">
              {(props) => (
                <Input
                  {...props}
                  value={parametros.ratio_selectividad}
                  onChange={(e) => setParametros({ ...parametros, ratio_selectividad: e.target.value })}
                  mono
                />
              )}
            </Field>

            {error && (
              <p role="alert" className="text-xs font-medium text-danger">
                {error}
              </p>
            )}

            {guardado && (
              <p className="text-xs font-medium text-success">
                Guardado
              </p>
            )}

            <div className="pt-2">
              <Button type="submit" variant="primary">
                Guardar
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
