import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentePicker } from "./ComponentePicker";
import { guardarMemoria, obtenerMemoria, limpiarMemoriaParaTests } from "./componentePickerMemoria";

const CATEGORIAS = ["Interruptores Termomagneticos"];

describe("ComponentePicker", () => {
  beforeEach(() => {
    limpiarMemoriaParaTests();
  });
  it("renders as a dialog and calls onCancel when Cancelar is clicked", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const onCancel = vi.fn();
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={onCancel} />);

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /cancelar/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it("calls onCancel on Escape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const onCancel = vi.fn();
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={onCancel} />);

    await userEvent.keyboard("{Escape}");

    expect(onCancel).toHaveBeenCalled();
  });

  it("does not search with fewer than 2 characters", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    vi.mocked(fetch).mockClear();

    await userEvent.type(screen.getByLabelText(/buscar código/i), "a");

    expect(fetch).not.toHaveBeenCalledWith(expect.stringContaining("/catalogo/buscar"), expect.anything());
  });

  it("includes the categorias filter in the search request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");

    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining("categorias=Interruptores"),
      expect.anything(),
    );
  });

  it("with an empty categorias array, does not add a categorias filter to the request (documents current contract)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker contextKey="test" categorias={[]} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");

    expect(fetch).toHaveBeenCalledWith(
      expect.not.stringContaining("categorias="),
      expect.anything(),
    );
  });

  it("shows results and calls onSelect when clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    const onSelect = vi.fn();
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={onSelect} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await userEvent.click(await screen.findByRole("button", { name: /SH201-C16/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", codigo: "SH201-C16" }));
  });

  it("shows 'sin resultados' when the search returns nothing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ resultados: [], total: 0 }) }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "zzzz");

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });

  it("shows a result count and no 'Cargar más' button when everything fits", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
          total: 1,
        }),
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");

    expect(await screen.findByText(/mostrando 1 de 1 resultados/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /cargar más/i })).not.toBeInTheDocument();
  });

  it("loads more results without replacing the ones already shown", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        const esSegundaPagina = url.includes("offset=1");
        return Promise.resolve({
          ok: true,
          json: async () =>
            esSegundaPagina
              ? {
                  resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
                  total: 2,
                }
              : {
                  resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
                  total: 2,
                },
        });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByText(/mostrando 1 de 2 resultados/i);

    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));

    expect(await screen.findByRole("button", { name: /SH201-C20/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SH201-C16/i })).toBeInTheDocument();
    expect(screen.getByText(/mostrando 2 de 2 resultados/i)).toBeInTheDocument();
  });

  it("ignores a stale Cargar más response if the query changed before it resolved", async () => {
    let resolverPrimeraPagina: (value: unknown) => void = () => {};
    let resolverSegundaPagina: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("SH201") && url.includes("offset=0")) {
          return new Promise((resolve) => {
            resolverPrimeraPagina = resolve;
          });
        }
        if (url.includes("SH201") && url.includes("offset=1")) {
          return new Promise((resolve) => {
            resolverSegundaPagina = resolve;
          });
        }
        return Promise.resolve({
          ok: true,
          json: async () => ({
            resultados: [{ id: "x1", codigo: "XT2N100", descripcion: "Otro interruptor", precio_neto: "10.00" }],
            total: 1,
          }),
        });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    resolverPrimeraPagina({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
        total: 2,
      }),
    });
    await screen.findByRole("button", { name: /SH201-C16/i });

    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));
    await userEvent.clear(screen.getByLabelText(/buscar código/i));
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N100");
    await screen.findByRole("button", { name: /XT2N100/i });

    resolverSegundaPagina({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
        total: 2,
      }),
    });

    await new Promise((r) => setTimeout(r, 0));

    expect(screen.queryByRole("button", { name: /SH201-C20/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /XT2N100/i })).toBeInTheDocument();
  });

  it("disables Cargar más while a request is in flight, preventing duplicate loads", async () => {
    let resolverSegundaPagina: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("offset=0")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
              total: 2,
            }),
          });
        }
        return new Promise((resolve) => {
          resolverSegundaPagina = resolve;
        });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByRole("button", { name: /SH201-C16/i });

    const botonCargarMas = screen.getByRole("button", { name: /cargar más/i });
    await userEvent.click(botonCargarMas);

    expect(screen.getByRole("button", { name: /cargando/i })).toBeDisabled();

    resolverSegundaPagina({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
        total: 2,
      }),
    });

    expect(await screen.findByRole("button", { name: /SH201-C20/i })).toBeInTheDocument();
    const filas = screen.getAllByRole("button", { name: /SH201-C20/i });
    expect(filas).toHaveLength(1);
  });

  it("does not get stuck disabled after a query change interrupts a pending Cargar más", async () => {
    let resolverSegundaPaginaVieja: (value: unknown) => void = () => {};
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("SH201") && url.includes("offset=0")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              resultados: [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
              total: 2,
            }),
          });
        }
        if (url.includes("SH201") && url.includes("offset=1")) {
          return new Promise((resolve) => {
            resolverSegundaPaginaVieja = resolve;
          });
        }
        // La búsqueda nueva ("XT2N100") también tiene más resultados de los que muestra,
        // para que "Cargar más" deba aparecer habilitado otra vez.
        return Promise.resolve({
          ok: true,
          json: async () => ({
            resultados: [{ id: "x1", codigo: "XT2N100", descripcion: "Otro interruptor", precio_neto: "10.00" }],
            total: 2,
          }),
        });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await screen.findByRole("button", { name: /SH201-C16/i });
    await userEvent.click(screen.getByRole("button", { name: /cargar más/i }));

    await userEvent.clear(screen.getByLabelText(/buscar código/i));
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N100");
    await screen.findByRole("button", { name: /XT2N100/i });

    resolverSegundaPaginaVieja({
      ok: true,
      json: async () => ({
        resultados: [{ id: "c2", codigo: "SH201-C20", descripcion: "Interruptor 20A", precio_neto: "55.00" }],
        total: 2,
      }),
    });
    await new Promise((r) => setTimeout(r, 0));

    expect(screen.getByRole("button", { name: /cargar más/i })).not.toBeDisabled();
  });

  it("does not close when a mousedown starts inside the dialog but the click resolves on the backdrop", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }));
    const onCancel = vi.fn();
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={onCancel} />);

    const dialog = screen.getByRole("dialog");
    const backdrop = dialog.parentElement!;
    fireEvent.mouseDown(dialog);
    fireEvent.click(backdrop);

    expect(onCancel).not.toHaveBeenCalled();
  });

  it("fetches filter options on mount and shows them when Filtros is opened", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({
              polos: [1, 3],
              corrientes_nominales_a: ["16", "32"],
              capacidades_corte_ka: ["10", "18"],
            }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));

    expect(await screen.findByRole("option", { name: "3" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "16A" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "10kA" })).toBeInTheDocument();
  });

  it("always includes solo_con_atributos=true in search requests", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT");

    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("solo_con_atributos=true"), expect.anything());
  });

  it("includes the selected polos filter in the search request after typing a query", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [3], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT");
    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));
    await userEvent.selectOptions(await screen.findByLabelText(/polos/i), "3");

    expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("polos=3"), expect.anything());
  });

  it("removing an active filter chip re-runs the search without that filter", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [3], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );
    render(<ComponentePicker contextKey="test" categorias={CATEGORIAS} onSelect={vi.fn()} onCancel={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT");
    await userEvent.click(await screen.findByRole("button", { name: /filtros/i }));
    await userEvent.selectOptions(await screen.findByLabelText(/polos/i), "3");
    await userEvent.click(screen.getByRole("button", { name: /3 polos/i }));

    expect(fetch).toHaveBeenLastCalledWith(expect.not.stringContaining("polos=3"), expect.anything());
    expect(screen.queryByRole("button", { name: /3 polos/i })).not.toBeInTheDocument();
  });

  it("prefills the query and filters from a previous search in the same context", async () => {
    guardarMemoria("test-contexto-recordado", {
      query: "XT2N",
      filtroPolos: 3,
      filtroCorriente: null,
      filtroCapacidad: null,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [3], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );

    render(
      <ComponentePicker
        categorias={CATEGORIAS}
        contextKey="test-contexto-recordado"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText(/buscar código/i)).toHaveValue("XT2N");
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("q=XT2N"), expect.anything());
  });

  it("does not prefill from a different context", async () => {
    guardarMemoria("otro-contexto", { query: "S200", filtroPolos: null, filtroCorriente: null, filtroCapacidad: null });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );

    render(
      <ComponentePicker
        categorias={CATEGORIAS}
        contextKey="un-contexto-nuevo-sin-memoria"
        onSelect={vi.fn()}
        onCancel={vi.fn()}
      />,
    );

    expect(await screen.findByLabelText(/buscar código/i)).toHaveValue("");
  });

  it("remembers the query for its context after typing", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/catalogo/opciones-filtro")) {
          return Promise.resolve({
            ok: true,
            json: async () => ({ polos: [], corrientes_nominales_a: [], capacidades_corte_ka: [] }),
          });
        }
        return Promise.resolve({ ok: true, json: async () => ({ resultados: [], total: 0 }) });
      }),
    );

    render(
      <ComponentePicker categorias={CATEGORIAS} contextKey="test-contexto-guardar" onSelect={vi.fn()} onCancel={vi.fn()} />,
    );
    await userEvent.type(screen.getByLabelText(/buscar código/i), "XT2N");

    expect(obtenerMemoria("test-contexto-guardar")?.query).toBe("XT2N");
  });
});
