#!/usr/bin/env node
// Builds the "Paquete Informativo" PDF from datos.json.
//
//   node paquete/build.js
//
// 1. Checks the arithmetic in datos.json (and that index.html quotes the same headline figures).
// 2. Renders paquete/paquete.html (preview it in any browser).
// 3. Prints it to PPT_SECOYAS.pdf at the repo root with the locally installed Chrome or Edge.
// No npm install needed. Only the resulting PDF has to be uploaded to the server.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { pathToFileURL } = require('url');

const DIR = __dirname;
const RAIZ = path.join(DIR, '..');
const SALIDA_HTML = path.join(DIR, 'paquete.html');
const SALIDA_PDF = path.join(RAIZ, 'PPT_SECOYAS.pdf');

const d = JSON.parse(fs.readFileSync(path.join(DIR, 'datos.json'), 'utf8'));


// ─── Formatting (Chilean style: 1.025.000.000 and 6,3) ──────────────────────

function num(n, dec = 0) {
  const [ent, frac] = Math.abs(n).toFixed(dec).split('.');
  const agrupado = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '−' : '') + agrupado + (frac ? ',' + frac : '');
}
const decimales = n => (Number.isInteger(n) ? 0 : 1);
const clp = n => '$' + num(n);
const uf = n => 'UF\u00a0' + num(n);
const usd = n => 'US$\u00a0' + num(n);
const pct = n => num(n, decimales(n)) + '%';

function esc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}


// ─── Arithmetic checks ──────────────────────────────────────────────────────

function verificar(d) {
  const avisos = [];
  const tc = d.tipoCambio.ufEnPesos;
  const IVA = 1.19;

  function igual(valor, esperado, tolerancia, que) {
    if (Math.abs(valor - esperado) > tolerancia) {
      const redondo = Math.abs(esperado - Math.round(esperado)) < 0.005;
      avisos.push(`${que}: is ${num(valor, decimales(valor))}, expected ${num(esperado, redondo ? 0 : 2)}`);
    }
  }

  // Every { clp, uf } pair must convert at the stated UF rate.
  (function recorrer(obj, ruta) {
    if (!obj || typeof obj !== 'object') return;
    if (typeof obj.clp === 'number' && typeof obj.uf === 'number') {
      igual(obj.uf, obj.clp / tc, 1, `${ruta}.uf ($ → UF at ${clp(tc)})`);
    }
    for (const [k, v] of Object.entries(obj)) recorrer(v, ruta ? `${ruta}.${k}` : k);
  })(d, '');

  igual(d.tipoCambio.ufEnDolares, tc / d.tipoCambio.dolarEnPesos, 0.5, 'tipoCambio.ufEnDolares');

  const o = d.oferta;
  igual(o.entrada.uf + o.saldo.uf, o.valor50.uf, 0, 'oferta: entrada + saldo vs valor50 (UF)');
  igual(o.entrada.usd, o.entrada.clp / d.tipoCambio.dolarEnPesos, o.entrada.usd * 0.005, 'oferta.entrada.usd');
  igual(o.cuotaAnualUF, o.saldo.uf / o.plazoAnios, 1, 'oferta.cuotaAnualUF (saldo / plazoAnios)');
  igual(o.cuotaMensualUF, o.cuotaAnualUF / 12, 1, 'oferta.cuotaMensualUF (cuotaAnualUF / 12)');

  const s = d.ingresoSocio;
  const r = d.rentabilidad;
  for (const k of ['directores', 'utilidades', 'arriendo']) {
    igual(s[k].mensualUF, s[k].anualUF / 12, 1, `ingresoSocio.${k}.mensualUF`);
    igual(s[k].mensualCLP, (s[k].anualUF / 12) * tc, tc, `ingresoSocio.${k}.mensualCLP`);
  }
  igual(s.directores.anualUF + s.utilidades.anualUF + s.arriendo.anualUF, s.total.anualUF, 1, 'ingresoSocio.total.anualUF (sum of the three)');
  igual(s.total.mensualUF, s.total.anualUF / 12, 1, 'ingresoSocio.total.mensualUF');

  const e = d.resumen.eventos;
  igual(e.ventasBrutas.clp, e.personasAnuales * e.precioBruto, 1, 'resumen.eventos.ventasBrutas');
  igual(e.ventasNetas.clp, e.personasAnuales * e.precioNeto, 1, 'resumen.eventos.ventasNetas');
  igual(e.precioNeto, e.precioBruto / IVA, 1, 'resumen.eventos.precioNeto (precioBruto without IVA)');

  const p = d.resumen.patio;
  igual(p.ventasBrutas.clp, p.diasPorMes * 12 * p.ventaDiariaBruta, 1, 'resumen.patio.ventasBrutas (diasPorMes × 12 × ventaDiariaBruta)');
  igual(p.ventaDiariaNeta, p.ventaDiariaBruta / IVA, 1, 'resumen.patio.ventaDiariaNeta (ventaDiariaBruta without IVA)');
  igual(p.ventasNetas.clp, p.ventasBrutas.clp / IVA, 1, 'resumen.patio.ventasNetas (ventasBrutas without IVA)');

  for (const [nombre, neg] of [['eventos', e], ['patio', p]]) {
    igual(neg.costosDirectos.clp, neg.ventasNetas.clp / neg.costosDirectos.divisor, 1, `resumen.${nombre}.costosDirectos`);
    igual(neg.margenNeto.clp, neg.ventasNetas.clp - neg.costosDirectos.clp, 1, `resumen.${nombre}.margenNeto`);
    igual(neg.margenNeto.pct, (neg.margenNeto.clp / neg.ventasNetas.clp) * 100, 0.5, `resumen.${nombre}.margenNeto.pct`);
  }

  // Consolidated percentages are over net sales (without IVA), like the per-business margins above them.
  const c = d.resumen.consolidado;
  const netos = c.ingresosNetos.clp;
  igual(c.ingresosBrutos.clp, e.ventasBrutas.clp + p.ventasBrutas.clp, 1, 'resumen.consolidado.ingresosBrutos');
  igual(c.ingresosNetos.clp, e.ventasNetas.clp + p.ventasNetas.clp, 1, 'resumen.consolidado.ingresosNetos');
  igual(c.costosDirectos.clp, e.costosDirectos.clp + p.costosDirectos.clp, 1, 'resumen.consolidado.costosDirectos');
  igual(c.margenBruto.clp, c.ingresosNetos.clp - c.costosDirectos.clp, 1, 'resumen.consolidado.margenBruto (ingresosNetos − costosDirectos)');
  igual(c.totalCostosFijos.clp, c.costosFijos.reduce((t, f) => t + f.clp, 0), 1, 'resumen.consolidado.totalCostosFijos (sum of costosFijos)');
  igual(c.utilidadAntesImpuestos.clp, c.ingresosNetos.clp - c.costosDirectos.clp - c.totalCostosFijos.clp, 1, 'resumen.consolidado.utilidadAntesImpuestos');
  igual(c.costosDirectos.pct, (c.costosDirectos.clp / netos) * 100, 0.1, 'resumen.consolidado.costosDirectos.pct');
  igual(c.margenBruto.pct, (c.margenBruto.clp / netos) * 100, 0.1, 'resumen.consolidado.margenBruto.pct');
  igual(c.totalCostosFijos.pct, (c.totalCostosFijos.clp / netos) * 100, 0.1, 'resumen.consolidado.totalCostosFijos.pct');
  igual(c.utilidadAntesImpuestos.pct, (c.utilidadAntesImpuestos.clp / netos) * 100, 0.1, 'resumen.consolidado.utilidadAntesImpuestos.pct');

  // Page 4 and the partner income on page 2 must build on the profit from page 3.
  igual(r.utilidadAnual.clp, c.utilidadAntesImpuestos.clp, 1, 'rentabilidad.utilidadAnual vs resumen.consolidado.utilidadAntesImpuestos');
  igual(r.valor50.uf, o.valor50.uf, 0, 'rentabilidad.valor50 vs oferta.valor50');
  igual(r.totalIngresos.clp, r.utilidadAnual.clp + r.arriendo.clp + r.honorariosSocios.clp, 1, 'rentabilidad.totalIngresos (utilidad + arriendo + honorarios)');
  igual(r.porSocio.clp, r.totalIngresos.clp / 2, 1, 'rentabilidad.porSocio (totalIngresos / 2)');
  igual(r.aniosRecupero, r.valor50.clp / r.porSocio.clp, 0.05, 'rentabilidad.aniosRecupero');
  igual(r.rentabilidadAnualPct, (r.porSocio.clp / r.valor50.clp) * 100, 0.05, 'rentabilidad.rentabilidadAnualPct');
  igual(s.utilidades.anualUF, c.utilidadAntesImpuestos.uf / 2, 1, 'ingresoSocio.utilidades.anualUF vs half of resumen utilidad');
  igual(s.directores.anualUF, r.honorariosSocios.uf / 2, 1, 'ingresoSocio.directores.anualUF vs half of rentabilidad.honorariosSocios');
  igual(s.arriendo.anualUF, r.arriendo.uf / 2, 1, 'ingresoSocio.arriendo.anualUF vs half of rentabilidad.arriendo');
  igual(s.total.anualUF, r.porSocio.uf, 1, 'ingresoSocio.total.anualUF vs rentabilidad.porSocio');

  return avisos;
}

// The website hand-codes a few headline figures; make sure they still match the package.
function verificarSitio(d) {
  const html = fs.readFileSync(path.join(RAIZ, 'index.html'), 'utf8');
  const r = d.rentabilidad;
  const esperados = {
    'rentabilidad anual socio': `aria-label="${num(r.rentabilidadAnualPct, 1)}"`,
    'años de recupero': `${num(r.aniosRecupero, 1)} años`,
    'utilidad anual': `aria-label="${num(r.utilidadAnual.uf)}"`,
    'venta anual neta': `aria-label="${num(d.resumen.consolidado.ingresosNetos.uf)}"`,
    'entrada': uf(d.oferta.entrada.uf).replace('\u00a0', ' '),
    'plazo': `${d.oferta.plazoAnios} años`,
  };
  return Object.entries(esperados)
    .filter(([, texto]) => !html.includes(texto))
    .map(([que, texto]) => `index.html: ${que} — expected to find "${texto}"`);
}


// ─── Page templates ─────────────────────────────────────────────────────────

const TOTAL_PAGINAS = 5;

function pagina({ n, eyebrow, titulo, cuerpo }) {
  return `
<section class="pagina">
  <header class="pag-cabecera">
    <div>
      <span class="eyebrow">${eyebrow}</span>
      <h2>${titulo}</h2>
    </div>
    <img class="pag-logo" src="../images/logo2.png" alt="Las Secoyas">
  </header>
  <div class="pag-cuerpo">${cuerpo}</div>
  <footer class="pag-pie">
    <span>Las Secoyas SPA · Paquete Informativo · ${esc(d.fecha)}</span>
    <span class="tc">Valor 1 UF: ${clp(d.tipoCambio.ufEnPesos)} ó ${usd(d.tipoCambio.ufEnDolares)} (Valor US$: ${num(d.tipoCambio.dolarEnPesos)} pesos chilenos)</span>
    <span>${n} / ${TOTAL_PAGINAS}</span>
  </footer>
</section>`;
}

function portada() {
  const o = d.oferta;
  return `
<section class="pagina portada">
  <img class="portada-foto" src="img/portada.jpg" alt="">
  <div class="portada-velo"></div>
  <div class="portada-panel">
    <img class="portada-logo" src="../images/logo3.png" alt="Las Secoyas">
    <span class="portada-fecha">Paquete Informativo · ${esc(d.fecha)}</span>
    <h1>${esc(d.portada.titulo)}</h1>
    <p class="portada-sub">${esc(d.portada.subtitulo)}</p>
    <div class="portada-oferta">
      <span class="etq">Oferta exclusiva · Socio o Inversionista 50%</span>
      <strong>${uf(o.valor50.uf)}</strong>
      <span class="det">Entrada ${uf(o.entrada.uf)} · saldo en ${o.plazoAnios} años, cero interés</span>
    </div>
    <div class="portada-datos">
      ${d.portada.datos.map(x => `<div><strong>${esc(x.valor)}</strong><span>${esc(x.etiqueta)}</span></div>`).join('')}
    </div>
  </div>
</section>`;
}

function paginaOferta() {
  const o = d.oferta;
  const s = d.ingresoSocio;
  const pctEntrada = (o.entrada.uf / o.valor50.uf) * 100;
  const pctCuota = (o.cuotaAnualUF / s.total.anualUF) * 100;
  const componentes = [
    ['Utilidades', s.utilidades, 'c-util'],
    ['Arriendo de propiedad al negocio', s.arriendo, 'c-arr'],
    ['Directores', s.directores, 'c-dir'],
  ];

  return pagina({
    n: 2,
    eyebrow: '¡Importante! · Crédito con financiamiento directo',
    titulo: 'Oferta exclusiva para Socio o Inversionista 50%',
    cuerpo: `
<div class="oferta-grid">
  <div class="oferta-izq">
    <div>
      <span class="eyebrow">Valor oferta 50% de la propiedad y negocio</span>
      <div class="valor-total"><span class="n">${uf(o.valor50.uf)}</span><span class="clp">${clp(o.valor50.clp)}</span></div>
      <div class="barra-split">
        <div class="seg-entrada" style="width:${pctEntrada}%">Entrada</div>
        <div class="seg-saldo" style="width:${100 - pctEntrada}%">Saldo</div>
      </div>
      <div class="split-detalle">
        <div class="d-entrada">
          <span class="etq">Valor entrada socio propietario</span>
          <span class="n">${uf(o.entrada.uf)}</span>
          <span class="sec">${clp(o.entrada.clp)} · ${usd(o.entrada.usd)}</span>
        </div>
        <div class="d-saldo">
          <span class="etq">Saldo por pagar socio o inversionista 50%</span>
          <span class="n">${uf(o.saldo.uf)}</span>
          <span class="sec">${clp(o.saldo.clp)}</span>
        </div>
      </div>
    </div>

    <div class="condiciones">
      <div class="condicion">
        <span class="n">${o.mesesGracia} meses</span>
        <strong>de gracia</strong>
        <span>Pagando las ${uf(o.entrada.uf)} de entrada</span>
      </div>
      <div class="condicion">
        <span class="n">${o.plazoAnios} años</span>
        <strong>Plazo total</strong>
        <span>${uf(o.cuotaAnualUF)} anual · ${uf(o.cuotaMensualUF)} mensual</span>
      </div>
      <div class="condicion">
        <span class="n">0%</span>
        <strong>UF cero interés</strong>
        <span>Financiamiento directo, sin presencia en sistema financiero</span>
      </div>
    </div>

    <div class="nota"><strong>Nota:</strong> ${esc(o.nota)}</div>
  </div>

  <div class="panel-oscuro">
    <span class="eyebrow claro">Ingreso promedio anual</span>
    <h3>Por socio 50%</h3>
    <div class="barra-ingresos">
      ${componentes.map(([, v, cls]) => `<div class="${cls}" style="width:${(v.anualUF / s.total.anualUF) * 100}%"></div>`).join('')}
    </div>
    ${componentes.map(([nombre, v, cls]) => `
    <div class="ingreso-fila">
      <span class="punto ${cls}"></span>
      <span class="nombre">${nombre}</span>
      <span class="val n">${uf(v.anualUF)}</span>
      <small>${uf(v.mensualUF)} mensual (${clp(v.mensualCLP)})</small>
    </div>`).join('')}
    <div class="ingreso-total">
      <span>Total ingreso c/socio</span>
      <div><span class="n">${uf(s.total.anualUF)}</span><small>${uf(s.total.mensualUF)} mensual</small></div>
    </div>

    <div class="proporcion">
      <p>El socio destina <strong>${esc(o.proporcionIngreso)}</strong> de su ingreso anual al saldo (${uf(o.cuotaAnualUF)} de ${uf(s.total.anualUF)})</p>
      <div class="prop-barra"><div style="width:${pctCuota}%"></div></div>
    </div>
  </div>
</div>`,
  });
}

function fila(concepto, v, { clase = '', pctValor } = {}) {
  return `<tr class="${clase}"><td>${concepto}</td><td class="n">${num(v.clp)}</td><td class="n">${num(v.uf)}</td><td class="n pct">${pctValor != null ? pct(pctValor) : ''}</td></tr>`;
}
const cabeceraTabla = `
  <colgroup><col><col class="col-clp"><col class="col-uf"><col class="col-pct"></colgroup>
  <thead><tr><th></th><th>$</th><th>UF</th><th></th></tr></thead>`;

function paginaResumen() {
  const { eventos: e, patio: p, consolidado: c } = d.resumen;
  return pagina({
    n: 3,
    eyebrow: 'Resultado anual proyectado',
    titulo: 'Resumen Resultado Secoyas / Secoyitas Proyectado',
    cuerpo: `
<div class="resumen-grid">
  <div class="resumen-col">
    <div class="tarjeta">
      <div class="tarjeta-cab"><span class="num">1</span><h3>Secoyas Eventos</h3></div>
      <div class="supuestos">
        <span><b>${num(e.invitadosPorEvento)}</b> invitados por evento</span>
        <span><b>${num(e.personasAnuales)}</b> personas al año</span>
        <span><b>${clp(e.precioBruto)}</b> por persona (${clp(e.precioNeto)} sin IVA)</span>
        <span>${esc(e.tiposDeEvento)}</span>
      </div>
      <table class="tabla">
        ${cabeceraTabla}
        ${fila('Ventas brutas', e.ventasBrutas)}
        ${fila('Ventas netas (sin IVA)', e.ventasNetas)}
        ${fila(`Costos directos (ventas ÷ ${e.costosDirectos.divisor})`, e.costosDirectos)}
        ${fila('Margen neto eventos', e.margenNeto, { clase: 'margen', pctValor: e.margenNeto.pct })}
      </table>
    </div>

    <div class="tarjeta">
      <div class="tarjeta-cab"><span class="num">2</span><h3>Patio de Comidas</h3></div>
      <div class="supuestos">
        <span><b>${p.diasPorMes}</b> días al mes</span>
        <span><b>${clp(p.ventaDiariaBruta)}</b> venta diaria</span>
        <span><b>${clp(p.ventaDiariaNeta)}</b> venta diaria sin IVA</span>
      </div>
      <table class="tabla">
        ${cabeceraTabla}
        ${fila('Ventas brutas', p.ventasBrutas)}
        ${fila('Ventas netas (sin IVA)', p.ventasNetas)}
        ${fila(`Costos directos (ventas ÷ ${p.costosDirectos.divisor})`, p.costosDirectos)}
        ${fila('Margen neto patio de comidas', p.margenNeto, { clase: 'margen', pctValor: p.margenNeto.pct })}
      </table>
    </div>
  </div>

  <div class="tarjeta">
    <div class="tarjeta-cab"><span class="num">=</span><h3>Las Secoyas SPA Consolidado</h3></div>
    <div class="supuestos"><span>Secoyas Eventos + Patio de Comidas</span></div>
    <table class="tabla">
      ${cabeceraTabla}
      ${fila('Ingresos brutos', c.ingresosBrutos)}
      ${fila('Ingresos netos (sin IVA)', c.ingresosNetos)}
      ${fila('Costos directos', c.costosDirectos, { pctValor: c.costosDirectos.pct })}
      ${fila('Total margen bruto consolidado', c.margenBruto, { clase: 'subtotal', pctValor: c.margenBruto.pct })}
      <tr class="seccion"><td colspan="4">Costos fijos de ambos negocios</td></tr>
      ${c.costosFijos.map(f => fila(esc(f.concepto), f)).join('')}
      ${fila('Total costos fijos', c.totalCostosFijos, { clase: 'subtotal', pctValor: c.totalCostosFijos.pct })}
      ${fila('Utilidad antes de impuestos<small>Margen consolidado menos costos fijos</small>', c.utilidadAntesImpuestos, { clase: 'total', pctValor: c.utilidadAntesImpuestos.pct })}
    </table>
  </div>
</div>`,
  });
}

function paginaRentabilidad() {
  const r = d.rentabilidad;
  return pagina({
    n: 4,
    eyebrow: 'Cálculo comprador 50%',
    titulo: 'Rentabilidad inversión del comprador 50%',
    cuerpo: `
<div class="kpis">
  <div class="kpi">
    <span class="etq">Valor 50% propiedad y negocio</span>
    <span class="n">${uf(r.valor50.uf)}</span>
    <span class="sec">${clp(r.valor50.clp)}</span>
  </div>
  <div class="kpi destacado">
    <span class="etq">Rentabilidad anual del socio</span>
    <span class="n">${pct(r.rentabilidadAnualPct)}</span>
    <span class="sec">${uf(r.porSocio.uf)} al año para cada socio</span>
  </div>
  <div class="kpi">
    <span class="etq">Años de recupero de la inversión</span>
    <span class="n">${num(r.aniosRecupero, 1)} años</span>
    <span class="sec">Sobre ${clp(r.valor50.clp)}</span>
  </div>
</div>

<div class="calculo">
  <h3>¿De dónde viene el ingreso de cada socio?</h3>
  <div class="flujo">
    <div class="caja"><span class="etq">100% utilidad anual del negocio</span><span class="n">${uf(r.utilidadAnual.uf)}</span><span class="sec">${clp(r.utilidadAnual.clp)}</span></div>
    <span class="op">+</span>
    <div class="caja"><span class="etq">100% arriendo de la propiedad</span><span class="n">${uf(r.arriendo.uf)}</span><span class="sec">${clp(r.arriendo.clp)}</span></div>
    <span class="op">+</span>
    <div class="caja"><span class="etq">100% honorarios socios (directores)</span><span class="n">${uf(r.honorariosSocios.uf)}</span><span class="sec">${clp(r.honorariosSocios.clp)}</span></div>
    <span class="op">=</span>
    <div class="caja suma"><span class="etq">Total ingresos a repartir entre 2 socios</span><span class="n">${uf(r.totalIngresos.uf)}</span><span class="sec">${clp(r.totalIngresos.clp)}</span></div>
    <span class="op">÷2</span>
    <div class="caja final"><span class="etq">Para cada socio 50%, al año</span><span class="n">${uf(r.porSocio.uf)}</span><span class="sec">${clp(r.porSocio.clp)}</span></div>
  </div>
  <p class="aclaracion">Rentabilidad anual = ingreso anual de cada socio ÷ valor del 50% de la propiedad y negocio. Años de recupero = valor del 50% ÷ ingreso anual de cada socio.</p>
</div>

<div class="fotos">
  <figure><img src="img/salon.jpg" alt=""><figcaption>Gran Salón de 400 m²</figcaption></figure>
  <figure><img src="img/patio.jpg" alt=""><figcaption>Patio de Comidas</figcaption></figure>
  <figure><img src="img/parque.jpg" alt=""><figcaption>Parque de 7.300 m²</figcaption></figure>
</div>`,
  });
}

function paginaContacto() {
  const k = d.contacto;
  return `
<section class="pagina contacto">
  <img class="contacto-foto" src="img/contacto.jpg" alt="">
  <div class="contacto-panel">
    <img class="logo" src="../images/logo3.png" alt="Las Secoyas">
    <span class="eyebrow claro">Próximos pasos</span>
    <h2>Conversemos</h2>
    <p class="intro">Si tiene alguna pregunta o desea programar una visita, no dude en contactarnos. Documentación financiera completa disponible bajo carta de confidencialidad.</p>
    <ul class="contacto-lista">
      <li><span>Tel. / WhatsApp</span><a href="https://wa.me/${k.whatsapp}">${esc(k.telefono)}</a></li>
      <li><span>Email</span><a href="mailto:${esc(k.email)}">${esc(k.email)}</a></li>
      <li><span>Web</span><a href="https://${esc(k.web)}/">${esc(k.web)}</a></li>
      <li><span>Instagram</span><a href="https://www.instagram.com/${esc(k.instagram)}/">@${esc(k.instagram)}</a></li>
      <li><span>Facebook</span><a href="https://www.facebook.com/${esc(k.facebook)}/">facebook.com/${esc(k.facebook)}</a></li>
      <li><span>Dirección</span>${esc(k.direccion)}</li>
    </ul>
    <p class="descargo">Las cifras presentadas son proyecciones basadas en el historial operativo del negocio y no constituyen una garantía de resultados futuros. Toda inversión conlleva riesgos inherentes. ${esc(d.fecha)}.</p>
  </div>
</section>`;
}

function documento() {
  return `<!DOCTYPE html>
<!-- Generated by paquete/build.js from paquete/datos.json — edit those, not this file. -->
<html lang="es-CL">
<head>
<meta charset="UTF-8">
<meta name="robots" content="noindex">
<title>Paquete Informativo — Las Secoyas</title>
<link rel="stylesheet" href="estilos.css">
</head>
<body>
${portada()}
${paginaOferta()}
${paginaResumen()}
${paginaRentabilidad()}
${paginaContacto()}
</body>
</html>
`;
}


// ─── PDF ────────────────────────────────────────────────────────────────────

function buscarNavegador() {
  const candidatos = [
    process.env.CHROME_PATH,
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ];
  return candidatos.find(p => p && fs.existsSync(p));
}

function imprimirPDF(html, pdf) {
  const navegador = buscarNavegador();
  if (!navegador) throw new Error('Chrome or Edge not found. Set CHROME_PATH to the browser executable.');

  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'paquete-chrome-'));
  const temporal = path.join(perfil, 'paquete.pdf');
  try {
    execFileSync(navegador, [
      '--headless',
      '--disable-gpu',
      '--no-first-run',
      '--no-pdf-header-footer',
      '--virtual-time-budget=10000',
      `--user-data-dir=${perfil}`,
      `--print-to-pdf=${temporal}`,
      pathToFileURL(html).href,
    ], { stdio: 'pipe', timeout: 120000 });
    if (!fs.existsSync(temporal)) throw new Error('The browser did not produce a PDF.');
    fs.copyFileSync(temporal, pdf);
  } finally {
    fs.rmSync(perfil, { recursive: true, force: true });
  }
}


// ─── Main ───────────────────────────────────────────────────────────────────

const avisos = [...verificar(d), ...verificarSitio(d)];
if (avisos.length) {
  console.warn(`\n⚠  ${avisos.length} figure(s) to review (the PDF is still built):`);
  avisos.forEach(a => console.warn('   • ' + a));
  console.warn('');
} else {
  console.log('✓ All figures check out.');
}

fs.writeFileSync(SALIDA_HTML, documento());
console.log(`✓ HTML preview: ${path.relative(RAIZ, SALIDA_HTML)}`);

imprimirPDF(SALIDA_HTML, SALIDA_PDF);
console.log(`✓ PDF: ${path.relative(RAIZ, SALIDA_PDF)} (${Math.round(fs.statSync(SALIDA_PDF).size / 1024)} KB) — upload this file to the server.`);
