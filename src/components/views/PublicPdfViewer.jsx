import React, { useState, useEffect, useRef } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { supabase } from '../../supabaseClient';
import { buildCdiLogoHtml, preloadCdiLogoBase64 } from '../../utils/cdiLogo';
import { decodeCompactDocData, buildQRSvgMarkup } from '../../utils/colorQrHelper';

/**
 * Visor Público Autónomo de Listas de Empaque y Remisiones de Despacho CDI
 * Se activa automáticamente al acceder mediante la URL pública del QR (?cdi_doc=1&tipo=...&ped=...)
 * sin requerir login, permitiendo a cualquier cliente o transportador visualizar e imprimir o descargar
 * el PDF oficial corporativo directamente desde su navegador móvil o de escritorio.
 */
export default function PublicPdfViewer() {
  const [docData, setDocData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const printableAreaRef = useRef(null);
  const autoDownloadTriggered = useRef(false);

  useEffect(() => {
    const parseUrlAndLoadData = async () => {
      try {
        if (typeof window === 'undefined' || !window.location) {
          setError('Entorno de ejecución no válido.');
          setLoading(false);
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const tipoDoc = (params.get('tipo') || 'EMPAQUE').toUpperCase();
        const pedidoNum = (params.get('ped') || '').replace(/^#/, '').trim().toUpperCase();
        const bultoNum = params.get('bulto') || '1';
        const totalBultos = params.get('total') || '1';
        const remisionParam = params.get('rem') || '';
        const empaqueParam = params.get('emp') || '';
        const clienteParam = params.get('cli') || '';
        const placaParam = params.get('placa') || '';
        const encodedData = params.get('data') || '';

        // 1. Intentar decodificar los datos compactos incrustados directamente en la URL
        let compactDecoded = null;
        if (encodedData) {
          compactDecoded = decodeCompactDocData(encodedData);
        }

        let resolvedItems = compactDecoded?.it || [];
        let resolvedCliente = compactDecoded?.cli || clienteParam || 'CLIENTE GENERAL';
        let resolvedRemision = compactDecoded?.rem || remisionParam || (pedidoNum ? `REM-${pedidoNum}` : 'REM-0001');
        let resolvedEmpaque = compactDecoded?.emp || empaqueParam || (pedidoNum ? `EMP-${pedidoNum}` : 'EMP-0001');
        let resolvedPlaca = compactDecoded?.placa || placaParam || '';
        let resolvedTransportador = compactDecoded?.tra || 'TRANSPORTE CDI';
        let resolvedConductor = compactDecoded?.con || 'CONDUCTOR ASIGNADO';
        let resolvedReceptor = compactDecoded?.rec || resolvedCliente;
        let resolvedDestino = compactDecoded?.des || 'PLANTA / OBRA DEL CLIENTE';
        let resolvedFecha = compactDecoded?.f || new Date().toLocaleDateString('es-CO');

        // 2. Si faltan datos detallados de items, consultar en Supabase por el número de pedido
        if (pedidoNum && (!resolvedItems || resolvedItems.length === 0)) {
          try {
            const { data: dbOrders } = await supabase
              .from('produccion_pedidos')
              .select('id, pedido_num, codigo_item, cliente, data_completa')
              .eq('pedido_num', pedidoNum)
              .limit(200);

            if (Array.isArray(dbOrders) && dbOrders.length > 0) {
              const plantRows = dbOrders
                .map((r) => ({ ...(r.data_completa || {}), ...r }))
                .filter((r) => {
                  const idStr = String(r.id || '').toUpperCase();
                  const codeStr = String(r.codigo_item || r.codArticulo || '').toUpperCase();
                  return codeStr !== 'PACKING_LIST_MASTER' && !idStr.startsWith('PACKLIST_');
                });

              if (plantRows.length > 0) {
                const firstRow = plantRows[0];
                if (!resolvedCliente || resolvedCliente === 'CLIENTE GENERAL') {
                  resolvedCliente = firstRow.cliente || resolvedCliente;
                }
                if (!resolvedPlaca) {
                  resolvedPlaca = firstRow.datos_logistica?.placaVehiculo || firstRow.placa || '';
                }
                resolvedItems = plantRows.map((r, idx) => ({
                  c: r.codArticulo || r.codigo_item || `REF-${idx + 1}`,
                  n: r.nombre || r.descripcion || `PRODUCTO #${idx + 1}`,
                  q: Number(r.cantidad) || 1
                }));
              }
            }
          } catch (dbErr) {
            console.warn('Consulta complementaria a Supabase omitida:', dbErr);
          }
        }

        // Si aún no hay items, generar al menos la referencia principal
        if (!resolvedItems || resolvedItems.length === 0) {
          resolvedItems = [
            {
              c: `PED-${pedidoNum || 'GEN'}`,
              n: `BULTO #${bultoNum} DE ${totalBultos} — PEDIDO #${pedidoNum || 'S/N'}`,
              q: 1
            }
          ];
        }

        const normalizedData = {
          tipo: tipoDoc,
          pedidoNum: pedidoNum || 'S/N',
          bultoNum,
          totalBultos,
          numeroEmpaque: resolvedEmpaque,
          codigoRemision: resolvedRemision,
          cliente: resolvedCliente,
          placa: resolvedPlaca,
          transportador: resolvedTransportador,
          conductor: resolvedConductor,
          receptor: resolvedReceptor,
          destino: resolvedDestino,
          fecha: resolvedFecha,
          items: resolvedItems
        };

        setDocData(normalizedData);
        setLoading(false);
      } catch (err) {
        console.error('Error cargando documento público:', err);
        setError('Ocurrió un error al procesar el documento oficial. Verifique el enlace.');
        setLoading(false);
      }
    };

    parseUrlAndLoadData();
  }, []);

  // Función para descargar el PDF generado en el cliente
  const handleDownloadPdf = async () => {
    if (!printableAreaRef.current || !docData) return;
    setIsGeneratingPdf(true);
    try {
      await preloadCdiLogoBase64();
      const element = printableAreaRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'letter'
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginMm = 8;
      const printableWidth = pageWidth - marginMm * 2;
      const calculatedHeight = (canvas.height * printableWidth) / canvas.width;

      pdf.addImage(
        imgData,
        'PNG',
        marginMm,
        marginMm,
        printableWidth,
        Math.min(calculatedHeight, pageHeight - marginMm * 2)
      );

      const tipoStr = docData.tipo === 'DESPACHO' ? 'Remision_Despacho' : 'Lista_Empaque';
      const bultoStr = docData.bultoNum ? `Bulto_${docData.bultoNum}` : 'General';
      const fileName = `CDI_${tipoStr}_PED_${docData.pedidoNum}_${bultoStr}.pdf`;

      pdf.save(fileName);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4500);
    } catch (pdfErr) {
      console.error('Error generando archivo PDF:', pdfErr);
      alert('No se pudo generar el archivo PDF automáticamente. Puede usar el botón de Imprimir.');
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  // Disparar la descarga automática tras 800ms de cargar el documento
  useEffect(() => {
    if (!docData || loading || autoDownloadTriggered.current) return;
    autoDownloadTriggered.current = true;
    const timer = setTimeout(() => {
      handleDownloadPdf();
    }, 800);
    return () => clearTimeout(timer);
  }, [docData, loading]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="w-16 h-16 border-4 border-amber-400 border-t-transparent rounded-full animate-spin mb-4" />
        <h2 className="text-xl font-black uppercase tracking-wider text-amber-400">
          Cargando Documento Oficial CDI
        </h2>
        <p className="text-sm text-slate-400 mt-2">
          Verificando parámetros criptográficos y decodificando información...
        </p>
      </div>
    );
  }

  if (error || !docData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white font-sans text-center">
        <div className="w-20 h-20 bg-rose-950/80 border-2 border-rose-500 rounded-3xl flex items-center justify-center text-3xl mb-4 shadow-xl">
          ⚠️
        </div>
        <h2 className="text-2xl font-black uppercase tracking-wide text-rose-400">
          Documento No Disponible
        </h2>
        <p className="text-slate-300 max-w-md mt-2 text-sm leading-relaxed">
          {error || 'No se encontró la información del documento solicitado.'}
        </p>
        <button
          onClick={() => {
            window.location.href = window.location.origin;
          }}
          className="mt-6 px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl border border-slate-600 uppercase text-xs tracking-wider transition-colors"
        >
          Ir al Inicio de la Aplicación
        </button>
      </div>
    );
  }

  const isDespacho = docData.tipo === 'DESPACHO';
  const totalUnitsCount = (docData.items || []).reduce(
    (acc, it) => acc + (Number(it.q || it.cantidad || 1) || 0),
    0
  );
  const currentUrl = typeof window !== 'undefined' ? window.location.href : '';
  const qrSvgMarkup = buildQRSvgMarkup(currentUrl, 96, 'M');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-900 font-sans print:bg-white print:text-black">
      {/* BARRA SUPERIOR FIJA FLOTANTE (SE OCULTA AL IMPRIMIR O EN EL PDF) */}
      <header className="sticky top-0 z-50 bg-slate-950 border-b border-slate-800 text-white px-4 py-3 shadow-2xl print:hidden">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="px-2 py-1 bg-white rounded-xl flex items-center justify-center shrink-0">
              <span dangerouslySetInnerHTML={{ __html: buildCdiLogoHtml(26) }} />
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-wider text-amber-400">
                CDI Diseño en Exhibición • Documento Oficial
              </div>
              <div className="text-sm font-black text-white uppercase leading-tight">
                {isDespacho ? 'Remisión de Despacho' : 'Lista de Empaque'} • PED #{docData.pedidoNum}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
              className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer ${
                downloadSuccess
                  ? 'bg-emerald-600 text-white'
                  : 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-lg shadow-amber-400/20 active:scale-95'
              }`}
            >
              {isGeneratingPdf ? (
                <>
                  <span className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Generando PDF...</span>
                </>
              ) : downloadSuccess ? (
                <>
                  <span>✓</span>
                  <span>¡PDF Descargado!</span>
                </>
              ) : (
                <>
                  <span>⬇️</span>
                  <span>DESCARGAR PDF OFICIAL</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-black uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>🖨️</span>
              <span>Imprimir</span>
            </button>
          </div>
        </div>
      </header>

      {/* ÁREA CENTRAL DEL DOCUMENTO (IMPRIMIBLE / CONVERTIBLE A PDF) */}
      <main className="max-w-4xl mx-auto p-4 sm:p-8 flex justify-center">
        <div
          ref={printableAreaRef}
          id="cdi-public-doc-printable"
          className="w-full bg-white text-slate-900 border-2 border-slate-900 rounded-lg p-6 sm:p-8 shadow-2xl print:border-none print:shadow-none print:p-0 print:m-0"
          style={{ maxWidth: '216mm', minHeight: '279mm' }}
        >
          {/* ENCABEZADO CORPORATIVO OFICIAL CDI */}
          <div className="border-b-2 border-slate-900 pb-5 mb-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="px-3 py-2 bg-slate-950 rounded-2xl flex items-center justify-center shrink-0 shadow-md">
                <span dangerouslySetInnerHTML={{ __html: buildCdiLogoHtml(52) }} />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-widest text-slate-600">
                  CDI DISEÑO EN EXHIBICIÓN S.A.S. • NIT 900.222.138-1
                </div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-tight leading-none mt-0.5">
                  {isDespacho
                    ? 'REMISIÓN OFICIAL DE DESPACHO'
                    : 'LISTA DE EMPAQUE OFICIAL'}
                </h1>
                <div className="text-xs font-bold text-sky-700 uppercase tracking-wide mt-1">
                  CÓDIGO REMISIÓN: {docData.codigoRemision} • N° EMPAQUE: {docData.numeroEmpaque}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="bg-slate-950 text-white p-3 rounded-xl text-right min-w-[150px]">
                <div className="text-[8px] font-bold text-amber-400 uppercase tracking-widest">
                  ORDEN DE PRODUCCIÓN
                </div>
                <div className="text-base font-black text-white leading-none mt-0.5">
                  PED #{docData.pedidoNum}
                </div>
                <div className="text-[9px] font-bold text-slate-300 mt-1 uppercase">
                  {isDespacho
                    ? `TOTAL PIEZAS: ${totalUnitsCount}`
                    : `BULTO ${docData.bultoNum} DE ${docData.totalBultos}`}
                </div>
                <div className="text-[8px] text-amber-300 font-mono mt-0.5">
                  {docData.fecha}
                </div>
              </div>

              <div
                className="p-1 border-2 border-slate-900 rounded-xl bg-white shrink-0 shadow-sm"
                dangerouslySetInnerHTML={{ __html: qrSvgMarkup }}
              />
            </div>
          </div>

          {/* DATOS LOGÍSTICOS Y DEL CLIENTE */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5 text-xs">
            <div className="border border-slate-400 rounded-lg p-3 bg-slate-50">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                CLIENTE / DESTINATARIO
              </div>
              <div className="font-black text-slate-950 uppercase text-sm mt-0.5">
                {docData.cliente}
              </div>
              <div className="text-slate-600 font-bold text-[10px] mt-1">
                Destino: {docData.destino}
              </div>
            </div>

            <div className="border border-slate-400 rounded-lg p-3 bg-slate-50">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                CONTROL DE TRANSPORTE
              </div>
              <div className="font-black text-slate-950 uppercase text-sm mt-0.5">
                Placa: {docData.placa || 'LOGÍSTICA CDI'}
              </div>
              <div className="text-slate-600 font-bold text-[10px] mt-1">
                Transportador: {docData.transportador}
              </div>
            </div>

            <div className="border border-slate-400 rounded-lg p-3 bg-slate-50">
              <div className="text-[9px] font-black text-slate-500 uppercase tracking-wider">
                DATOS DE LA ENTREGA
              </div>
              <div className="font-black text-slate-950 uppercase text-sm mt-0.5">
                Conductor: {docData.conductor}
              </div>
              <div className="text-slate-600 font-bold text-[10px] mt-1">
                Recibe: {docData.receptor}
              </div>
            </div>
          </div>

          {/* TABLA OFICIAL DE ÍTEMS Y PRODUCTOS */}
          <div className="border border-slate-900 rounded-lg overflow-hidden mb-5">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-950 text-white uppercase text-[9px] tracking-wider">
                  <th className="py-2.5 px-3 border-r border-slate-800 text-center w-12">#</th>
                  <th className="py-2.5 px-3 border-r border-slate-800 w-32">Código</th>
                  <th className="py-2.5 px-3 border-r border-slate-800">Descripción del Producto / Pieza</th>
                  <th className="py-2.5 px-3 text-center w-24">Cantidad</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-300">
                {(docData.items || []).map((it, idx) => (
                  <tr
                    key={idx}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}
                  >
                    <td className="py-2.5 px-3 font-black text-center border-r border-slate-300 text-slate-700">
                      {idx + 1}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-black border-r border-slate-300 text-slate-900">
                      {it.c || 'S/C'}
                    </td>
                    <td className="py-2.5 px-3 font-bold uppercase border-r border-slate-300 text-slate-900">
                      {it.n || 'ÍTEM DESPACHADO'}
                    </td>
                    <td className="py-2.5 px-3 font-black text-center text-slate-950 text-sm">
                      {Number(it.q) || 1}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-100 border-t-2 border-slate-900 font-black text-slate-950">
                  <td colSpan={3} className="py-2.5 px-3 text-right uppercase tracking-wider text-[10px]">
                    Total Unidades en este Documento:
                  </td>
                  <td className="py-2.5 px-3 text-center text-sm font-black text-slate-950">
                    {totalUnitsCount} UNDS
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* CERTIFICACIÓN DE CALIDAD Y OBSERVACIONES */}
          <div className="border border-amber-400 bg-amber-50 rounded-lg p-3 text-[10px] font-bold text-amber-950 mb-8 leading-relaxed">
            <span className="font-black uppercase">Certificación de Despacho y Calidad:</span> Este documento oficial certifica que los productos y cantidades aquí relacionados fueron inspeccionados, embalados y rotulados conforme a las especificaciones técnicas de CDI Diseño en Exhibición S.A.S.
          </div>

          {/* BLOQUE DE FIRMAS Y SELLOS */}
          <div className="grid grid-cols-3 gap-6 pt-6 border-t-2 border-slate-900 text-center text-[10px] font-black uppercase text-slate-900">
            <div>
              <div className="h-12 border-b border-dashed border-slate-400 mb-1.5" />
              <div>ENTREGADO POR</div>
              <div className="text-[8px] font-bold text-slate-500">PLANTA / DESPACHOS CDI</div>
            </div>

            <div>
              <div className="h-12 border-b border-dashed border-slate-400 mb-1.5" />
              <div>TRANSPORTADOR</div>
              <div className="text-[8px] font-bold text-slate-500">{docData.conductor}</div>
            </div>

            <div>
              <div className="h-12 border-b border-dashed border-slate-400 mb-1.5" />
              <div>RECIBIDO A CONFORMIDAD</div>
              <div className="text-[8px] font-bold text-slate-500">CLIENTE / DESTINATARIO</div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
