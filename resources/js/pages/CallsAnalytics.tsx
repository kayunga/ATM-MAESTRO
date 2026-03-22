// @ts-nocheck
/* eslint-disable */
import { useState } from "react";

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

// ─── jsPDF loader ─────────────────────────────────────────────────────────────
async function loadJsPDF() {
  if ((window as any).jspdf) return (window as any).jspdf.jsPDF;
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("jsPDF load failed"));
    document.head.appendChild(s);
  });
  await new Promise<void>((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js";
    s.onload = () => res(); s.onerror = () => rej(new Error("autotable load failed"));
    document.head.appendChild(s);
  });
  return (window as any).jspdf.jsPDF;
}

// ─── PDF Export ───────────────────────────────────────────────────────────────
async function exportAnalyticsPDF(
  scoped: any[],
  allCalls: any[],
  period: "month" | "year",
  periodLabel: string,
  bankFilterLabel: string,
  months: { label: string; total: number; resolved: number; breached: number }[],
  engRows: { name: string; total: number; resolved: number; breached: number }[],
  bankRows: { name: string; short_code: string; total: number; breached: number }[],
  top5Atms: { terminal_id: string; location: string; bank: string; total: number; breached: number }[],
  stats: {
    total: number; resolved: number; pending: number; onHold: number;
    breached: number; slaMet: number;
    high: number; medium: number; low: number;
    typeNew: number; typeOld: number; typeRepeat: number;
  },
  onError: (m: string) => void
) {
  if (scoped.length === 0) { onError("No data to export for this period."); return; }
  try {
    const JsPDF = await loadJsPDF();
    const doc = new JsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    const W = 297;
    const now = new Date().toLocaleString("en-GB");

    // ── Drawing helpers ───────────────────────────────────────────────────────

    // Filled rounded rect
    const filledRounded = (x: number, y: number, w: number, h: number, r: number) => {
      r = Math.min(r, w / 2, h / 2);
      doc.moveTo(x + r, y);
      doc.lineTo(x + w - r, y);
      doc.curveTo(x + w, y, x + w, y, x + w, y + r);
      doc.lineTo(x + w, y + h - r);
      doc.curveTo(x + w, y + h, x + w, y + h, x + w - r, y + h);
      doc.lineTo(x + r, y + h);
      doc.curveTo(x, y + h, x, y + h, x, y + h - r);
      doc.lineTo(x, y + r);
      doc.curveTo(x, y, x, y, x + r, y);
      doc.close();
      doc.fill();
    };

    // Draw a donut chart using arc approximation via bezier curves
    // jsPDF does not have a native arc that takes start/end angles,
    // so we approximate each segment as a series of bezier curves.
    const drawDonutSegment = (
      cx: number, cy: number, r: number, stroke: number,
      startAngle: number, endAngle: number,
      rgb: [number, number, number]
    ) => {
      if (endAngle - startAngle < 0.001) return;
      const innerR = r - stroke;
      const steps  = Math.max(2, Math.ceil(((endAngle - startAngle) / Math.PI) * 8));
      const pts: [number, number][] = [];
      const innerPts: [number, number][] = [];
      for (let i = 0; i <= steps; i++) {
        const a = startAngle + (endAngle - startAngle) * (i / steps);
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
        innerPts.push([cx + innerR * Math.cos(a), cy + innerR * Math.sin(a)]);
      }
      doc.setFillColor(...rgb);
      doc.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i <= steps; i++) {
        const a0 = startAngle + (endAngle - startAngle) * ((i - 1) / steps);
        const a1 = startAngle + (endAngle - startAngle) * (i / steps);
        const da = a1 - a0;
        const k  = (4 / 3) * Math.tan(da / 4);
        const x1 = pts[i-1][0] - k * r * Math.sin(a0);
        const y1 = pts[i-1][1] + k * r * Math.cos(a0);
        const x2 = pts[i][0]   + k * r * Math.sin(a1);
        const y2 = pts[i][1]   - k * r * Math.cos(a1);
        doc.curveTo(x1, y1, x2, y2, pts[i][0], pts[i][1]);
      }
      doc.lineTo(innerPts[steps][0], innerPts[steps][1]);
      for (let i = steps - 1; i >= 0; i--) {
        const a0 = startAngle + (endAngle - startAngle) * ((i + 1) / steps);
        const a1 = startAngle + (endAngle - startAngle) * (i / steps);
        const da = a1 - a0;
        const k  = (4 / 3) * Math.tan(da / 4);
        const x1 = innerPts[i+1][0] - k * innerR * Math.sin(a0);
        const y1 = innerPts[i+1][1] + k * innerR * Math.cos(a0);
        const x2 = innerPts[i][0]   + k * innerR * Math.sin(a1);
        const y2 = innerPts[i][1]   - k * innerR * Math.cos(a1);
        doc.curveTo(x1, y1, x2, y2, innerPts[i][0], innerPts[i][1]);
      }
      doc.close();
      doc.fill();
    };

    // Draw a full donut chart with legend
    const drawDonut = (
      cx: number, cy: number, r: number, stroke: number,
      segments: { value: number; rgb: [number,number,number]; label: string }[],
      title: string, centerLabel: string, centerSub: string
    ) => {
      const total = segments.reduce((s, x) => s + x.value, 0);

      // Title
      doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 29, 35);
      doc.text(title, cx - r - stroke / 2, cy - r - stroke / 2 - 2);

      if (total === 0) {
        // Empty ring
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

      // Centre text
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.setTextColor(26, 29, 35);
      doc.text(centerLabel, cx, cy - 1.5, { align: "center" });
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
      doc.setTextColor(139, 144, 154);
      doc.text(centerSub, cx, cy + 3.5, { align: "center" });

      // Legend below
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
    };

    // ── Header ────────────────────────────────────────────────────────────────
    doc.setFillColor(29, 110, 245);
    doc.rect(0, 0, W, 20, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(13); doc.setFont("helvetica", "bold");
    doc.text("NCR Fleet — Calls Analytics Report", 14, 8);
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text(`Generated: ${now}   ·   Period: ${periodLabel}${bankFilterLabel ? "   ·   Bank: " + bankFilterLabel : ""}   ·   Total: ${stats.total} calls`, 14, 15);

    // ── Section 1: Summary stat cards ────────────────────────────────────────
    let y = 26;
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 82, 96);
    doc.text("Summary", 14, y); y += 4;

    const statCards = [
      { label: "Total Calls",   value: stats.total,    r:29,  g:110, b:245 },
      { label: "Resolved",      value: stats.resolved, r:16,  g:179, b:102 },
      { label: "Open / Active", value: stats.pending,  r:245, g:158, b:11  },
      { label: "SLA Breached",  value: stats.breached, r:239, g:68,  b:68  },
      { label: "SLA Met",       value: stats.slaMet,   r:16,  g:179, b:102 },
      { label: "On Hold",       value: stats.onHold,   r:124, g:58,  b:237 },
    ];
    const cW = Math.round((W - 28 - 5 * 2) / 6);
    statCards.forEach(({ label, value, r, g, b }, i) => {
      const cx = 14 + i * (cW + 2);
      doc.setFillColor(r, g, b);
      filledRounded(cx, y, cW, 14, 2.5);
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11); doc.setFont("helvetica", "bold");
      doc.text(String(value), cx + cW / 2, y + 6, { align: "center" });
      doc.setFontSize(4.5); doc.setFont("helvetica", "normal");
      doc.text(label, cx + cW / 2, y + 11, { align: "center" });
    });
    y += 18;

    // ── Section 2: Donut charts (3 side by side) ──────────────────────────────
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 82, 96);
    doc.text("Charts", 14, y); y += 2;

    const donutR     = 14;
    const donutStroke = 6;
    const donutSpacing = (W - 28) / 3;
    const donutCY    = y + donutR + donutStroke / 2 + 4;

    // Status donut
    drawDonut(
      14 + donutSpacing * 0 + donutSpacing / 2, donutCY,
      donutR, donutStroke,
      [
        { value: stats.resolved,            rgb: [16,179,102],  label: "Resolved" },
        { value: stats.pending - stats.onHold, rgb: [245,158,11], label: "Active"   },
        { value: stats.onHold,              rgb: [124,58,237],  label: "On Hold"  },
      ],
      "Status", String(stats.total), "calls"
    );

    // Priority donut
    drawDonut(
      14 + donutSpacing * 1 + donutSpacing / 2, donutCY,
      donutR, donutStroke,
      [
        { value: stats.high,   rgb: [239,68,68],   label: "High"   },
        { value: stats.medium, rgb: [245,158,11],  label: "Medium" },
        { value: stats.low,    rgb: [16,179,102],  label: "Low"    },
      ],
      "Priority", String(stats.total), "calls"
    );

    // SLA donut
    const slaPct = stats.resolved > 0
      ? Math.round((stats.slaMet / stats.resolved) * 100) + "%"
      : "—";
    drawDonut(
      14 + donutSpacing * 2 + donutSpacing / 2, donutCY,
      donutR, donutStroke,
      [
        { value: stats.slaMet,   rgb: [16,179,102],  label: "Met"      },
        { value: stats.breached, rgb: [239,68,68],   label: "Breached" },
        { value: stats.pending,  rgb: [232,234,237], label: "Open"     },
      ],
      "SLA Performance", slaPct, "met"
    );

    y = donutCY + donutR + donutStroke / 2 + 12;

    // ── Section 3: Call Type bar + 6-month bar chart side by side ─────────────
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 82, 96);

    const chartAreaY   = y;
    const leftW        = 70;
    const rightW       = W - 28 - leftW - 8;
    const barChartH    = 36;

    // --- Call Type horizontal bars ---
    doc.text("Call Type", 14, chartAreaY);
    const ctY = chartAreaY + 4;
    const ctTypes = [
      { label: "New",    value: stats.typeNew,    rgb: [29,110,245]  as [number,number,number] },
      { label: "Old",    value: stats.typeOld,    rgb: [245,158,11]  as [number,number,number] },
      { label: "Repeat", value: stats.typeRepeat, rgb: [239,68,68]   as [number,number,number] },
    ];
    const maxCT = Math.max(stats.typeNew, stats.typeOld, stats.typeRepeat, 1);
    ctTypes.forEach(({ label, value, rgb }, i) => {
      const rowY  = ctY + i * 10;
      const barW  = (value / maxCT) * (leftW - 16);
      doc.setFontSize(6); doc.setFont("helvetica", "normal");
      doc.setTextColor(74, 82, 96);
      doc.text(label, 14, rowY + 2.5);
      // Track bg
      doc.setFillColor(248, 249, 251);
      doc.rect(30, rowY - 1, leftW - 16, 5, "F");
      // Bar fill
      if (value > 0) {
        doc.setFillColor(...rgb);
        doc.rect(30, rowY - 1, barW, 5, "F");
      }
      // Value label
      doc.setFontSize(6); doc.setFont("helvetica", "bold");
      doc.setTextColor(...rgb);
      doc.text(String(value), 30 + (leftW - 16) + 2, rowY + 2.5);
    });

    // --- 6-month vertical bar chart ---
    const barX0    = 14 + leftW + 8;
    const barChartTop = chartAreaY + 4;
    const barChartBot = barChartTop + barChartH;
    const maxBar2  = Math.max(...months.map(m => m.total), 1);
    const barW2    = rightW / months.length;

    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.setTextColor(74, 82, 96);
    doc.text("6-Month Trend", barX0, chartAreaY);

    // Legend for bar chart
    const legItems = [
      { label: "Total",    rgb: [29,110,245]  as [number,number,number] },
      { label: "Resolved", rgb: [16,179,102]  as [number,number,number] },
      { label: "Breached", rgb: [239,68,68]   as [number,number,number] },
    ];
    let legX = barX0 + rightW - 2;
    [...legItems].reverse().forEach(({ label, rgb }) => {
      const tw = doc.getTextWidth(label);
      legX -= tw;
      doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
      doc.setTextColor(74, 82, 96);
      doc.text(label, legX, chartAreaY - 0.5);
      legX -= 5;
      doc.setFillColor(...rgb);
      doc.rect(legX, chartAreaY - 3.5, 3, 3, "F");
      legX -= 4;
    });

    months.forEach((m, i) => {
      const bx     = barX0 + i * barW2 + barW2 * 0.15;
      const bw     = barW2 * 0.7;
      const totalH = (m.total / maxBar2) * barChartH;

      // Background track
      doc.setFillColor(245, 246, 248);
      doc.rect(bx, barChartTop, bw, barChartH, "F");

      if (m.total > 0) {
        // Total bar (blue outline/fill)
        doc.setFillColor(29, 110, 245);
        doc.setGState(doc.GState({ opacity: 0.18 }));
        doc.rect(bx, barChartBot - totalH, bw, totalH, "F");
        doc.setGState(doc.GState({ opacity: 1 }));

        // Resolved (green, from bottom)
        if (m.resolved > 0) {
          const resH = (m.resolved / maxBar2) * barChartH;
          doc.setFillColor(16, 179, 102);
          doc.setGState(doc.GState({ opacity: 0.75 }));
          doc.rect(bx, barChartBot - resH, bw, resH, "F");
          doc.setGState(doc.GState({ opacity: 1 }));
        }

        // Breached (red, from top)
        if (m.breached > 0) {
          const brH = (m.breached / maxBar2) * barChartH;
          doc.setFillColor(239, 68, 68);
          doc.setGState(doc.GState({ opacity: 0.65 }));
          doc.rect(bx, barChartBot - totalH, bw, brH, "F");
          doc.setGState(doc.GState({ opacity: 1 }));
        }

        // Total count above bar
        doc.setFontSize(5); doc.setFont("helvetica", "bold");
        doc.setTextColor(29, 110, 245);
        doc.text(String(m.total), bx + bw / 2, barChartBot - totalH - 1.5, { align: "center" });
      }

      // Month label
      doc.setFontSize(5); doc.setFont("helvetica", "normal");
      doc.setTextColor(139, 144, 154);
      doc.text(m.label, bx + bw / 2, barChartBot + 4, { align: "center" });
    });

    // Baseline
    doc.setDrawColor(232, 234, 237);
    doc.setLineWidth(0.3);
    doc.line(barX0, barChartBot, barX0 + rightW, barChartBot);

    y = barChartBot + 10;

    // ── Section 4: Engineer summary table ────────────────────────────────────
    if (engRows.length > 0) {
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.setTextColor(74, 82, 96);
      doc.text("Engineer Summary", 14, y); y += 2;

      const engTableRows = engRows.map((e, i) => {
        const resRate    = e.total > 0 ? Math.round((e.resolved / e.total) * 100) : 0;
        const breachRate = e.total > 0 ? Math.round((e.breached / e.total) * 100) : 0;
        return [
          String(i + 1), e.name, String(e.total),
          String(e.resolved), `${resRate}%`,
          String(e.breached), `${breachRate}%`,
          String(e.total - e.resolved),
        ];
      });

      (doc as any).autoTable({
        startY: y,
        margin: { left: 14, right: 14 },
        head: [["#", "Engineer", "Total", "Resolved", "Res. %", "SLA Breached", "Breach %", "Open"]],
        body: engTableRows,
        theme: "striped",
        styles: { fontSize: 7.5, cellPadding: 2, valign: "middle", halign: "center" },
        headStyles: { fillColor: [29, 110, 245], textColor: 255, fontSize: 7, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 8,  halign: "center" },
          1: { cellWidth: 44, halign: "left", fontStyle: "bold" },
          2: { cellWidth: 16 },
          3: { cellWidth: 20, textColor: [16, 179, 102] },
          4: { cellWidth: 16, textColor: [16, 179, 102] },
          5: { cellWidth: 24, textColor: [239, 68, 68] },
          6: { cellWidth: 18, textColor: [239, 68, 68] },
          7: { cellWidth: 16, textColor: [245, 158, 11] },
        },
        alternateRowStyles: { fillColor: [248, 249, 251] },
      });
    }

    // ── Section 5: Calls per bank — horizontal bar chart ─────────────────────
    if (bankRows.length > 0) {
      y = (doc as any).lastAutoTable?.finalY ?? y;
      y += 10;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.setTextColor(74, 82, 96);
      doc.text("Calls per Bank", 14, y); y += 6;

      const BANK_COLORS: [number,number,number][] = [
        [29,110,245],[16,179,102],[245,158,11],[239,68,68],
        [124,58,237],[8,145,178],[190,24,93],[6,95,70],
      ];
      const maxBankTotal = Math.max(...bankRows.map(b => b.total), 1);
      const barAreaX  = 14;
      const labelW    = 28;   // short_code column
      const countW    = 10;   // count label on right
      const barMaxW   = W - 28 - labelW - countW - 4;
      const rowH      = 10;

      bankRows.forEach((b, i) => {
        const rgb       = BANK_COLORS[i % BANK_COLORS.length];
        const barW      = (b.total / maxBankTotal) * barMaxW;
        const breachW   = b.total > 0 ? (b.breached / b.total) * barW : 0;
        const breachPct = b.total > 0 ? Math.round((b.breached / b.total) * 100) : 0;
        const rowY      = y + i * rowH;

        // Short code label
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
        doc.setTextColor(...rgb);
        doc.text(b.short_code, barAreaX, rowY + 4);

        // Track background
        doc.setFillColor(245, 246, 248);
        doc.rect(barAreaX + labelW, rowY, barMaxW, 5.5, "F");

        // Main bar
        if (barW > 0) {
          doc.setFillColor(...rgb);
          doc.setGState((doc as any).GState({ opacity: 0.25 }));
          doc.rect(barAreaX + labelW, rowY, barW, 5.5, "F");
          doc.setGState((doc as any).GState({ opacity: 1 }));

          // Solid portion (proportional to resolved)
          const resolvedW = b.total > 0 ? ((b.total - b.breached) / b.total) * barW : barW;
          doc.setFillColor(...rgb);
          doc.rect(barAreaX + labelW, rowY, resolvedW, 5.5, "F");

          // Breach overlay (red from right side of bar)
          if (breachW > 0) {
            doc.setFillColor(239, 68, 68);
            doc.rect(barAreaX + labelW + resolvedW, rowY, breachW, 5.5, "F");
          }
        }

        // Count
        doc.setFontSize(6); doc.setFont("helvetica", "bold");
        doc.setTextColor(...rgb);
        doc.text(String(b.total), barAreaX + labelW + barMaxW + 3, rowY + 4);

        // Breach % if any
        if (b.breached > 0) {
          doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
          doc.setTextColor(239, 68, 68);
          doc.text(`⚠ ${breachPct}%`, barAreaX + labelW + barW + 14, rowY + 4);
        }
      });

      y += bankRows.length * rowH + 6;
    }

    // ── Section 6: Top 5 Most Logged ATMs — horizontal bar chart ─────────────
    if (top5Atms.length > 0) {
      y += 4;
      doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.setTextColor(74, 82, 96);
      doc.text("Top 5 Most Logged ATMs", 14, y); y += 6;

      const MEDALS = ["🥇","🥈","🥉","4 ","5 "];
      const maxAtmTotal = Math.max(...top5Atms.map(a => a.total), 1);
      const atmLabelW   = 46;  // terminal_id + bank
      const atmCountW   = 10;
      const atmBarMaxW  = W - 28 - atmLabelW - atmCountW - 4;
      const atmRowH     = 12;

      top5Atms.forEach((a, i) => {
        const barW      = (a.total / maxAtmTotal) * atmBarMaxW;
        const breachW   = a.total > 0 ? (a.breached / a.total) * barW : 0;
        const resolvedW = barW - breachW;
        const breachPct = a.total > 0 ? Math.round((a.breached / a.total) * 100) : 0;
        const rowY      = y + i * atmRowH;

        // Medal + terminal ID
        doc.setFontSize(7); doc.setFont("helvetica", "bold");
        doc.setTextColor(29, 110, 245);
        doc.text(`${i + 1}. ${a.terminal_id}`, 14, rowY + 4);

        // Location + bank (smaller, below)
        doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
        doc.setTextColor(139, 144, 154);
        const locationText = `${a.location} · ${a.bank}`;
        doc.text(locationText.slice(0, 28), 14, rowY + 8.5);

        // Track background
        doc.setFillColor(245, 246, 248);
        doc.rect(14 + atmLabelW, rowY + 1, atmBarMaxW, 6, "F");

        if (barW > 0) {
          // Resolved portion (blue gradient simulation — lighter fill)
          doc.setFillColor(29, 110, 245);
          doc.setGState((doc as any).GState({ opacity: 0.2 }));
          doc.rect(14 + atmLabelW, rowY + 1, barW, 6, "F");
          doc.setGState((doc as any).GState({ opacity: 1 }));

          // Solid resolved bar
          doc.setFillColor(29, 110, 245);
          doc.rect(14 + atmLabelW, rowY + 1, resolvedW, 6, "F");

          // Breach portion (red)
          if (breachW > 0) {
            doc.setFillColor(239, 68, 68);
            doc.rect(14 + atmLabelW + resolvedW, rowY + 1, breachW, 6, "F");
          }
        }

        // Count
        doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
        doc.setTextColor(29, 110, 245);
        doc.text(String(a.total), 14 + atmLabelW + atmBarMaxW + 3, rowY + 5.5);

        // Breach warning
        if (a.breached > 0) {
          doc.setFontSize(5.5); doc.setFont("helvetica", "normal");
          doc.setTextColor(239, 68, 68);
          doc.text(`⚠ ${breachPct}%`, 14 + atmLabelW + barW + 16, rowY + 5.5);
        }
      });

      y += top5Atms.length * atmRowH + 6;
    }

    // ── Footer ────────────────────────────────────────────────────────────────
    const pages = (doc as any).internal.getNumberOfPages();
    for (let p = 1; p <= pages; p++) {
      doc.setPage(p);
      doc.setFontSize(7); doc.setTextColor(150, 150, 150);
      doc.text(`NCR Fleet · Techmasters Zambia · Page ${p} of ${pages}`, W / 2, 204, { align: "center" });
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
  const [period, setPeriod]       = useState<"month" | "year">("month");
  const [bankFilter, setBankFilter] = useState<string>("");
  const [exporting, setExporting]   = useState(false);
  const [exportError, setExportError] = useState("");
  const now = new Date();

  // ── Scoped calls ────────────────────────────────────────────────────────────
  const scoped = calls.filter(c => {
    if (!c.created_at) return false;
    const d = new Date(c.created_at);
    const inPeriod = period === "month"
      ? d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      : d.getFullYear() === now.getFullYear();
    if (!inPeriod) return false;
    if (bankFilter && c.atm?.bank?.short_code !== bankFilter) return false;
    return true;
  });

  // ── Derived counts ───────────────────────────────────────────────────────────
  const total    = scoped.length;
  const resolved = scoped.filter(c => c.status === "resolved" || c.status === "escalated").length;
  const onHold   = scoped.filter(c => c.status === "on_hold").length;
  const pending  = scoped.filter(c => c.status === "pending" || c.status === "assigned" || c.status === "on_hold").length;
  const breached = scoped.filter(c => c.sla_breached).length;
  const slaMet   = scoped.filter(c => (c.status === "resolved" || c.status === "escalated") && !c.sla_breached).length;
  const high     = scoped.filter(c => c.priority === "high").length;
  const medium   = scoped.filter(c => c.priority === "medium").length;
  const low      = scoped.filter(c => c.priority === "low").length;
  const typeNew    = scoped.filter(c => c.call_type === "new").length;
  const typeOld    = scoped.filter(c => c.call_type === "old").length;
  const typeRepeat = scoped.filter(c => c.call_type === "repeat").length;

  const stats = { total, resolved, pending, onHold, breached, slaMet, high, medium, low, typeNew, typeOld, typeRepeat };

  // ── 6-month trend ────────────────────────────────────────────────────────────
  const months: { label: string; total: number; resolved: number; breached: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const label = d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
    const inMonth = calls.filter(c => {
      const cd = new Date(c.created_at);
      return cd.getFullYear() === d.getFullYear() && cd.getMonth() === d.getMonth();
    });
    months.push({
      label,
      total:    inMonth.length,
      resolved: inMonth.filter(c => c.status === "resolved" || c.status === "escalated").length,
      breached: inMonth.filter(c => c.sla_breached).length,
    });
  }
  const maxBar = Math.max(...months.map(m => m.total), 1);

  // ── Engineer leaderboard ─────────────────────────────────────────────────────
  const engMap: Record<string, { total: number; resolved: number; breached: number }> = {};
  scoped.forEach(c => {
    const name = c.engineer?.name ?? "Unassigned";
    if (!engMap[name]) engMap[name] = { total: 0, resolved: 0, breached: 0 };
    engMap[name].total++;
    if (c.status === "resolved" || c.status === "escalated") engMap[name].resolved++;
    if (c.sla_breached) engMap[name].breached++;
  });
  const engRows = Object.entries(engMap)
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);
  const maxEng = Math.max(...engRows.map(e => e.total), 1);

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

  // Bank colour palette (cycles)
  const BANK_COLORS = ["#1d6ef5","#10b366","#f59e0b","#ef4444","#7c3aed","#0891b2","#be185d","#065f46"];
  const getBankColor = (idx: number) => BANK_COLORS[idx % BANK_COLORS.length];

  const periodLabel = period === "month"
    ? now.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
    : String(now.getFullYear());

  const handleExport = async () => {
    setExporting(true);
    setExportError("");
    const bankFilterLabel = bankFilter
      ? (banks.find((b: any) => (b.short_code ?? b.shortCode) === bankFilter)?.name ?? bankFilter)
      : "";
    await exportAnalyticsPDF(
      scoped, calls, period, periodLabel, bankFilterLabel,
      months, engRows, bankRows, top5Atms, stats, setExportError
    );
    setExporting(false);
  };

  return (
    <div style={{ paddingTop: 4 }}>

      {/* Toolbar — period + bank filter + export */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: C.textMuted, fontWeight: 500 }}>
            Showing: <span style={{ color: C.text, fontWeight: 700 }}>{periodLabel}</span>
            {bankFilter && <span style={{ color: C.accent }}> · {bankFilter}</span>}
            <span style={{ color: C.textMuted }}> · {total} call{total !== 1 ? "s" : ""}</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Period toggle */}
          <div style={{ display: "flex", gap: 4, background: C.surface,
            borderRadius: 10, padding: 3, border: `1px solid ${C.border}` }}>
            {(["month", "year"] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: "6px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontFamily: "inherit", fontSize: 12, fontWeight: 600,
                background: period === p ? C.primary : "transparent",
                color: period === p ? "#fff" : C.textMid,
              }}>{p === "month" ? "This Month" : "This Year"}</button>
            ))}
          </div>
          {/* Bank filter */}
          {banks.length > 0 && (
            <select value={bankFilter} onChange={e => setBankFilter(e.target.value)} style={{
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
          {/* Export */}
          <button onClick={handleExport} disabled={exporting || total === 0} style={{
            background: exporting ? C.surface : C.primary,
            color: exporting ? C.textMuted : "#fff",
            border: `1px solid ${exporting ? C.border : C.primary}`,
            borderRadius: 10, padding: "7px 16px", fontSize: 12, fontWeight: 700,
            fontFamily: "inherit", cursor: exporting || total === 0 ? "not-allowed" : "pointer",
            opacity: total === 0 ? 0.5 : 1,
          }}>
            {exporting ? "⏳ Generating…" : "📥 Download PDF"}
          </button>
        </div>
      </div>

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

      {/* Donut row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 20 }}>

        {/* Status */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>Status</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Donut label={total} sub="calls" segments={[
              { value: resolved,          color: C.success },
              { value: pending - onHold,  color: C.warning },
              { value: onHold,            color: C.purple  },
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {[
                { label: "Resolved", value: resolved,         color: C.success },
                { label: "Active",   value: pending - onHold, color: C.warning },
                { label: "On Hold",  value: onHold,           color: C.purple  },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Priority */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>Priority</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Donut label={total} sub="calls" segments={[
              { value: high,   color: C.danger  },
              { value: medium, color: C.warning },
              { value: low,    color: C.success },
            ]} />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {[
                { label: "High",   value: high,   color: C.danger  },
                { label: "Medium", value: medium, color: C.warning },
                { label: "Low",    value: low,    color: C.success },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* SLA */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 14 }}>SLA Performance</div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <Donut
              label={resolved > 0 ? `${Math.round((slaMet / resolved) * 100)}%` : "—"}
              sub="met"
              segments={[
                { value: slaMet,   color: C.success  },
                { value: breached, color: C.danger   },
                { value: pending,  color: "#e8eaed"  },
              ]}
            />
            <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
              {[
                { label: "Met",      value: slaMet,   color: C.success   },
                { label: "Breached", value: breached, color: C.danger    },
                { label: "Open",     value: pending,  color: C.textMuted },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: color, flexShrink: 0 }} />
                  <span style={{ fontSize: 11, color: C.textMid, flex: 1 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Call type + 6-month trend */}
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

        {/* 6-month bar chart */}
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>6-Month Trend</div>
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

      {/* Engineer leaderboard */}
      {engRows.length > 0 && (
        <div style={{ background: C.white, borderRadius: 16, border: `1px solid ${C.border}`, padding: "18px 20px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.text, marginBottom: 16 }}>Engineer Summary</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(260px,1fr))", gap: 10 }}>
            {engRows.map(e => (
              <div key={e.name} style={{ background: C.surface, borderRadius: 12, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{e.name}</span>
                  <span style={{ fontSize: 12, fontWeight: 800, color: C.accent }}>{e.total}</span>
                </div>
                <div style={{ background: "#e8eaed", borderRadius: 4, height: 5, overflow: "hidden", marginBottom: 8 }}>
                  <div style={{ width: `${(e.total / maxEng) * 100}%`, height: "100%",
                    background: C.accent, borderRadius: 4 }} />
                </div>
                <div style={{ display: "flex", gap: 10, fontSize: 11 }}>
                  <span style={{ color: C.success, fontWeight: 600 }}>✓ {e.resolved} resolved</span>
                  {e.breached > 0 && (
                    <span style={{ color: C.danger, fontWeight: 600 }}>⚠ {e.breached} breached</span>
                  )}
                </div>
              </div>
            ))}
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
                  const color   = getBankColor(i);
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
