import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { RequireAuth } from "./RequireAuth";

vi.mock("../api/client", () => ({
  fetchCurrentUser: vi.fn(),
}));

import { fetchCurrentUser } from "../api/client";

function renderWithRouter() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <Routes>
        <Route path="/login" element={<p>Pantalla de login</p>} />
        <Route
          path="/"
          element={
            <RequireAuth>
              <p>Panel protegido</p>
            </RequireAuth>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("RequireAuth", () => {
  it("renders children when the user is authenticated", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue({
      id: "1",
      email: "ana@pyre.com",
      nombre: "Ana",
      rol: "analista",
    });

    renderWithRouter();

    expect(await screen.findByText("Panel protegido")).toBeInTheDocument();
  });

  it("redirects to /login when the user is not authenticated", async () => {
    vi.mocked(fetchCurrentUser).mockResolvedValue(null);

    renderWithRouter();

    expect(await screen.findByText("Pantalla de login")).toBeInTheDocument();
  });
});
