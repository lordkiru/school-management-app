/**
 * Prints only the HTML inside the element referenced by `ref` or by `elementId`.
 * Opens a clean new browser window containing just that content + Tailwind-friendly base styles,
 * then immediately triggers the print dialog and closes the window when done.
 *
 * Usage:
 *   import printArea from '../utils/printArea';
 *   const ref = useRef(null);
 *   <div ref={ref}> ... receipt content ... </div>
 *   <button onClick={() => printArea(ref)}>Print</button>
 */
export default function printArea(refOrId) {
  const el =
    typeof refOrId === 'string'
      ? document.getElementById(refOrId)
      : refOrId?.current;

  if (!el) {
    console.warn('printArea: element not found');
    return;
  }

  const printWindow = window.open('', '_blank', 'width=800,height=900');
  if (!printWindow) {
    // Fallback if popup blocked — just do a regular window.print()
    window.print();
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8" />
        <title>Print</title>
        <style>
          *, *::before, *::after { box-sizing: border-box; }
          body {
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
              "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 14px;
            color: #1e293b;
            margin: 0;
            padding: 24px;
          }
          table { width: 100%; border-collapse: collapse; }
          th, td { text-align: left; padding: 6px 0; }
          .text-center { text-align: center; }
          .text-right { text-align: right; }
          .font-bold { font-weight: 700; }
          .font-semibold { font-weight: 600; }
          .font-medium { font-weight: 500; }
          .text-xs { font-size: 12px; }
          .text-sm { font-size: 13px; }
          .text-xl { font-size: 20px; }
          .mb-1 { margin-bottom: 4px; }
          .mb-2 { margin-bottom: 8px; }
          .mb-6 { margin-bottom: 24px; }
          .mt-10 { margin-top: 40px; }
          .pt-6 { padding-top: 24px; }
          .pb-4 { padding-bottom: 16px; }
          .py-2 { padding-top: 8px; padding-bottom: 8px; }
          .p-8 { padding: 32px; }
          .grid { display: grid; }
          .grid-cols-2 { grid-template-columns: 1fr 1fr; }
          .gap-y-2 { row-gap: 8px; }
          .border-b { border-bottom: 1px solid #e2e8f0; }
          .border-t { border-top: 1px solid #e2e8f0; }
          .border-t-2 { border-top: 2px solid #cbd5e1; }
          .border-slate-200 { border-color: #e2e8f0; }
          .border-slate-400 { border-color: #94a3b8; }
          .text-slate-400 { color: #94a3b8; }
          .text-slate-500 { color: #64748b; }
          .text-slate-600 { color: #475569; }
          .text-slate-800 { color: #1e293b; }
          .text-emerald-600 { color: #059669; }
          .text-emerald-700 { color: #047857; }
          .text-rose-600 { color: #e11d48; }
          .text-rose-700 { color: #be123c; }
          .w-32 { width: 128px; }
          .w-full { width: 100%; }
          .h-14 { height: 56px; }
          .mx-auto { margin-left: auto; margin-right: auto; }
          .object-contain { object-fit: contain; }
          .justify-between { justify-content: space-between; }
          .items-end { align-items: flex-end; }
          .flex { display: flex; }
          .capitalize { text-transform: capitalize; }
          .align-top { vertical-align: top; }
          .last\\:border-0:last-child { border-bottom: 0; }
          /* Elements hidden on the main screen but shown in this print popup */
          .screen-hidden { display: block !important; }
          /* Delete / action buttons that should not appear on print */
          .no-print { display: none !important; }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        ${el.innerHTML}
      </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();

  // Small delay to allow images to load before printing
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 400);
}
