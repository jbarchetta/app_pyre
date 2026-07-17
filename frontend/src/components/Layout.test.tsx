import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./Layout";

function renderLayout() {
  render(
    <MemoryRouter initialEntries={["/proyectos"]}>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/proyectos" element={<p>Página de proyectos</p>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("Layout", () => {
  it("renders active nav items as links to their route", () => {
    renderLayout();
    expect(screen.getByRole("link", { name: "Proyectos" })).toHaveAttribute("href", "/proyectos");
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogo");
    expect(screen.getByRole("link", { name: "Parámetros de cálculo" })).toHaveAttribute(
      "href",
      "/parametros-calculo",
    );
  });

  it("renders the Cotizador item as disabled, not a link", () => {
    renderLayout();
    expect(screen.queryByRole("link", { name: /cotizador/i })).not.toBeInTheDocument();
    expect(screen.getByText("Cotizador")).toBeInTheDocument();
    expect(screen.getByText(/próximo módulo/i)).toBeInTheDocument();
  });

  it("renders the matched child route via Outlet", () => {
    renderLayout();
    expect(screen.getByText("Página de proyectos")).toBeInTheDocument();
  });
});
