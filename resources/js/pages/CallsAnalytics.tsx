// @ts-nocheck
/* eslint-disable */
import { useState } from "react";
import { addCompanyLogo } from "./helpers";
import { DatePicker } from "./components/ui";
import "./calls-ui.css";

// ─── Colours (mirror CallsModule C object) ────────────────────────────────────
const C = {
  primary:"#1d6ef5", primaryLight:"#eef3fe",
  success:"#10b366", successLight:"#eafaf2",
  warning:"#f59e0b", warningLight:"#fffbeb",
  danger:"#ef4444",  dangerLight:"#fef2f2",
  surface:"#f8f9fb", border:"#e8eaed",
  text:"#1a1d23",    textMid:"#4b5260", textMuted:"#8b909a",
  white:"#ffffff",   purple:"#7c3aed",
  accent:"#1d6ef5",  accentLight:"#eef3fe",
};

const BANK_COLORS: { hex: string; rgb: [number, number, number] }[] = [
  { hex: "#1d6ef5", rgb: [29, 110, 245] },
  { hex: "#10b366", rgb: [16, 179, 102] },
  { hex: "#f59e0b", rgb: [245, 158, 11] },
  { hex: "#ef4444", rgb: [239, 68, 68] },
  { hex: "#7c3aed", rgb: [124, 58, 237] },
  { hex: "#0891b2", rgb: [8, 145, 178] },
  { hex: "#be185d", rgb: [190, 24, 93] },
  { hex: "#065f46", rgb: [6, 95, 70] },
];

const getBankColor = (index: number) => BANK_COLORS[index % BANK_COLORS.length];
const SLA_HOURS: Record<string, number> = { high: 2, medium: 3, low: 5 };

function formatEngineerResolutionTime(minutes: number | null) {
  return minutes == null ? "—" : `${(minutes / 60).toFixed(1)}h`;
}

const ANALYTICS_SECTIONS = [
  { id: "kpis", label: "Key Performance Indicators" },
  { id: "outcomes", label: "Outcome Breakdown & Calls by Bank" },
  { id: "callTypes", label: "Call Types & Top Pending Sites" },
  { id: "trend", label: "Call Trend" },
  { id: "prioritySla", label: "Priority & SLA Performance" },
  { id: "engineers", label: "Engineer Summary" },
  { id: "topAtms", label: "Top 5 Most Logged ATMs" },
] as const;
type AnalyticsSection = typeof ANALYTICS_SECTIONS[number]["id"];

// ─── jsPDF loader ─────────────────────────────────────────────────────────────
async function loadJsPDF() {
  if ((window as any).jspdf) return (window as any).jspdf.jsPDF;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("jsPDF load failed"));
    document.head.appendChild(s);
  });
  return (window as any).jspdf.jsPDF;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
async function exportAnalyticsPDF(
  scoped: any[],
  period: "month" | "year" | "custom",
  periodLabel: string,
  bankFilterLabel: string,
  months: { label: string; total: number; resolved: number; breached: number }[],
  engRows: {
    name: string; total: number; resolved: number; pending: number; escalated: number; other: number;
    breached: number; averageResolutionMinutes: number | null;
  }[],
  bankRows: { name: string; short_code: string; total: number; breached: number }[],
  topBreachedSites: {
    terminal_id: string; location: string; bank: string; calls: number; hoursOverSla: number; limitHours: number;
  }[],
  topPendingSites: { terminal_id: string; location: string; bank: string; pendingCalls: number; openHours: number }[],
  top5Atms: { terminal_id: string; location: string; bank: string; total: number; breached: number }[],
  stats: {
    total: number; resolved: number; pending: number; onHold: number;
    breached: number; slaMet: number;
    high: number; medium: number; low: number;
    typeNew: number; typeOld: number; typeRepeat: number;
    carriedOver: number;
  },
  selectedSections: Set<AnalyticsSection>,
  onError: (m: string) => void
) {
  if (scoped.length === 0) { onError("No data to export for this period."); return; }
  try {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const W = 210;
    const margin = 14;
    const contentWidth = W - margin * 2;
    const pageHeight = doc.internal.pageSize.getHeight();
    const contentBottom = pageHeight - 13;
    let y = 31;
    const now = new Date().toLocaleString("en-GB");
    await addCompanyLogo(doc, margin, 4, 62, 16);
    const ensureSpace = (height: number) => {
      if (y + height <= contentBottom) return false;
      doc.addPage();
      y = 16;
      return true;
    };

    const startSection = (title: string, requiredSpace = 12) => {
      ensureSpace(requiredSpace);
      doc.setDrawColor(207, 224, 255);
      doc.setLineWidth(0.35);
      doc.line(margin, y, W - margin, y);
      y += 4;
      doc.setFontSize(7); doc.setFont("helvetica", "bold");
      doc.setTextColor(143, 166, 218);
      doc.text(title.toUpperCase(), margin, y);
      y += 6;
    };

    const fitText = (text: string, maxWidth: number) => {
      let fitted = text;
      while (fitted.length > 0 && doc.getTextWidth(fitted) > maxWidth) {
        fitted = fitted.slice(0, -1);
      }
      return fitted === text ? text : `${fitted.slice(0, -3)}...`;
    };

    // Draw donut segments with short native PDF lines rather than unsupported path APIs.
    const drawDonutSegment = (
      cx: number, cy: number, r: number, stroke: number,
      startAngle: number, endAngle: number,
      rgb: [number, number, number]
    ) => {
      if (endAngle - startAngle < 0.001) return;
      const steps = Math.max(2, Math.ceil((endAngle - startAngle) * r / 1.2));
      doc.setDrawColor(...rgb);
      doc.setLineWidth(stroke);
      for (let i = 0; i < steps; i++) {
        const a0 = startAngle + (endAngle - startAngle) * (i / steps);
        const a1 = startAngle + (endAngle - startAngle) * ((i + 1) / steps);
        doc.line(
          cx + r * Math.cos(a0), cy + r * Math.sin(a0),
          cx + r * Math.cos(a1), cy + r * Math.sin(a1),
        );
      }
    };

    const drawDonut = (
      cx: number, cy: number, r: number, stroke: number,
      segments: { value: number; rgb: [number,number,number]; label: string }[],
      title: string, centerLabel: string, centerSub: string, showLegend = true
    ) => {
      const total = segments.reduce((s, x) => s + x.value, 0);

      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 29, 35);
      doc.text(title, cx - r - stroke / 2, cy - r - stroke / 2 - 2);

      if (total === 0) {
        doc.setDrawColor(232, 234, 237);
        doc.setLineWidth(stroke);
        doc.circle(cx, cy, r - stroke / 2, "S");
      } else {
        let angle = -Math.PI / 2;
        const gap = 0.03;
        segments.forEach(seg => {
          if (seg.value === 0) return;
          const sweep = (seg.value / total) * (2 * Math.PI) - gap;
          drawDonutSegment(cx, cy, r, stroke, angle + gap / 2, angle + gap / 2 + sweep, seg.rgb);
          angle += (seg.value / total) * (2 * Math.PI);
        });
      }

      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 29, 35);
      doc.text(centerLabel, cx, cy - 1.5, { align: "center" });
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
      doc.setTextColor(139, 144, 154);
      doc.text(centerSub, cx, cy + 3.5, { align: "center" });

      if (showLegend) {
        const legendY = cy + r + stroke / 2 + 4;
        const dotR = 1.5;
        let lx = cx - r - stroke / 2;
        segments.forEach(seg => {
          doc.setFillColor(...seg.rgb);
          doc.circle(lx + dotR, legendY, dotR, "F");
          doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
          doc.setTextColor(74, 82, 96);
          doc.text(`${seg.label} ${seg.value}`, lx + dotR * 2 + 1.5, legendY + 1.5);
          lx += dotR * 2 + 1.5 + doc.getTextWidth(`${seg.label} ${seg.value}`) + 4;
        });
      }
    };

    doc.setTextColor(26, 29, 35);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("Calls Analytics Report", W - margin, 8, { align: "right" });
    doc.setFontSize(7.5); doc.setFont("helvetica", "normal");
    const reportDetails = `Generated: ${now} · Period: ${periodLabel}${bankFilterLabel ? " · Bank: " + bankFilterLabel : ""}`;
    doc.text(reportDetails, W - margin, 14, { align: "right", maxWidth: 112 });
    doc.text(`Total: ${stats.total} calls · Open carryover: ${stats.carriedOver}`, W - margin, 21, { align: "right" });
    doc.setDrawColor(29, 110, 245);
    doc.setLineWidth(0.7);
    doc.line(margin, 26, W - margin, 26);

    if (selectedSections.has("kpis")) {
      startSection("Key Performance Indicators", 29);

      const statCards = [
        { label: "Total Calls",   value: stats.total,    r:29,  g:110, b:245 },
        { label: "Resolved",      value: stats.resolved, r:16,  g:179, b:102 },
        { label: "Open / Active", value: stats.pending,  r:245, g:158, b:11  },
        { label: "SLA Breached",  value: stats.breached, r:239, g:68,  b:68  },
        { label: "SLA Met",       value: stats.slaMet,   r:16,  g:179, b:102 },
        { label: "On Hold",       value: stats.onHold,   r:124, g:58,  b:237 },
      ];
      const cardGap = 1.5;
      const cardW = (contentWidth - cardGap * (statCards.length - 1)) / statCards.length;
      const cardY = y;
      statCards.forEach(({ label, value, r, g, b }, i) => {
        const x = margin + i * (cardW + cardGap);
        doc.setDrawColor(r, g, b);
        doc.setLineWidth(0.35);
        doc.setFillColor(255, 255, 255);
        doc.roundedRect(x, cardY, cardW, 13, 1.2, 1.2, "FD");
        doc.setTextColor(r, g, b);
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        doc.text(String(value), x + cardW / 2, cardY + 5.3, { align: "center" });
        doc.setTextColor(74, 82, 96);
        doc.setFontSize(4.5); doc.setFont("helvetica", "normal");
        doc.text(label, x + cardW / 2, cardY + 10, { align: "center", maxWidth: cardW - 1 });
      });
      y += 18;
    }

    if (selectedSections.has("outcomes")) {
    startSection("Outcome Breakdown & Calls by Bank", 60);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 82, 96);
    doc.text("Calls per Bank", 105, y);
    y += 4;
    const statusChartY = y + 15;
    drawDonut(
      49, statusChartY, 10, 4.5,
      [
        { value: stats.resolved, rgb: [16,179,102], label: "Resolved" },
        { value: stats.pending - stats.onHold, rgb: [245,158,11], label: "Active" },
        { value: stats.onHold, rgb: [124,58,237], label: "On Hold" },
      ],
      "Status", String(stats.total), "calls"
    );
    const maxBankTotal = Math.max(...bankRows.map(bank => bank.total), 1);
    const bankX = 105;
    const bankBarWidth = W - margin - bankX;
    bankRows.forEach((bank, index) => {
      if (ensureSpace(7)) {
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.setTextColor(74, 82, 96);
        doc.text("Calls per Bank (continued)", bankX, y);
        y += 5;
      }
      const rowY = y;
      doc.setFontSize(5.8); doc.setFont("helvetica", "bold");
      doc.setTextColor(74, 82, 96);
      doc.text(bank.short_code, bankX, rowY + 2.5);
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
      doc.text(String(bank.total), W - margin, rowY + 2.5, { align: "right" });
      doc.setFillColor(232, 234, 237);
      doc.roundedRect(bankX, rowY + 3.5, bankBarWidth, 2.5, 1, 1, "F");
      doc.setFillColor(...getBankColor(index).rgb);
      doc.roundedRect(bankX, rowY + 3.5, bankBarWidth * bank.total / maxBankTotal, 2.5, 1, 1, "F");
      y += 8;
    });
    y = Math.max(y, statusChartY + 24) + 3;
    }

    if (selectedSections.has("callTypes")) {
    startSection("Call Types & Top 5 Pending Sites", 70);
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 82, 96);
    doc.text("Top Pending Sites (open time)", 105, y);
    const typeChartY = y + 15;
    drawDonut(
      49, typeChartY, 10, 4.5,
      [
        { value: stats.typeNew, rgb: [29,110,245], label: "New" },
        { value: stats.typeOld, rgb: [245,158,11], label: "Old" },
        { value: stats.typeRepeat, rgb: [239,68,68], label: "Repeat" },
      ],
      "Call Type", String(stats.typeNew + stats.typeOld + stats.typeRepeat), "calls"
    );
    const maxPendingHours = Math.max(...topPendingSites.map(site => site.openHours), 1);
    const pendingX = 105;
    const pendingBarWidth = W - margin - pendingX - 10;
    const formatOpenTime = (hours: number) => hours > 24
      ? `${(hours / 24).toFixed(1)} days`
      : hours < 1 ? "<1 hour" : `${Math.floor(hours)} hours`;
    if (topPendingSites.length === 0) {
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.setTextColor(139, 144, 154);
      doc.text("No pending sites", pendingX, typeChartY + 2);
    }
    topPendingSites.forEach((site, index) => {
      const rowY = typeChartY - 5 + index * 9;
      const label = `${site.terminal_id}${site.location ? ` · ${site.location}` : ""}`;
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
      doc.setTextColor(74, 82, 96);
      let displayLabel = label;
      const labelMaxWidth = pendingBarWidth - 19;
      while (displayLabel && doc.getTextWidth(displayLabel) > labelMaxWidth) {
        displayLabel = displayLabel.slice(0, -1);
      }
      if (displayLabel !== label) displayLabel = `${displayLabel.slice(0, -3)}...`;
      doc.text(displayLabel, pendingX, rowY + 1.5);
      doc.setFontSize(5.2); doc.setFont("helvetica", "bold");
      doc.setTextColor(217, 45, 45);
      doc.text(
        `${formatOpenTime(site.openHours)} · ${site.pendingCalls} ${site.pendingCalls === 1 ? "call" : "calls"}`,
        W - margin, rowY + 1.5, { align: "right" },
      );
      doc.setFillColor(232, 239, 249);
      doc.roundedRect(pendingX, rowY + 3, pendingBarWidth, 3.5, 1, 1, "F");
      doc.setFillColor(217, 45, 45);
      doc.roundedRect(pendingX, rowY + 3, pendingBarWidth * site.openHours / maxPendingHours, 3.5, 1, 1, "F");
    });
    y = Math.max(y, typeChartY + Math.max(24, topPendingSites.length * 9 - 5)) + 3;
    }

    if (selectedSections.has("trend")) {
    startSection("Call Trend", 51);
    const chartX = margin;
    const chartWidth = contentWidth;
    const chartTop = y + 2;
    const chartHeight = 29;
    const chartBottom = chartTop + chartHeight;
    const maxTrendTotal = Math.max(...months.map(month => month.total), 1);
    const trendBarWidth = chartWidth / Math.max(months.length, 1);
    const legend = [
      { label: "Total", rgb: [29,110,245] as [number,number,number] },
      { label: "Resolved", rgb: [16,179,102] as [number,number,number] },
      { label: "Breached", rgb: [239,68,68] as [number,number,number] },
    ];
    let legendX = W - margin;
    [...legend].reverse().forEach(({ label, rgb }) => {
      doc.setFontSize(5); doc.setFont("helvetica", "normal");
      legendX -= doc.getTextWidth(label);
      doc.setTextColor(74, 82, 96);
      doc.text(label, legendX, y);
      legendX -= 4;
      doc.setFillColor(...rgb);
      doc.rect(legendX, y - 2, 2.5, 2.5, "F");
      legendX -= 4;
    });
    months.forEach((month, index) => {
      const barX = chartX + index * trendBarWidth + trendBarWidth * 0.15;
      const barW = Math.max(trendBarWidth * 0.7, 0.5);
      const totalHeight = (month.total / maxTrendTotal) * chartHeight;
      doc.setFillColor(245, 246, 248);
      doc.rect(barX, chartTop, barW, chartHeight, "F");
      if (month.total > 0) {
        doc.setFillColor(226, 235, 254);
        doc.rect(barX, chartBottom - totalHeight, barW, totalHeight, "F");
        if (month.resolved > 0) {
          const resolvedHeight = (month.resolved / maxTrendTotal) * chartHeight;
          doc.setFillColor(16, 179, 102);
          doc.rect(barX, chartBottom - resolvedHeight, barW, resolvedHeight, "F");
        }
        if (month.breached > 0) {
          const breachedHeight = (month.breached / maxTrendTotal) * chartHeight;
          doc.setFillColor(239, 68, 68);
          doc.rect(barX, chartBottom - totalHeight, barW, breachedHeight, "F");
        }
      }
      doc.setFontSize(4.5); doc.setFont("helvetica", "normal");
      doc.setTextColor(139, 144, 154);
      doc.text(month.label, barX + barW / 2, chartBottom + 4, { align: "center", angle: 45 });
    });
    doc.setDrawColor(232, 234, 237);
    doc.setLineWidth(0.3);
    doc.line(chartX, chartBottom, chartX + chartWidth, chartBottom);
    y = chartBottom + 9;
    }

    if (selectedSections.has("prioritySla")) {
    startSection("SLA Compliance & Top Breached Sites", 92);
    const slaPct = stats.resolved > 0 ? `${Math.round((stats.slaMet / stats.resolved) * 100)}%` : "—";
    const sectionTop = y;
    doc.setFontSize(7); doc.setFont("helvetica", "bold");
    doc.setTextColor(26, 29, 35);
    doc.text("Priority", 24, sectionTop);
    doc.text("SLA Compliance", 66, sectionTop);
    const siteX = 111;
    const siteWidth = W - margin - siteX;
    doc.text("Top Breached Sites (hours over SLA)", siteX, sectionTop);
    const qualityY = sectionTop + 30;
    drawDonut(
      42, qualityY, 13, 6,
      [
        { value: stats.high, rgb: [239,68,68], label: "High" },
        { value: stats.medium, rgb: [245,158,11], label: "Medium" },
        { value: stats.low, rgb: [16,179,102], label: "Low" },
      ],
      "", String(stats.total), "calls", false
    );
    drawDonut(
      83, qualityY, 13, 6,
      [
        { value: stats.slaMet, rgb: [16,179,102], label: "Compliant" },
        { value: Math.max(stats.resolved - stats.slaMet, 0), rgb: [239,68,68], label: "Breached" },
      ],
      "", slaPct, "compliant", false
    );
    const drawCompactLegend = (
      x: number,
      startY: number,
      items: { label: string; value: number; rgb: [number, number, number] }[],
    ) => {
      items.forEach((item, index) => {
        const itemY = startY + index * 5.5;
        doc.setFillColor(...item.rgb);
        doc.circle(x + 1.2, itemY - 1, 1.2, "F");
        doc.setFontSize(6); doc.setFont("helvetica", "normal");
        doc.setTextColor(74, 82, 96);
        doc.text(`${item.label} ${item.value}`, x + 4, itemY);
      });
    };
    drawCompactLegend(24, sectionTop + 56, [
      { label: "High", value: stats.high, rgb: [239,68,68] },
      { label: "Medium", value: stats.medium, rgb: [245,158,11] },
      { label: "Low", value: stats.low, rgb: [16,179,102] },
    ]);
    drawCompactLegend(66, sectionTop + 56, [
      { label: "Compliant", value: stats.slaMet, rgb: [16,179,102] },
      { label: "Breached", value: Math.max(stats.resolved - stats.slaMet, 0), rgb: [239,68,68] },
    ]);
    const maxOverSlaHours = Math.max(...topBreachedSites.map(site => site.hoursOverSla), 1);
    let siteY = sectionTop + 10;
    if (topBreachedSites.length === 0) {
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.setTextColor(139, 144, 154);
      doc.text("No breached sites in this period", siteX, siteY + 5);
    } else {
      topBreachedSites.slice(0, 5).forEach(site => {
        const rowY = siteY;
        const siteLabel = `${site.bank} - ${site.terminal_id}${site.location ? ` ${site.location}` : ""}`;
        doc.setFontSize(6); doc.setFont("helvetica", "normal");
        doc.setTextColor(74, 82, 96);
        doc.text(fitText(siteLabel, siteWidth * 0.58), siteX, rowY + 2.5);
        doc.setFontSize(5.5);
        doc.text(
          `${site.hoursOverSla.toFixed(1)}h (limit ${site.limitHours}h)`,
          siteX + siteWidth, rowY + 2.5, { align: "right" },
        );
        doc.setFillColor(232, 234, 237);
        doc.roundedRect(siteX, rowY + 4, siteWidth, 2.2, 0.8, 0.8, "F");
        doc.setFillColor(217, 45, 45);
        doc.roundedRect(
          siteX, rowY + 4, siteWidth * site.hoursOverSla / maxOverSlaHours, 2.2, 0.8, 0.8, "F",
        );
        siteY += 11.5;
      });
    }
    y = Math.max(siteY + 2, sectionTop + 70) + 2;
    }

    if (selectedSections.has("engineers") && engRows.length > 0) {
      startSection("Engineer Performance", 90);
      const chartGap = 4;
      const chartWidth = (contentWidth - chartGap * 2) / 3;
      const chartX = (index: number) => margin + index * (chartWidth + chartGap);
      const drawLegendItem = (
        x: number,
        label: string,
        rgb: [number, number, number],
      ) => {
        doc.setFillColor(...rgb);
        doc.rect(x, y - 1.6, 1.8, 1.8, "F");
        doc.setFontSize(4.5); doc.setFont("helvetica", "normal");
        doc.setTextColor(74, 82, 96);
        doc.text(label, x + 2.5, y);
        return x + 2.5 + doc.getTextWidth(label) + 2.5;
      };
      const drawEngineerHeadings = () => {
        const headings = ["Calls per Engineer", "Resolution Rate", "Avg Resolution Time"];
        headings.forEach((heading, index) => {
          doc.setFontSize(5.5); doc.setFont("helvetica", "bold");
          doc.setTextColor(74, 82, 96);
          doc.text(fitText(heading, chartWidth), chartX(index), y);
        });
        y += 4;
        let legendX = chartX(0);
        [
          { label: "Resolved", rgb: [16, 179, 102] as [number, number, number] },
          { label: "Pending", rgb: [245, 158, 11] as [number, number, number] },
          { label: "Escalated", rgb: [239, 68, 68] as [number, number, number] },
          { label: "Other", rgb: [124, 58, 237] as [number, number, number] },
        ].forEach(item => {
          legendX = drawLegendItem(legendX, item.label, item.rgb);
        });

        drawLegendItem(chartX(1), "Resolved / total · share of resolutions", [16, 179, 102]);

        let timeLegendX = chartX(2);
        timeLegendX = drawLegendItem(timeLegendX, "≤3h", [16, 179, 102]);
        timeLegendX = drawLegendItem(timeLegendX, "≤8h", [245, 158, 11]);
        drawLegendItem(timeLegendX, ">8h", [239, 68, 68]);
        y += 5;
      };
      const maxEngineerTotal = Math.max(...engRows.map(engineer => engineer.total), 1);
      const maxResolutionHours = Math.max(
        ...engRows.map(engineer => (engineer.averageResolutionMinutes ?? 0) / 60),
        1,
      );
      drawEngineerHeadings();
      engRows.forEach((engineer, index) => {
        if (ensureSpace(14)) {
          doc.setFontSize(7); doc.setFont("helvetica", "bold");
          doc.setTextColor(74, 82, 96);
          doc.text("Engineer Performance (continued)", margin, y);
          y += 5;
          drawEngineerHeadings();
        }
        const rowY = y;
        const statusX = chartX(0);
        doc.setFontSize(5); doc.setFont("helvetica", "normal");
        doc.setTextColor(26, 29, 35);
        doc.text(fitText(engineer.name, chartWidth - 10), statusX, rowY + 2);
        doc.text(String(engineer.total), statusX + chartWidth, rowY + 2, { align: "right" });
        doc.setFillColor(232, 234, 237);
        doc.roundedRect(statusX, rowY + 3, chartWidth, 2.2, 0.8, 0.8, "F");
        let segmentX = statusX;
        [
          { value: engineer.resolved, rgb: [16, 179, 102] as [number, number, number] },
          { value: engineer.pending, rgb: [245, 158, 11] as [number, number, number] },
          { value: engineer.escalated, rgb: [239, 68, 68] as [number, number, number] },
          { value: engineer.other, rgb: [124, 58, 237] as [number, number, number] },
        ].forEach(segment => {
          if (segment.value === 0) return;
          const segmentWidth = chartWidth * segment.value / maxEngineerTotal;
          doc.setFillColor(...segment.rgb);
          doc.rect(segmentX, rowY + 3, segmentWidth, 2.2, "F");
          segmentX += segmentWidth;
        });

        const rateX = chartX(1);
        const resolutionRate = engineer.total > 0 ? engineer.resolved / engineer.total : 0;
        const resolutionShare = stats.resolved > 0 ? engineer.resolved / stats.resolved : 0;
        doc.setTextColor(26, 29, 35);
        doc.text(fitText(engineer.name, chartWidth * 0.48), rateX, rowY + 2);
        doc.text(
          `${Math.round(resolutionRate * 100)}% · ${Math.round(resolutionShare * 100)}% share`,
          rateX + chartWidth, rowY + 2, { align: "right" },
        );
        doc.setFillColor(232, 234, 237);
        doc.roundedRect(rateX, rowY + 3, chartWidth, 2.2, 0.8, 0.8, "F");
        doc.setFillColor(16, 179, 102);
        doc.roundedRect(rateX, rowY + 3, chartWidth * resolutionRate, 2.2, 0.8, 0.8, "F");

        const timeX = chartX(2);
        const averageHours = (engineer.averageResolutionMinutes ?? 0) / 60;
        const timeColor: [number, number, number] = averageHours <= 3
          ? [16, 179, 102]
          : averageHours <= 8 ? [245, 158, 11] : [239, 68, 68];
        doc.setTextColor(26, 29, 35);
        doc.text(fitText(engineer.name, chartWidth * 0.55), timeX, rowY + 2);
        doc.text(formatEngineerResolutionTime(engineer.averageResolutionMinutes), timeX + chartWidth, rowY + 2, { align: "right" });
        doc.setFillColor(232, 234, 237);
        doc.roundedRect(timeX, rowY + 3, chartWidth, 2.2, 0.8, 0.8, "F");
        if (engineer.averageResolutionMinutes != null) {
          doc.setFillColor(...timeColor);
          doc.roundedRect(
            timeX, rowY + 3, chartWidth * averageHours / maxResolutionHours, 2.2, 0.8, 0.8, "F",
          );
        }
        y += 8;
      });
      y += 2;
    }

    if (selectedSections.has("topAtms")) {
    startSection("Top 5 Most Logged ATMs", 22);
    if (top5Atms.length > 0) {
      const maxAtmTotal = Math.max(...top5Atms.map(a => a.total), 1);
      top5Atms.forEach((a, i) => {
        if (ensureSpace(9)) {
          doc.setFontSize(8); doc.setFont("helvetica", "bold");
          doc.setTextColor(74, 82, 96);
          doc.text("Top 5 Most Logged ATMs (continued)", margin, y); y += 5;
        }
        const rowY      = y;
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.setTextColor(29, 110, 245);
        const atmName = `${i + 1}. ${a.terminal_id}`;
        doc.text(fitText(atmName, 43), margin, rowY + 3);
        doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
        doc.setTextColor(139, 144, 154);
        doc.text(fitText(`${a.location} · ${a.bank}`, 112), margin + 46, rowY + 3);
        doc.setFontSize(6); doc.setFont("helvetica", "bold");
        doc.setTextColor(29, 110, 245);
        doc.text(String(a.total), W - margin, rowY + 3, { align: "right" });
        doc.setFillColor(232, 234, 237);
        doc.roundedRect(margin, rowY + 5, contentWidth, 2.5, 1, 1, "F");
        doc.setFillColor(29, 110, 245);
        doc.roundedRect(margin, rowY + 5, contentWidth * a.total / maxAtmTotal, 2.5, 1, 1, "F");
        y += 9;
      });
    }
    }

    const pages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(`Techmasters Zambia · Page ${p} of ${pages}`, W / 2, pageHeight - 6, { align: "center" });
    }

    const slug = periodLabel.replace(/\s+/g, "-").toLowerCase();
    doc.save(`calls-analytics-${slug}.pdf`);
  } catch (e: any) {
    onError(e.message ?? "Export failed.");
  }
}


// ─── Donut SVG ────────────────────────────────────────────────────────────────
function Donut({ segments, size = 110, stroke = 22, label, sub }: {
  segments: { value: number; color: string }[];
  size?: number; stroke?: number; label: string | number; sub: string;
}) {
  const r    = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const tot  = segments.reduce((s, x) => s + x.value, 0) || 1;
  let offset = 0;
  const cx = size / 2, cy = size / 2;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {tot === 0
        ? <circle cx={cx} cy={cy} r={r} fill="none" stroke="#e8eaed" strokeWidth={stroke} />
        : segments.map((seg, i) => {
            const dash = (seg.value / tot) * circ;
            const gap  = circ - dash;
            const el = (
              <circle key={i} cx={cx} cy={cy} r={r} fill="none"
                stroke={seg.color} strokeWidth={stroke}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
                transform={`rotate(-90 ${cx} ${cy})`}
              />
            );
            offset += dash;
            return el;
          })
      }
      <text x={cx} y={cy - 6} textAnchor="middle" fontSize={size * 0.17}
        fontWeight="700" fill="#1a1d23" fontFamily="inherit">{label}</text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={size * 0.09}
        fill="#8b909a" fontFamily="inherit">{sub}</text>
    </svg>
  );
}

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ label, value, color, bg, icon }: any) {
  return (
    <div style={{ background: bg, borderRadius: 14, padding: "16px 20px",
      display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ fontSize: 24 }}>{icon}</div>
      <div>
        <div style={{ fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 12, color, opacity: 0.8, marginTop: 3, fontWeight: 600 }}>{label}</div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CallsAnalytics({ calls, banks = [] }: { calls: any[]; banks?: any[] }) {
  const [period, setPeriod]       = useState<"month" | "year" | "custom">("month");
  const [customFrom, setCustomFrom] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customTo, setCustomTo] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  });
  const [bankFilter, setBankFilter] = useState<string>("");
  const [selectedSections, setSelectedSections] = useState<Set<AnalyticsSection>>(
    () => new Set(ANALYTICS_SECTIONS.map(({ id }) => id))
  );
  const [exporting, setExporting]   = useState(false);
  const [exportError, setExportError] = useState("");
  const now = new Date();
  const dateInputValue = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const rangeFrom = period === "custom"
    ? customFrom
    : dateInputValue(period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1) : new Date(now.getFullYear(), 0, 1));
  const rangeTo = period === "custom"
    ? customTo
    : dateInputValue(now);
  const validDateRange = Boolean(rangeFrom && rangeTo && rangeFrom <= rangeTo);
  const dateKey = (date: Date) => dateInputValue(date);
  const isCreatedInRange = (call: any) => {
    if (!call.created_at) return false;
    const createdAt = new Date(call.created_at);
    if (Number.isNaN(createdAt.getTime())) return false;
    const createdDate = dateKey(createdAt);
    return createdDate >= rangeFrom && createdDate <= rangeTo;
  };

  // ── Scoped calls ────────────────────────────────────────────────────────────
  const scoped = validDateRange ? calls.filter(c => {
    const isOpen = c.status !== "resolved";
    if (!isCreatedInRange(c) && !isOpen) return false;
    if (bankFilter && c.atm?.bank?.short_code !== bankFilter) return false;
    return true;
  }) : [];
  const carriedOver = scoped.filter(c => c.status !== "resolved" && !isCreatedInRange(c)).length;

  // ── Derived counts ───────────────────────────────────────────────────────────
  const total    = scoped.length;
  const resolved = scoped.filter(c => c.status === "resolved").length;
  const onHold   = scoped.filter(c => c.status === "on_hold").length;
  const pending  = scoped.filter(c => c.status !== "resolved").length;
  const breached = scoped.filter(c => c.sla_breached).length;
  const slaMet   = scoped.filter(c => c.status === "resolved" && !c.sla_breached).length;
  const high     = scoped.filter(c => c.priority === "high").length;
  const medium   = scoped.filter(c => c.priority === "medium").length;
  const low      = scoped.filter(c => c.priority === "low").length;
  const typeNew    = scoped.filter(c => c.call_type === "new").length;
  const typeOld    = scoped.filter(c => c.call_type === "old").length;
  const typeRepeat = scoped.filter(c => c.call_type === "repeat").length;

  const stats = { total, resolved, pending, onHold, breached, slaMet, high, medium, low, typeNew, typeOld, typeRepeat, carriedOver };

  // ── Trend over the selected date range ──────────────────────────────────────
  const months: { label: string; total: number; resolved: number; breached: number }[] = [];
  const firstRangeDate = validDateRange ? new Date(`${rangeFrom}T00:00:00`) : null;
  const lastRangeDate = validDateRange ? new Date(`${rangeTo}T00:00:00`) : null;
  const monthCount = firstRangeDate && lastRangeDate
    ? (lastRangeDate.getFullYear() - firstRangeDate.getFullYear()) * 12 + lastRangeDate.getMonth() - firstRangeDate.getMonth() + 1
    : 0;
  const trendUnit: "day" | "month" | "year" = period === "month" ? "day" : monthCount <= 12 ? "month" : "year";
  const firstTrendDate = firstRangeDate
    ? new Date(firstRangeDate.getFullYear(), trendUnit === "year" ? 0 : firstRangeDate.getMonth(), 1)
    : null;
  const lastTrendDate = lastRangeDate
    ? new Date(
      lastRangeDate.getFullYear(),
      trendUnit === "year" ? 11 : lastRangeDate.getMonth() + (trendUnit === "day" ? 1 : 0),
      trendUnit === "day" ? 0 : 1,
    )
    : null;
  for (
    let d = firstTrendDate;
    d && lastTrendDate && d <= lastTrendDate;
    d = trendUnit === "day"
      ? new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1)
      : new Date(trendUnit === "month" ? d.getFullYear() : d.getFullYear() + 1, trendUnit === "month" ? d.getMonth() + 1 : 0, 1)
  ) {
    const label = trendUnit === "day"
      ? String(d.getDate())
      : d.toLocaleDateString("en-GB", trendUnit === "month"
        ? { month: "short", year: "2-digit" }
        : { year: "numeric" });
    const inMonth = scoped.filter(c => {
      const cd = new Date(c.created_at);
      return trendUnit === "day"
        ? dateKey(cd) === dateKey(d)
        : trendUnit === "month"
          ? cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth()
          : cd.getFullYear() === d.getFullYear();
    });
    months.push({
      label,
      total:    inMonth.length,
      resolved: inMonth.filter(c => c.status === "resolved").length,
      breached: inMonth.filter(c => c.sla_breached).length,
    });
  }
  const maxBar = Math.max(...months.map(m => m.total), 1);

  // ── Engineer leaderboard ─────────────────────────────────────────────────────
  const engMap: Record<string, {
    total: number; resolved: number; pending: number; escalated: number; other: number; breached: number;
    resolutionTimeTotalMs: number; resolutionTimeCount: number;
  }> = {};
  scoped.forEach(c => {
    const name = c.engineer?.name ?? "Unassigned";
    if (!engMap[name]) engMap[name] = {
      total: 0, resolved: 0, pending: 0, escalated: 0, other: 0, breached: 0,
      resolutionTimeTotalMs: 0, resolutionTimeCount: 0,
    };
    engMap[name].total++;
    if (c.status === "resolved") {
      engMap[name].resolved++;
      const createdAt = new Date(c.created_at).getTime();
      const resolvedAt = new Date(c.resolved_at ?? c.closed_at).getTime();
      if (Number.isFinite(createdAt) && Number.isFinite(resolvedAt) && resolvedAt >= createdAt) {
        engMap[name].resolutionTimeTotalMs += resolvedAt - createdAt;
        engMap[name].resolutionTimeCount++;
      }
    } else if (c.status === "pending") {
      engMap[name].pending++;
    } else if (c.status === "escalated") {
      engMap[name].escalated++;
    } else {
      engMap[name].other++;
    }
    if (c.sla_breached) engMap[name].breached++;
  });
  const engRows = Object.entries(engMap)
    .map(([name, v]) => ({
      name, ...v,
      averageResolutionMinutes: v.resolutionTimeCount > 0
        ? v.resolutionTimeTotalMs / v.resolutionTimeCount / (60 * 1000)
        : null,
    }))
    .sort((a, b) => b.total - a.total);
  const maxEng = Math.max(...engRows.map(e => e.total), 1);
  const maxResolutionHours = Math.max(
    ...engRows.map(e => (e.averageResolutionMinutes ?? 0) / 60),
    1,
  );

  // ── Calls per bank ──────────────────────────────────────────────────────────
  const bankMap: Record<string, { name: string; short_code: string; total: number; breached: number }> = {};
  scoped.forEach(c => {
    const sc   = c.atm?.bank?.short_code ?? "Unknown";
    const name = c.atm?.bank?.name       ?? "Unknown";
    if (!bankMap[sc]) bankMap[sc] = { name, short_code: sc, total: 0, breached: 0 };
    bankMap[sc].total++;
    if (c.sla_breached) bankMap[sc].breached++;
  });
  const bankRows = Object.values(bankMap).sort((a, b) => b.total - a.total);
  const maxBank  = Math.max(...bankRows.map(b => b.total), 1);

  // ── Top 5 ATMs by call volume ────────────────────────────────────────────────
  const atmMap: Record<string, { terminal_id: string; location: string; bank: string; total: number; breached: number }> = {};
  scoped.forEach(c => {
    const tid = c.atm?.terminal_id ?? "Unknown";
    if (!atmMap[tid]) atmMap[tid] = {
      terminal_id: tid,
      location: c.atm?.location ?? "",
      bank: c.atm?.bank?.short_code ?? "",
      total: 0, breached: 0,
    };
    atmMap[tid].total++;
    if (c.sla_breached) atmMap[tid].breached++;
  });
  const top5Atms = Object.values(atmMap).sort((a, b) => b.total - a.total).slice(0, 5);
  const maxAtm   = Math.max(...top5Atms.map(a => a.total), 1);

  // Rank open sites by the age of their oldest unresolved call.
  const pendingSiteMap: Record<string, {
    terminal_id: string; location: string; bank: string; pendingCalls: number; oldestCreatedAt: number;
  }> = {};
  scoped.forEach(call => {
    if (call.status === "resolved" || !call.created_at) return;
    const createdAt = new Date(call.created_at).getTime();
    if (Number.isNaN(createdAt)) return;
    const terminalId = call.atm?.terminal_id ?? "Unknown";
    const location = call.atm?.location ?? "";
    const bank = call.atm?.bank?.short_code ?? "";
    const siteKey = String(call.atm?.id ?? `${terminalId}|${location}|${bank}`);
    if (!pendingSiteMap[siteKey]) {
      pendingSiteMap[siteKey] = {
        terminal_id: terminalId, location, bank, pendingCalls: 0, oldestCreatedAt: createdAt,
      };
    }
    pendingSiteMap[siteKey].pendingCalls++;
    pendingSiteMap[siteKey].oldestCreatedAt = Math.min(pendingSiteMap[siteKey].oldestCreatedAt, createdAt);
  });
  const topPendingSites = Object.values(pendingSiteMap)
    .map(({ oldestCreatedAt, ...site }) => ({
      ...site,
      openHours: Math.max(0, (now.getTime() - oldestCreatedAt) / (60 * 60 * 1000)),
    }))
    .sort((a, b) => b.openHours - a.openHours)
    .slice(0, 5);

  const breachedSiteMap: Record<string, {
    terminal_id: string; location: string; bank: string; calls: number; hoursOverSla: number; limitHours: number;
  }> = {};
  scoped.forEach(call => {
    if (!call.sla_breached || !call.created_at) return;
    const createdAt = new Date(call.created_at).getTime();
    if (!Number.isFinite(createdAt)) return;
    const priority = typeof call.priority === "string" && Object.prototype.hasOwnProperty.call(SLA_HOURS, call.priority)
      ? call.priority
      : "medium";
    const limitHours = SLA_HOURS[priority];
    const isResolved = call.status === "resolved";
    const endTime = isResolved
      ? new Date(call.resolved_at ?? call.closed_at ?? call.updated_at).getTime()
      : now.getTime();
    if (!Number.isFinite(endTime) || endTime <= createdAt + limitHours * 60 * 60 * 1000) return;

    const terminalId = call.atm?.terminal_id ?? "Unknown";
    const location = call.atm?.location ?? "";
    const bank = call.atm?.bank?.short_code ?? "";
    const siteKey = `${call.atm?.id ?? terminalId}|${priority}`;
    if (!breachedSiteMap[siteKey]) {
      breachedSiteMap[siteKey] = {
        terminal_id: terminalId, location, bank, calls: 0, hoursOverSla: 0, limitHours,
      };
    }
    breachedSiteMap[siteKey].calls++;
    breachedSiteMap[siteKey].hoursOverSla += Math.max(
      0,
      (endTime - createdAt - limitHours * 60 * 60 * 1000) / (60 * 60 * 1000),
    );
  });
  const topBreachedSites = Object.values(breachedSiteMap)
    .sort((a, b) => b.hoursOverSla - a.hoursOverSla)
    .slice(0, 5);
  const maxBreachedSiteHours = Math.max(...topBreachedSites.map(site => site.hoursOverSla), 1);

  const formatRangeDate = (date: string) => {
    if (!date) return "Select date";
    return new Date(`${date}T00:00:00`).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };
  const periodLabel = period === "month"
    ? now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : period === "year"
      ? String(now.getFullYear())
      : `${formatRangeDate(rangeFrom)} – ${formatRangeDate(rangeTo)}`;

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    const bankFilterLabel = bankFilter
      ? (banks.find((b: any) => (b.short_code ?? b.shortCode) === bankFilter)?.name ?? bankFilter)
      : "";
    await exportAnalyticsPDF(
      scoped, period, periodLabel, bankFilterLabel,
      months, engRows, bankRows, topBreachedSites, topPendingSites, top5Atms, stats, selectedSections, setExportError
    );
    setExporting(false);
  };

  return (
    <div className="calls-analytics">

      {/* Toolbar — period + bank filter + export */}
      <div className="calls-analytics-toolbar">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div className="calls-analytics-summary">
            Showing: <span style={{ color: C.text, fontWeight: 700 }}>{periodLabel}</span>
            {bankFilter && <span style={{ color: C.accent }}> · {bankFilter}</span>}
            <span style={{ color: C.textMuted }}> · {total} call{total !== 1 ? "s" : ""}</span>
            {carriedOver > 0 && (
              <span style={{ color: C.warning }}> · {carriedOver} open from earlier dates</span>
            )}
          </div>
        </div>
        <div className="calls-analytics-controls">
          {/* Period toggle */}
          <div className="calls-period-toggle">
            {(["month", "year", "custom"] as const).map(p => (
              <button key={p} className={`calls-period-button${period===p?" is-active":""}`} onClick={() => setPeriod(p)} style={{
                padding: "6px 12px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                background: period === p ? C.primary : "transparent",
                color: period === p ? "#fff" : C.textMid,
              }}>{p === "month" ? "This Month" : p === "year" ? "This Year" : "Custom Range"}</button>
            ))}
          </div>
          {period === "custom" && (
            <div className="calls-custom-range">
              <div className="calls-date-field">
                <label htmlFor="analytics-date-from">From</label>
                <DatePicker id="analytics-date-from" ariaLabel="From date" value={customFrom} max={customTo || undefined}
                  onChange={setCustomFrom} className="calls-control" />
              </div>
              <div className="calls-date-field">
                <label htmlFor="analytics-date-to">To</label>
                <DatePicker id="analytics-date-to" ariaLabel="To date" value={customTo} min={customFrom || undefined}
                  onChange={setCustomTo} className="calls-control" />
              </div>
            </div>
          )}
          {/* Bank filter */}
          {banks.length > 0 && (
            <select className="calls-control calls-bank-filter" value={bankFilter} onChange={e => setBankFilter(e.target.value)} style={{
              padding: "7px 12px", borderRadius: 10, fontSize: 12, fontFamily: "inherit",
              border: `1px solid ${bankFilter ? C.accent : C.border}`,
              color: bankFilter ? C.accent : C.textMid,
              fontWeight: bankFilter ? 700 : 500,
              background: bankFilter ? C.accentLight : C.surface,
              cursor: "pointer", outline: "none",
            }}>
              <option value="">All Banks</option>
              {banks.map((b: any) => (
                <option key={b.id} value={b.short_code ?? b.shortCode}>{b.name}</option>
              ))}
            </select>
          )}
          <details className="calls-export-sections">
            <summary>
              Report sections ({selectedSections.size}/{ANALYTICS_SECTIONS.length})
            </summary>
            <div className="calls-export-sections-menu">
              <label className="calls-export-section-option">
                <input
                  type="checkbox"
                  checked={selectedSections.size === ANALYTICS_SECTIONS.length}
                  onChange={event => setSelectedSections(
                    event.target.checked
                      ? new Set(ANALYTICS_SECTIONS.map(({ id }) => id))
                      : new Set()
                  )}
                />
                <span>Select all sections</span>
              </label>
              <div className="calls-export-sections-divider" />
              {ANALYTICS_SECTIONS.map(({ id, label }) => (
                <label key={id} className="calls-export-section-option">
                  <input
                    type="checkbox"
                    checked={selectedSections.has(id)}
                    onChange={event => setSelectedSections(current => {
                      const next = new Set(current);
                      if (event.target.checked) next.add(id);
                      else next.delete(id);
                      return next;
                    })}
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
          </details>
          {/* Export */}
          <button className="calls-action-button calls-action-button--primary" onClick={handleExport} disabled={exporting || total === 0 || selectedSections.size === 0} style={{
            background: exporting ? C.surface : C.primary,
            color: exporting ? C.textMuted : "#fff",
            border: `1px solid ${exporting || selectedSections.size === 0 ? C.border : C.primary}`,
            borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 700,
            fontFamily: "inherit", cursor: exporting || total === 0 || selectedSections.size === 0 ? "not-allowed" : "pointer",
            opacity: total === 0 || selectedSections.size === 0 ? 0.5 : 1,
          }}>
            {exporting ? "⏳ Generating…" : "📥 Download PDF"}
          </button>
        </div>
      </div>

      {!validDateRange && (
        <div style={{ background: C.dangerLight, border: "1px solid #fecaca", borderRadius: 10,
          padding: "10px 14px", fontSize: 13, color: C.danger, fontWeight: 600, marginBottom: 16 }}>
          Choose a valid date range with the start date on or before the end date.
        </div>
      )}

      {exportError && (
        <div style={{ background: C.dangerLight, border: `1px solid #fecaca`, borderRadius: 10,
          padding: "10px 14px", fontSize: 13, color: C.danger, fontWeight: 600, marginBottom: 16 }}>
          ⚠ {exportError}
        </div>
      )}

      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))",
        gap: 10, marginBottom: 20 }}>
        <StatCard label="Total Calls"   value={total}    color={C.accent}   bg={C.accentLight}   icon="📞" />
        <StatCard label="Resolved"      value={resolved} color={C.success}  bg={C.successLight}  icon="✅" />
        <StatCard label="Open / Active" value={pending}  color={C.warning}  bg={C.warningLight}  icon="⏳" />
        <StatCard label="SLA Breached"  value={breached} color={C.danger}   bg={C.dangerLight}   icon="🔴" />
        <StatCard label="SLA Met"       value={slaMet}   color={C.success}  bg={C.successLight}  icon="🟢" />
      </div>

      {/* SLA compliance, priority, and most-breached sites */}
      <div className="calls-sla-overview">
        <section className="calls-sla-card">
          <div className="calls-sla-card__heading">
            <h3>Priority</h3>
            <p>{total} calls</p>
          </div>
          <div className="calls-sla-donut">
            <Donut size={104} stroke={19} label={total} sub="calls" segments={[
              { value: high, color: C.danger },
              { value: medium, color: C.warning },
              { value: low, color: C.success },
            ]} />
            <div className="calls-sla-legend">
              {[
                { label: "High", value: high, color: C.danger },
                { label: "Medium", value: medium, color: C.warning },
                { label: "Low", value: low, color: C.success },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <span><i style={{ background: color }} />{label}</span>
                  <b style={{ color }}>{value}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="calls-sla-card">
          <div className="calls-sla-card__heading">
            <h3>SLA Compliance</h3>
            <p>{resolved} resolved calls measured</p>
          </div>
          <div className="calls-sla-donut">
            <Donut
              size={104}
              stroke={19}
              label={resolved > 0 ? `${Math.round((slaMet / resolved) * 100)}%` : "—"}
              sub="compliant"
              segments={[
                { value: slaMet, color: C.success },
                { value: Math.max(resolved - slaMet, 0), color: C.danger },
              ]}
            />
            <div className="calls-sla-legend">
              {[
                { label: "Compliant", value: slaMet, color: C.success },
                { label: "Breached", value: Math.max(resolved - slaMet, 0), color: C.danger },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <span><i style={{ background: color }} />{label}</span>
                  <b style={{ color }}>{value}</b>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="calls-sla-card calls-sla-sites">
          <div className="calls-sla-card__heading">
            <h3>Top Breached Sites</h3>
            <p>Accumulated hours over the priority SLA limit</p>
          </div>
          {topBreachedSites.length === 0 ? (
            <div className="calls-sla-sites__empty">No breached sites in this period</div>
          ) : (
            <div className="calls-sla-sites__list">
              {topBreachedSites.map(site => {
                return (
                  <div className="calls-sla-site" key={`${site.terminal_id}-${site.limitHours}`}>
                    <div className="calls-sla-site__label">
                      <span title={`${site.bank} · ${site.terminal_id} · ${site.location}`}>
                        {site.bank ? `${site.bank} · ` : ""}{site.terminal_id}{site.location ? ` ${site.location}` : ""}
                      </span>
                      <b>{site.hoursOverSla.toFixed(1)}h <small>(limit {site.limitHours}h)</small></b>
                    </div>
                    <div className="calls-sla-site__track">
                      <span
                        role="progressbar"
                        aria-label={`${site.terminal_id} accumulated hours over SLA`}
                        aria-valuenow={Math.round(site.hoursOverSla)}
                        aria-valuemin={0}
                        aria-valuemax={Math.ceil(maxBreachedSiteHours)}
                        style={{ width: `${(site.hoursOverSla / maxBreachedSiteHours) * 100}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* Call type + selected-range trend */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 20 }}>

        {/* Call type */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Call Type</div>
          {[
            { label: "New",    value: typeNew,    color: C.accent  },
            { label: "Old",    value: typeOld,    color: C.warning },
            { label: "Repeat", value: typeRepeat, color: C.danger  },
          ].map(({ label, value, color }) => {
            const pct = total > 0 ? (value / total) * 100 : 0;
            return (
              <div key={label} style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 5 }}>
                  <span style={{ color: C.textMid, fontWeight: 600 }}>{label}</span>
                  <span style={{ color, fontWeight: 700 }}>{value}</span>
                </div>
                <div style={{ background: C.surface, borderRadius: 6, height: 8, overflow: "hidden" }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Selected-range bar chart */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>
              {trendUnit === "day" ? "Daily Trend" : trendUnit === "month" ? "Monthly Trend" : "Yearly Trend"}
            </div>
            <div style={{ display: "flex", gap: 12, fontSize: 11 }}>
              {[{ label: "Total", color: C.accent }, { label: "Resolved", color: C.success }, { label: "Breached", color: C.danger }]
                .map(({ label, color }) => (
                  <span key={label} style={{ display: "flex", alignItems: "center", gap: 4, color: C.textMid }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: "inline-block" }} />
                    {label}
                  </span>
                ))}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 130 }}>
            {months.map(m => (
              <div key={m.label} style={{ flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                <div style={{ width: "100%", display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "flex-end", flex: 1 }}>
                  <div style={{
                    width: "60%", position: "relative",
                    height: `${Math.max((m.total / maxBar) * 100, m.total > 0 ? 4 : 0)}%`,
                    background: C.accentLight, borderRadius: "4px 4px 0 0",
                    border: `1.5px solid ${C.accent}`, overflow: "hidden",
                  }}>
                    {m.resolved > 0 && (
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0,
                        height: `${(m.resolved / m.total) * 100}%`,
                        background: C.success, opacity: 0.7 }} />
                    )}
                    {m.breached > 0 && (
                      <div style={{ position: "absolute", top: 0, left: 0, right: 0,
                        height: `${(m.breached / m.total) * 100}%`,
                        background: C.danger, opacity: 0.6, borderRadius: "4px 4px 0 0" }} />
                    )}
                  </div>
                </div>
                <div style={{ fontSize: 10, color: C.textMuted, textAlign: "center",
                  fontWeight: 500, whiteSpace: "nowrap" }}>{m.label}</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{m.total}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Engineer performance */}
      {engRows.length > 0 && (
        <div className="engineer-performance">
          <div className="engineer-performance__heading">Engineer Performance</div>
          <div className="engineer-performance__charts">
            <section className="engineer-chart-card">
              <div className="engineer-chart-card__heading">
                <h3>Calls per Engineer</h3>
                <div className="engineer-chart-legend">
                  {[
                    { label: "Resolved", color: C.success },
                    { label: "Pending", color: C.warning },
                    { label: "Escalated", color: C.danger },
                    { label: "Other", color: C.purple },
                  ].map(({ label, color }) => (
                    <span key={label}>
                      <i style={{ background: color }} />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
              <div className="engineer-chart-list">
                {engRows.map(e => {
                  const segments = [
                    { label: "Resolved", value: e.resolved, color: C.success },
                    { label: "Pending", value: e.pending, color: C.warning },
                    { label: "Escalated", value: e.escalated, color: C.danger },
                    { label: "Other", value: e.other, color: C.purple },
                  ];
                  return (
                    <div className="engineer-chart-row" key={e.name}>
                      <div className="engineer-chart-row__label">
                        <span title={e.name}>{e.name}</span>
                        <b>{e.total}</b>
                      </div>
                      <div
                        className="engineer-progress-track engineer-progress-track--stacked"
                        role="progressbar"
                        aria-label={`${e.name} calls by status`}
                        aria-valuenow={e.total}
                        aria-valuemin={0}
                        aria-valuemax={maxEng}
                      >
                        {segments.map(({ label, value, color }) => value > 0 && (
                          <span
                            key={label}
                            title={`${label}: ${value}`}
                            aria-hidden="true"
                            style={{ width: `${(value / maxEng) * 100}%`, background: color }}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="engineer-chart-card">
              <div className="engineer-chart-card__heading">
                <h3>Resolution Rate</h3>
                <p>Resolved / total · share of resolutions</p>
              </div>
              <div className="engineer-chart-list">
                {engRows.map(e => {
                  const rate = e.total > 0 ? (e.resolved / e.total) * 100 : 0;
                  const share = resolved > 0 ? Math.round((e.resolved / resolved) * 100) : 0;
                  return (
                    <div className="engineer-chart-row" key={e.name}>
                      <div className="engineer-chart-row__label">
                        <span title={e.name}>{e.name}</span>
                        <b>{Math.round(rate)}% <small>{share}% share</small></b>
                      </div>
                      <div
                        className="engineer-progress-track"
                        role="progressbar"
                        aria-label={`${e.name} resolution rate`}
                        aria-valuenow={Math.round(rate)}
                        aria-valuemin={0}
                        aria-valuemax={100}
                      >
                        <span style={{ width: `${rate}%`, background: C.success }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="engineer-chart-card">
              <div className="engineer-chart-card__heading">
                <h3>Avg Resolution Time</h3>
                <p><span className="engineer-time-key engineer-time-key--fast" /> ≤3h
                  <span className="engineer-time-key engineer-time-key--medium" /> ≤8h
                  <span className="engineer-time-key engineer-time-key--slow" /> &gt;8h
                </p>
              </div>
              <div className="engineer-chart-list">
                {engRows.map(e => {
                  const hours = (e.averageResolutionMinutes ?? 0) / 60;
                  const color = hours <= 3 ? C.success : hours <= 8 ? C.warning : C.danger;
                  const durationLabel = formatEngineerResolutionTime(e.averageResolutionMinutes);
                  return (
                    <div className="engineer-chart-row" key={e.name}>
                      <div className="engineer-chart-row__label">
                        <span title={e.name}>{e.name}</span>
                        <b>{durationLabel}</b>
                      </div>
                      {e.averageResolutionMinutes == null ? (
                        <div
                          className="engineer-progress-track"
                          role="img"
                          aria-label={`${e.name}: no resolved call times recorded`}
                        />
                      ) : (
                        <div
                          className="engineer-progress-track"
                          role="progressbar"
                          aria-label={`${e.name} average resolution time`}
                          aria-valuenow={Number(hours.toFixed(1))}
                          aria-valuemin={0}
                          aria-valuemax={maxResolutionHours}
                        >
                          <span style={{ width: `${(hours / maxResolutionHours) * 100}%`, background: color }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        </div>
      )}

      {/* Calls per bank + Top 5 ATMs */}
      {(bankRows.length > 0 || top5Atms.length > 0) && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginTop: 12 }}>

          {/* Calls per bank */}
          {bankRows.length > 0 && (
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Calls per Bank</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {bankRows.map((b, i) => {
                  const pct     = (b.total / maxBank) * 100;
                  const color   = getBankColor(i).hex;
                  const bPct    = b.total > 0 ? Math.round((b.breached / b.total) * 100) : 0;
                  return (
                    <div key={b.short_code}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                          <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.text }}>{b.short_code}</span>
                          <span style={{ fontSize: 11, color: C.textMuted }}>{b.name}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {b.breached > 0 && <span style={{ fontSize: 10, color: C.danger, fontWeight: 700 }}>⚠ {bPct}% breach</span>}
                          <span style={{ fontSize: 13, fontWeight: 800, color }}>{b.total}</span>
                        </div>
                      </div>
                      <div style={{ background: C.surface, borderRadius: 6, height: 8, overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 6, transition: "width .4s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Top 5 ATMs by call volume */}
          {top5Atms.length > 0 && (
            <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Top 5 Most Logged ATMs</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {top5Atms.map((a, i) => {
                  const pct   = (a.total / maxAtm) * 100;
                  const bPct  = a.total > 0 ? Math.round((a.breached / a.total) * 100) : 0;
                  const medal = ["🥇","🥈","🥉","4️⃣","5️⃣"][i];
                  return (
                    <div key={a.terminal_id}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 5 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <span style={{ fontSize: 14 }}>{medal}</span>
                          <div>
                            <div style={{ fontSize: 12, fontWeight: 700, color: C.text, fontFamily: "monospace" }}>{a.terminal_id}</div>
                            <div style={{ fontSize: 10, color: C.textMuted }}>{a.location} · {a.bank}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {a.breached > 0 && <span style={{ fontSize: 10, color: C.danger, fontWeight: 700 }}>⚠ {bPct}%</span>}
                          <span style={{ fontSize: 13, fontWeight: 800, color: C.accent }}>{a.total}</span>
                        </div>
                      </div>
                      <div style={{ background: C.surface, borderRadius: 6, height: 7, overflow: "hidden" }}>
                        <div style={{
                          width: `${pct}%`, height: "100%", borderRadius: 6, transition: "width .4s ease",
                          background: `linear-gradient(90deg, ${C.accent}, #60a5fa)`,
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {total === 0 && (
        <div style={{ textAlign: "center", padding: "48px 24px", color: C.textMuted }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 15, fontWeight: 600 }}>No calls logged for this period</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>
            Switch to "This Year" or log some calls to see analytics.
          </div>
        </div>
      )}
    </div>
  );
}
