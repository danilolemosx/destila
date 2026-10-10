"use strict";

const T = window.__TAURI__;
const { invoke, Channel } = T.core;
const dialogo = T.dialog;

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const khz = (sr) => (sr / 1000).toFixed(sr % 1000 ? 1 : 0).replace(".", ",");
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
function duracao(s) {
  const t = Math.round(s || 0), h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, ss = t % 60;
  const p = (n) => String(n).padStart(2, "0");
  return h ? `${h}:${p(m)}:${p(ss)}` : `${p(m)}:${p(ss)}`;
}

// ---------- preferências (lembradas entre aberturas) ----------
const PADRAO = { formato: "wav", taxa: null, bits: 24, kbps: {}, separar: false, destino: null, fps: { num: 24000, den: 1001, drop: false } };
let pref = { ...PADRAO };
try { pref = { ...PADRAO, ...JSON.parse(localStorage.getItem("destila") || "{}") }; } catch (_) { /* sem preferências */ }
function salvar() { try { localStorage.setItem("destila", JSON.stringify(pref)); } catch (_) { /* ignora */ } }

// ---------- estado ----------
let formatos = [];
let velocidades = [];
/** @type {{caminho:string, ins?:any, erro?:string, estado:string, progresso:number, arquivos:string[], avisos:string[], msg?:string}[]} */
const lote = [];
let trabalhando = false;
let verOutros = false;

const fmt = () => formatos.find((f) => f.id === pref.formato) || formatos[0];
const separa = () => pref.separar || pref.formato === "mxf";
const saidasDe = (it) => (it.ins ? (separa() ? it.ins.canais : 1) : 0);

// ---------- lote ----------
async function adicionar(caminhos) {
  const novos = caminhos.filter((c) => !lote.some((i) => i.caminho === c));
  if (!novos.length) return;
  const itens = novos.map((c) => ({ caminho: c, estado: "lendo", progresso: 0, arquivos: [], avisos: [] }));
  lote.push(...itens);
  render();
  const res = await invoke("inspecionar", { caminhos: novos, fps: pref.fps });
  for (const r of res) {
    const it = lote.find((i) => i.caminho === r.caminho);
    if (!it) continue;
    it.ins = r.inspecao || undefined;
    it.erro = r.erro || undefined;
    it.estado = r.erro ? "erro" : "fila";
    it.msg = r.erro || undefined;
  }
  render();
}

async function reinspecionar() {
  const itens = lote.filter((i) => i.ins);
  if (!itens.length) return;
  const res = await invoke("inspecionar", { caminhos: itens.map((i) => i.caminho), fps: pref.fps });
  for (const r of res) {
    const it = lote.find((i) => i.caminho === r.caminho);
    if (it && r.inspecao) it.ins = r.inspecao;
  }
  render();
}

function linhaHTML(it, k) {
  const ins = it.ins;
  const nome = ins ? ins.nome : it.caminho.split(/[\\/]/).pop();
  const ext = (nome.match(/\.([^.]+)$/) || [, ""])[1].toUpperCase();
  const tipo = ins ? ins.tipo || "?" : it.estado === "lendo" ? "…" : ext || "?";
  let sub;
  if (it.estado === "erro") sub = `<small class="erro">${esc(it.msg || "erro")}</small>`;
  else if (it.avisos.length) sub = `<small class="aviso">${esc(it.avisos.join(" · "))}</small>`;
  else if (ins && ins.inicio) sub = `<small>TC ${esc(ins.inicio.texto)} · ${esc(rotuloFps(ins.inicio.fps))}${ins.inicio.fpsDoArquivo ? "" : " (padrão)"}</small>`;
  else if (ins) sub = `<small>sem timecode · começa em 00:00:00:00</small>`;
  else sub = `<small>lendo…</small>`;

  let estado = "";
  if (it.estado === "fila") estado = `<div class="estado">NA FILA</div>`;
  else if (it.estado === "vai") estado = `<div class="estado vai">${Math.round(it.progresso * 100)}%<div class="barrinha"><i style="width:${(it.progresso * 100).toFixed(1)}%"></i></div></div>`;
  else if (it.estado === "ok") estado = `<div class="estado ok">PRONTO ✓<button class="abrir" data-abrir="${k}">ABRIR PASTA</button></div>`;
  else if (it.estado === "erro") estado = `<div class="estado erro">ERRO</div>`;
  else estado = `<div class="estado">…</div>`;

  const sur = ins && ins.canais > 2;
  const monos = ins && separa() && ins.canais > 1
    ? `<div class="monos">${ins.rotulos.map((r) => `<span>${esc(r)}</span>`).join("")}</div>` : "";
  const tirar = !trabalhando && it.estado !== "vai" ? `<button class="tirar" data-tirar="${k}" title="Tirar do lote">✕</button>` : "";
  return `<div class="linha">
    <div class="tipo ${ins && ins.video ? "video" : ""}">${esc(tipo.slice(0, 4))}</div>
    <div class="nome" title="${esc(it.caminho)}">${esc(nome)}${sub}</div>
    <div class="can ${sur ? "sur" : ""}">${ins ? esc(ins.descricao) : ""}</div>
    <div class="info tab">${ins ? khz(ins.sr) + " kHz" : ""}</div>
    <div class="info tab">${ins ? duracao(ins.duracaoS) : ""}</div>
    ${estado}${monos}${tirar}
  </div>`;
}

function rotuloFps(f) {
  const v = velocidades.find((x) => x.fps.num === f.num && x.fps.den === f.den && !!x.fps.drop === !!f.drop);
  if (v) return v.rotulo;
  const n = (f.num / f.den).toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
  return f.drop ? `${n} DF` : n;
}

function renderLote() {
  const validos = lote.filter((i) => i.ins);
  $("#contagem").textContent = lote.length ? plural(lote.length, "arquivo", "arquivos") : "Nenhum arquivo";
  $("#vazio").classList.toggle("oculto", lote.length > 0);
  $("#linhas").classList.toggle("oculto", lote.length === 0);
  $("#solta").classList.toggle("oculto", lote.length === 0);
  $("#limpar").classList.toggle("oculto", lote.length === 0 || trabalhando);
  $("#linhas").innerHTML = lote.map(linhaHTML).join("");

  const total = validos.reduce((s, i) => s + saidasDe(i), 0);
  $("#nSaidas").textContent = plural(total, "arquivo de saída", "arquivos de saída");
  const exp = [];
  if (separa()) {
    const tipos = new Set(validos.filter((i) => i.ins.canais > 1).map((i) => i.ins.descricao));
    for (const d of tipos) {
      const n = validos.find((i) => i.ins.descricao === d).ins.canais;
      exp.push(`${d === "Estéreo" ? "estéreo" : d} vira ${n} monos`);
    }
  } else {
    const f = fmt();
    const grandes = validos.filter((i) => i.ins.canais > f.maxCanais);
    if (grandes.length) exp.push(`${f.nome} aceita até ${f.maxCanais} canais: o resto vira ${f.maxCanais === 2 ? "estéreo" : f.maxCanais === 6 ? "5.1" : "7.1"}`);
  }
  $("#explica").textContent = exp.length ? "· " + exp.join(" · ") : "";
}

// ---------- destino ----------
function chip(f) {
  return `<button class="chip ${f.id === pref.formato ? "on" : ""}" data-f="${f.id}">${esc(f.nome)}</button>`;
}

function seg(el, opcoes, atual, permitido) {
  el.innerHTML = opcoes.map((o) => `<button data-v="${o.v}" class="${o.v === atual ? "on" : ""}" ${permitido(o.v) ? "" : "disabled"}>${esc(o.t)}</button>`).join("");
}

function renderDestino() {
  const f = fmt();
  if (!f) return;
  const nomeGrande = f.nome.split(" ")[0];
  $("#fNome").textContent = nomeGrande;
  $("#fNome").style.fontSize = nomeGrande.length >= 5 ? "46px" : nomeGrande.length === 4 ? "58px" : "";
  $("#fDescricao").textContent = f.descricao;

  const outros = formatos.filter((x) => x.grupo === "outros");
  const outroEscolhido = outros.some((x) => x.id === pref.formato);
  $('[data-grupo="edicao"]').innerHTML = formatos.filter((x) => x.grupo === "edicao").map(chip).join("");
  $('[data-grupo="principal"]').innerHTML = formatos.filter((x) => x.grupo === "principal").map(chip).join("")
    + `<button class="chip mais" id="mais">${verOutros ? "− MENOS" : outroEscolhido ? `+ ${esc(f.nome)}` : "+ OUTROS"}</button>`;
  $('[data-grupo="outros"]').innerHTML = outros.map(chip).join("");
  $('[data-grupo="outros"]').classList.toggle("oculto", !verOutros);

  // taxa
  const taxas = [{ v: "orig", t: "ORIG." }, { v: "44100", t: "44,1" }, { v: "48000", t: "48" }, { v: "96000", t: "96" }];
  const fixa = f.taxas.length === 1 ? f.taxas[0] : null;
  const taxaAtual = fixa ? String(fixa) : pref.taxa ? String(pref.taxa) : "orig";
  seg($("#taxa"), taxas, taxaAtual, (v) => fixa ? v === String(fixa) : v === "orig" || !f.taxas.length || f.taxas.includes(Number(v)));

  // bits ou qualidade
  if (f.comPerda) {
    $("#rotBits").textContent = f.kbpsPorPar ? "Qualidade · kbps/par" : "Qualidade · kbps";
    const atual = String(pref.kbps[f.id] || f.kbpsPadrao);
    seg($("#bits"), f.kbps.map((k) => ({ v: String(k), t: String(k) })), atual, () => true);
  } else {
    $("#rotBits").textContent = "Bits";
    const atual = String(f.bits.includes(pref.bits) ? pref.bits : Math.max(...f.bits.filter((b) => b <= pref.bits), f.bits[0]));
    seg($("#bits"), [{ v: "16", t: "16" }, { v: "24", t: "24" }, { v: "32", t: "32 F" }], atual, (v) => f.bits.includes(Number(v)));
  }

  // canais
  for (const b of $("#canais").children) b.classList.toggle("on", (b.dataset.v === "separar") === pref.separar);
  let nota = "";
  if (f.id === "mxf") nota = pref.separar
    ? "MXF do Avid é <b>um arquivo por canal</b>: aqui, um clipe para cada canal."
    : "MXF do Avid é <b>um arquivo por canal</b>: juntos, viram um clipe com várias faixas.";
  else if (!pref.separar && lote.some((i) => i.ins && i.ins.canais > f.maxCanais)) nota = `${esc(f.nome)} aceita até <b>${f.maxCanais} canais</b>.`;
  else if (!f.timecode && lote.some((i) => i.ins && i.ins.inicio)) nota = `${esc(f.nome)} não guarda timecode.`;
  $("#notaCanais").innerHTML = nota;

  // pasta
  $("#pastaNome").textContent = pref.destino ? pref.destino.split(/[\\/]/).filter(Boolean).pop() : "Ao lado do original";
  $("#pastaNome").title = pref.destino || "";
  $("#pastaVolta").classList.toggle("oculto", !pref.destino);

  // ajustes: velocidades
  $("#fps").innerHTML = velocidades.map((v, k) => {
    const on = v.fps.num === pref.fps.num && v.fps.den === pref.fps.den && !!v.fps.drop === !!pref.fps.drop;
    return `<button class="chip ${on ? "on" : ""}" data-fps="${k}">${esc(v.rotulo)}</button>`;
  }).join("");
}

function renderBotao() {
  const b = $("#acao");
  const validos = lote.filter((i) => i.ins);
  const pendentes = validos.filter((i) => i.estado === "fila" || i.estado === "erro" && i.ins);
  b.classList.toggle("cancelar", trabalhando);
  b.disabled = !trabalhando && !validos.length;
  const ext = fmt() ? fmt().nome.split(" ")[0] : "";
  if (trabalhando) {
    const feitos = validos.filter((i) => i.estado === "ok").length;
    b.innerHTML = `CANCELAR<small>${feitos} DE ${validos.length} PRONTOS</small>`;
  } else if (!validos.length) {
    b.innerHTML = `DESTILAR<small>NADA NO LOTE</small>`;
  } else if (!pendentes.length) {
    const n = validos.reduce((s, i) => s + saidasDe(i), 0);
    b.innerHTML = `DESTILAR<small>DE NOVO · ${plural(validos.length, "ARQUIVO", "ARQUIVOS")} → ${n} ${esc(ext)}</small>`;
  } else {
    const n = pendentes.reduce((s, i) => s + saidasDe(i), 0);
    b.innerHTML = `DESTILAR<small>${plural(pendentes.length, "ARQUIVO", "ARQUIVOS")} → ${n} ${esc(ext)}</small>`;
  }
}

function render() {
  renderLote();
  renderDestino();
  renderBotao();
}

// ---------- conversão ----------
async function destilar() {
  if (trabalhando) {
    await invoke("cancelar");
    return;
  }
  let pendentes = lote.filter((i) => i.ins && (i.estado === "fila" || i.estado === "erro"));
  if (!pendentes.length) {
    // tudo pronto: converte de novo (por exemplo, para outro formato)
    pendentes = lote.filter((i) => i.ins);
  }
  for (const it of pendentes) { it.estado = "fila"; it.avisos = []; it.arquivos = []; it.msg = undefined; }
  trabalhando = true;
  render();
  const f = fmt();
  const opcoes = {
    formato: f.id,
    taxa: f.taxas.length === 1 ? f.taxas[0] : pref.taxa,
    bits: pref.bits,
    kbps: f.comPerda ? (pref.kbps[f.id] || f.kbpsPadrao) : null,
    separar: pref.separar,
    destino: pref.destino,
    fps: pref.fps,
  };
  for (const it of pendentes) {
    if (!trabalhando) break;
    it.estado = "vai";
    it.progresso = 0;
    render();
    const canal = new Channel();
    let ultimo = 0;
    canal.onmessage = (p) => {
      it.progresso = p;
      const agora = performance.now();
      if (agora - ultimo > 80) { ultimo = agora; renderLote(); }
    };
    try {
      const r = await invoke("converter", { caminho: it.caminho, opcoes, progresso: canal });
      it.estado = "ok";
      it.arquivos = r.arquivos;
      it.avisos = r.avisos;
    } catch (e) {
      const msg = String(e);
      if (/cancelado/.test(msg)) {
        it.estado = "fila";
        trabalhando = false;
      } else {
        it.estado = "erro";
        it.msg = msg;
      }
    }
    render();
  }
  trabalhando = false;
  render();
}

// ---------- eventos ----------
async function escolherArquivos() {
  const sel = await dialogo.open({ multiple: true, title: "Escolha áudios ou vídeos" });
  if (sel) await adicionar(Array.isArray(sel) ? sel : [sel]);
}
$("#adicionarVazio").addEventListener("click", escolherArquivos);
$("#solta").addEventListener("click", escolherArquivos);
$("#limpar").addEventListener("click", () => { if (!trabalhando) { lote.length = 0; render(); } });
$("#linhas").addEventListener("click", (ev) => {
  const t = ev.target.closest("[data-tirar]");
  if (t) { lote.splice(Number(t.dataset.tirar), 1); render(); return; }
  const a = ev.target.closest("[data-abrir]");
  if (a) {
    const it = lote[Number(a.dataset.abrir)];
    if (it && it.arquivos.length) T.opener.revealItemInDir(it.arquivos[0]);
  }
});
document.querySelector(".destino").addEventListener("click", (ev) => {
  if (trabalhando && !ev.target.closest("#acao")) return;
  const c = ev.target.closest("[data-f]");
  if (c) { pref.formato = c.dataset.f; salvar(); render(); return; }
  if (ev.target.closest("#mais")) { verOutros = !verOutros; renderDestino(); return; }
  const tx = ev.target.closest("#taxa button");
  if (tx && !tx.disabled) { pref.taxa = tx.dataset.v === "orig" ? null : Number(tx.dataset.v); salvar(); render(); return; }
  const bt = ev.target.closest("#bits button");
  if (bt && !bt.disabled) {
    const f = fmt();
    if (f.comPerda) pref.kbps[f.id] = Number(bt.dataset.v); else pref.bits = Number(bt.dataset.v);
    salvar(); render(); return;
  }
  const cn = ev.target.closest("#canais button");
  if (cn) { pref.separar = cn.dataset.v === "separar"; salvar(); render(); return; }
  const fp = ev.target.closest("[data-fps]");
  if (fp) { pref.fps = velocidades[Number(fp.dataset.fps)].fps; salvar(); reinspecionar(); render(); }
});
$("#pastaTroca").addEventListener("click", async () => {
  if (trabalhando) return;
  const d = await dialogo.open({ directory: true, title: "Salvar os arquivos em…" });
  if (d) { pref.destino = Array.isArray(d) ? d[0] : d; salvar(); render(); }
});
$("#pastaVolta").addEventListener("click", () => { pref.destino = null; salvar(); render(); });
$("#acao").addEventListener("click", destilar);
$("#engrenagem").addEventListener("click", () => {
  const ab = $("#ajustes").classList.toggle("oculto");
  $("#engrenagem").classList.toggle("on", !ab);
});
$("#fecharAjustes").addEventListener("click", () => { $("#ajustes").classList.add("oculto"); $("#engrenagem").classList.remove("on"); });

// arrastar e soltar (eventos nativos do Tauri: dão o caminho completo dos arquivos)
T.webview.getCurrentWebview().onDragDropEvent((ev) => {
  const t = ev.payload.type;
  document.body.classList.toggle("arrastando", t === "enter" || t === "over");
  if (t === "drop") adicionar(ev.payload.paths);
});

// ---------- início ----------
(async () => {
  const e = await invoke("estado");
  formatos = e.formatos;
  velocidades = e.velocidades;
  if (!formatos.some((f) => f.id === pref.formato)) pref.formato = "wav";
  $("#versao").textContent = `Destila ${e.versao}`;
  render();
  if (e.erro) dialogo.message(`O Destila não encontrou um programa de que precisa:\n\n${e.erro}`, { title: "Destila", kind: "error" });
  const iniciais = await invoke("arquivos_iniciais");
  if (iniciais.length) adicionar(iniciais);
})();
