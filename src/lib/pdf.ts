import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { DaySummary, MonthTotals, Profile } from "./attendance";
import { MONTH_LABELS, formatMinutes, formatTime, isoToDisplay } from "./time-utils";

export type ReportBlock = {
  employee: Profile;
  days: DaySummary[];
  totals: MonthTotals;
};

export function generateMonthlyReport(params: {
  companyName: string;
  year: number;
  month: number;
  blocks: ReportBlock[];
}) {
  const { companyName, year, month, blocks } = params;
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  blocks.forEach((block, index) => {
    if (index > 0) doc.addPage();

    doc.setFontSize(16);
    doc.setTextColor(60, 30, 110);
    doc.text(companyName, 40, 42);

    doc.setFontSize(12);
    doc.setTextColor(30, 30, 30);
    doc.text("Espelho de Ponto Mensal", 40, 62);

    doc.setFontSize(10);
    doc.setTextColor(80, 80, 80);
    doc.text(`Funcionário: ${block.employee.full_name}`, 40, 80);
    doc.text(`Matrícula: ${block.employee.employee_code ?? "-"}`, 320, 80);
    doc.text(`Referência: ${MONTH_LABELS[month - 1]}/${year}`, 560, 80);

    autoTable(doc, {
      startY: 94,
      head: [
        [
          "Data",
          "Entrada",
          "Int. início",
          "Int. retorno",
          "Saída",
          "Previsto",
          "Trabalhado",
          "Extra",
          "Devidas",
          "%",
          "Saldo dia",
          "Acumulado",
          "Obs.",
        ],
      ],
      body: buildRows(block.days),
      styles: { fontSize: 7.5, cellPadding: 3 },
      headStyles: { fillColor: [92, 52, 168], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 242, 250] },
      theme: "grid",
    });

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;

    autoTable(doc, {
      startY: finalY + 14,
      head: [["Resumo do mês", "Total"]],
      body: [
        ["Horas normais", formatMinutes(block.totals.regular)],
        ["Hora extra 50%", formatMinutes(block.totals.overtime50)],
        ["Hora extra 100% (feriados)", formatMinutes(block.totals.overtime100)],
        ["Horas devidas", formatMinutes(block.totals.owed)],
        ["Horas trabalhadas", formatMinutes(block.totals.worked)],
        ["Saldo do mês", formatMinutes(block.totals.balance, true)],
      ],
      styles: { fontSize: 8.5, cellPadding: 4 },
      headStyles: { fillColor: [92, 52, 168], textColor: 255 },
      theme: "grid",
      tableWidth: 300,
    });

    doc.setFontSize(7.5);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
      40,
      doc.internal.pageSize.getHeight() - 20,
    );
  });

  return doc;
}

function buildRows(days: DaySummary[]) {
  let running = 0;
  return days.map((d) => {
    running += d.balanceMinutes;
    const obs = d.isHoliday ? `Feriado: ${d.holidayName}` : d.isWeekend ? "Não útil" : "";
    return [
      isoToDisplay(d.date),
      formatTime(d.record?.clock_in),
      formatTime(d.record?.lunch_start),
      formatTime(d.record?.lunch_end),
      formatTime(d.record?.clock_out),
      formatMinutes(d.scheduledMinutes),
      formatMinutes(d.workedMinutes),
      formatMinutes(d.overtimeMinutes),
      formatMinutes(d.owedMinutes),
      d.overtime100 > 0 ? "100%" : d.overtime50 > 0 ? "50%" : "-",
      formatMinutes(d.balanceMinutes, true),
      formatMinutes(running, true),
      obs,
    ];
  });
}
