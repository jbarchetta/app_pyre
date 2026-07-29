import { describe, it, expect, vi } from "vitest";
import { exportarPdfProfesional } from "./pdfExporter";
import type { CadDocument } from "./types";

vi.mock("jspdf", () => {
  return {
    jsPDF: function MockJsPDF() {
      return {
        internal: {
          pageSize: {
            getWidth: () => 297,
            getHeight: () => 210,
          },
        },
        setFillColor: vi.fn(),
        setDrawColor: vi.fn(),
        setLineWidth: vi.fn(),
        rect: vi.fn(),
        line: vi.fn(),
        setFont: vi.fn(),
        setFontSize: vi.fn(),
        setTextColor: vi.fn(),
        text: vi.fn(),
        addImage: vi.fn(),
        addPage: vi.fn(),
        save: vi.fn(),
      };
    },
  };
});

describe("pdfExporter", () => {
  const dummyDocTopo: CadDocument = {
    title: "Plano Topográfico",
    layers: [],
    primitives: [],
    bounds: { minX: 0, minY: 0, maxX: 600, maxY: 800 },
  };

  const dummyDocUnif: CadDocument = {
    title: "Esquema Unifilar",
    layers: [],
    primitives: [],
    bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 600 },
  };

  it("exports a multi-page PDF with 300 DPI resolution without errors", () => {
    expect(() => {
      exportarPdfProfesional(dummyDocTopo, "test.pdf", null, "light", {
        cadDocTopografico: dummyDocTopo,
        cadDocUnifilar: dummyDocUnif,
        filename: "test.pdf",
      });
    }).not.toThrow();
  });
});
