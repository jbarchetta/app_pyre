import { jsPDF } from "jspdf";
import type { CadDocument } from "./types";
import { CadCanvasEngine } from "../engine/CadCanvasEngine";
import { calculateFitToScreen } from "./transform";

export interface PdfExportOptions {
  filename?: string;
  cadDocTopografico?: CadDocument | null;
  cadDocUnifilar?: CadDocument | null;
  cadDocActual?: CadDocument | null;
  nombreTablero?: string;
}

/**
 * Renderiza un documento CAD en un canvas offscreen de Ultra-Alta Definición (300 DPI)
 * y devuelve la Data URL en formato PNG sin pérdida de nitidez.
 */
function renderCadDocHighDpi(cadDoc: CadDocument): string {
  // A4 Landscape: 287mm x 185mm útiles para el plano
  const widthPx = 2400;
  const heightPx = 1550;

  const offscreenCanvas = document.createElement("canvas");
  offscreenCanvas.width = widthPx;
  offscreenCanvas.height = heightPx;

  const engine = new CadCanvasEngine(offscreenCanvas);
  const viewport = calculateFitToScreen(cadDoc.bounds, widthPx, heightPx, 60);

  engine.render(cadDoc, viewport, null, {
    theme: "light",
    showGrid: true,
    showCrosshair: false,
  });

  return offscreenCanvas.toDataURL("image/png", 1.0);
}

/**
 * Renderiza el Cuadro de Rotulación Industrial (Title Block Vectorial) al pie del plano.
 */
function renderTitleBlock(
  pdf: jsPDF,
  tituloPlano: string,
  hojaActual: number,
  totalHojas: number,
  nombreTablero?: string
) {
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 5;

  const tbWidth = 150; // mm
  const tbHeight = 18; // mm
  const tbX = pageWidth - margin - tbWidth;
  const tbY = pageHeight - margin - tbHeight;

  // Fondo del cuadro de rotulación (Blanco con borde slate)
  pdf.setFillColor(252, 253, 255);
  pdf.setDrawColor(15, 23, 42); // slate-900
  pdf.setLineWidth(0.4);
  pdf.rect(tbX, tbY, tbWidth, tbHeight, "FD");

  // Divisores verticales del rótulo
  pdf.setLineWidth(0.3);
  pdf.line(tbX + 50, tbY, tbX + 50, tbY + tbHeight);
  pdf.line(tbX + 110, tbY, tbX + 110, tbY + tbHeight);

  // Divisor horizontal central
  pdf.line(tbX, tbY + 9, tbX + tbWidth, tbY + 9);

  // Columna 1: Marca y Empresa
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8.5);
  pdf.setTextColor(220, 38, 38); // Rojo ABB #DC2626
  pdf.text("ABB / PYRE TABLEROS", tbX + 3, tbY + 5.5);
  pdf.setFontSize(6);
  pdf.setTextColor(71, 85, 105);
  pdf.text("INGENIERÍA ELÉCTRICA Y CAD", tbX + 3, tbY + 14);

  // Columna 2: Título del Plano y Tablero
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(tituloPlano.toUpperCase(), tbX + 53, tbY + 5.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6);
  pdf.text(`TABLERO: ${nombreTablero || "TABLERO PRINCIPAL NIS"}`, tbX + 53, tbY + 14);

  // Columna 3: Fecha, Escala y Hoja
  const fechaStr = new Date().toLocaleDateString("es-AR");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text(`FECHA: ${fechaStr}`, tbX + 113, tbY + 5.5);
  pdf.text(`HOJA ${hojaActual} DE ${totalHojas} (A4)`, tbX + 113, tbY + 14);
}

/**
 * Exportador Profesional de Planos CAD a PDF (Vector/High-DPI 300 DPI A4 Landscape)
 * Genera un PDF de ultra-alta nitidez con ambos planos (Topográfico y Unifilar).
 */
export function exportarPdfProfesional(
  cadDoc: CadDocument,
  filename: string = "tablero_pyre.pdf",
  _sourceCanvas?: HTMLCanvasElement | null,
  _theme: "light" | "dark" = "dark",
  options?: PdfExportOptions
) {
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 210 mm
  const margin = 5;
  const drawWidth = pageWidth - 2 * margin; // 287 mm
  const drawHeight = pageHeight - 2 * margin; // 200 mm

  // Determinar los planos a renderizar
  const docTopo = options?.cadDocTopografico;
  const docUnif = options?.cadDocUnifilar;

  const paginas: { doc: CadDocument; titulo: string }[] = [];

  if (docTopo && docUnif) {
    paginas.push({ doc: docTopo, titulo: "ELEVACIÓN TOPOGRÁFICA DE TABLERO" });
    paginas.push({ doc: docUnif, titulo: "ESQUEMA ELÉCTRICO UNIFILAR (IEC 60617)" });
  } else if (docTopo) {
    paginas.push({ doc: docTopo, titulo: "ELEVACIÓN TOPOGRÁFICA DE TABLERO" });
  } else if (docUnif) {
    paginas.push({ doc: docUnif, titulo: "ESQUEMA ELÉCTRICO UNIFILAR (IEC 60617)" });
  } else {
    // Si sólo se pasa el documento cadDoc actual
    const titulo = cadDoc.title || "PLANO TÉCNICO CAD DE TABLERO";
    paginas.push({ doc: cadDoc, titulo });
  }

  const totalPaginas = paginas.length;

  paginas.forEach((pag, idx) => {
    if (idx > 0) {
      pdf.addPage("a4", "landscape");
    }

    // Fondo Blanco
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageWidth, pageHeight, "F");

    // Marco exterior (Grosor 0.5mm)
    pdf.setDrawColor(15, 23, 42);
    pdf.setLineWidth(0.5);
    pdf.rect(margin, margin, drawWidth, drawHeight);

    // Renderizar dibujo CAD en Ultra-Alta Resolución (300 DPI)
    const imgData = renderCadDocHighDpi(pag.doc);
    pdf.addImage(imgData, "PNG", margin + 1, margin + 1, drawWidth - 2, drawHeight - 20, undefined, "FAST");

    // Renderizar Cuadro de Rotulación Industrial Vectorial
    renderTitleBlock(pdf, pag.titulo, idx + 1, totalPaginas, options?.nombreTablero);
  });

  // Guardar archivo PDF de alta resolución
  pdf.save(filename);
}
