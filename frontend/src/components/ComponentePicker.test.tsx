import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ComponentePicker } from "./ComponentePicker";

describe("ComponentePicker", () => {
  it("does not search with fewer than 2 characters", async () => {
    vi.stubGlobal("fetch", vi.fn());
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "a");

    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows results and calls onSelect when clicked", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "c1", codigo: "SH201-C16", descripcion: "Interruptor 16A", precio_neto: "50.00" }],
      }),
    );
    const onSelect = vi.fn();
    render(<ComponentePicker onSelect={onSelect} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "SH201");
    await userEvent.click(await screen.findByRole("button", { name: /SH201-C16/i }));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "c1", codigo: "SH201-C16" }));
  });

  it("shows 'sin resultados' when the search returns nothing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    render(<ComponentePicker onSelect={vi.fn()} />);

    await userEvent.type(screen.getByLabelText(/buscar código/i), "zzzz");

    expect(await screen.findByText(/sin resultados/i)).toBeInTheDocument();
  });
});
