import { jsPDF } from "jspdf";
import type { CadDocument } from "./types";
import { CadCanvasEngine } from "../engine/CadCanvasEngine";

/**
 * Exportador Profesional de Planos CAD a PDF (Vector/High-DPI A4/A3 Landscape)
 * Genera un PDF de alta calidad técnica con carátula y cuadro de rotulación industrial.
 */
export function exportarPdfProfesional(
  cadDoc: CadDocument,
  filename: string = "tablero_pyre_unifilar.pdf",
  _sourceCanvas?: HTMLCanvasElement | null,
  _theme: "light" | "dark" = "dark"
) {
  // Crear documento PDF en formato A4 Apaisado (297mm x 210mm)
  const pdf = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = pdf.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 210 mm

  // Margin y marco exterior CAD (5mm de borde)
  const margin = 5;
  const drawWidth = pageWidth - 2 * margin; // 287 mm
  const drawHeight = pageHeight - 2 * margin; // 200 mm

  // Offscreen canvas para renderizado de alta resolución (3x scale)
  const offscreenCanvas = document.createElement("canvas");
  const scale = 3.0;
  offscreenCanvas.width = drawWidth * scale;
  offscreenCanvas.height = drawHeight * scale;

  const engine = new CadCanvasEngine(offscreenCanvas);
  engine.render(cadDoc, { zoom: 1, panX: 0, panY: 0 }, null, { theme: "light" });

  // Convertir canvas a Data URL (PNG de alta densidad)
  const imgData = offscreenCanvas.toDataURL("image/png");

  // Fondo blanco en el PDF
  pdf.setFillColor(255, 255, 255);
  pdf.rect(0, 0, pageWidth, pageHeight, "F");

  // Marco de borde exterior CAD (Grosor 0.5mm)
  pdf.setDrawColor(15, 23, 42); // slate-900
  pdf.setLineWidth(0.5);
  pdf.rect(margin, margin, drawWidth, drawHeight);

  // Insertar la imagen del dibujo CAD en el centro del marco
  pdf.addImage(imgData, "PNG", margin + 1, margin + 1, drawWidth - 2, drawHeight - 20);

  // -------------------------------------------------------------------------
  // CUADRO DE ROTULACIÓN PROFESIONAL (TITLE BLOCK INDUSTRIAL EN PIE DERECHO)
  // -------------------------------------------------------------------------
  const tbWidth = 140; // mm
  const tbHeight = 18; // mm
  const tbX = pageWidth - margin - tbWidth;
  const tbY = pageHeight - margin - tbHeight;

  // Fondo del cuadro de rotulación
  pdf.setFillColor(248, 250, 252); // slate-50
  pdf.rect(tbX, tbY, tbWidth, tbHeight, "FD");

  // Líneas divisorias del rotulo
  pdf.setLineWidth(0.3);
  pdf.line(tbX + 45, tbY, tbX + 45, tbY + tbHeight);
  pdf.line(tbX + 95, tbY, tbX + 95, tbY + tbHeight);
  pdf.line(tbX, tbY + 9, tbX + tbWidth, tbY + 9);

  // Texto Rotulo 1: Marca y Plataforma
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(8);
  pdf.setTextColor(220, 38, 38); // Red ABB #DC2626
  pdf.text("ABB / PYRE TABLEROS", tbX + 3, tbY + 5.5);
  pdf.setFontSize(6);
  pdf.setTextColor(71, 85, 105);
  pdf.text("INGENIERIA ELECTRICA", tbX + 3, tbY + 14);

  // Texto Rotulo 2: Título del Plano
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7.5);
  pdf.setTextColor(15, 23, 42);
  pdf.text("ESQUEMA ELECTRICO UNIFILAR", tbX + 48, tbY + 5.5);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(6);
  pdf.text("NORMATIVA IEC 60617 / CAD 1:1", tbX + 48, tbY + 14);

  // Texto Rotulo 3: Fecha y Escala
  const fechaStr = new Date().toLocaleDateString("es-AR");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(6.5);
  pdf.text(`FECHA: ${fechaStr}`, tbX + 98, tbY + 5.5);
  pdf.text("ESCALA: 1:1 (A4)", tbX + 98, tbY + 14);

  // Descarga directa en navegador
  pdf.save(filename);
}
