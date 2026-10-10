// Tauri falso para testar a interface no navegador, sem o app.
// Cenas pela URL: ?cena=vazio | lote | convertendo | pronto | mp3 | ajustes | outros
"use strict";
(function () {
  const cena = new URLSearchParams(location.search).get("cena") || "lote";
  const ESTADO = window.__ESTADO__;
  const F23 = { num: 24000, den: 1001, drop: false };
  const ARQUIVOS = {
    "/Volumes/MIDIA/EP18_CENA01_TAKE3.mov": { nome: "EP18_CENA01_TAKE3.mov", tipo: "MOV", video: true, canais: 6, descricao: "5.1", rotulos: ["L", "R", "C", "LFE", "Ls", "Rs"], sr: 48000, duracaoS: 161, inicio: { segundos: 3734.5, fps: F23, fpsDoArquivo: true, texto: "01:02:14:08" } },
    "/Volumes/SOM/BOOM_SC12_T04.wav": { nome: "BOOM_SC12_T04.wav", tipo: "WAV", video: false, canais: 4, descricao: "Poli · 4", rotulos: ["BOOM", "LAV1", "LAV2", "MIX"], sr: 96000, duracaoS: 250, inicio: { segundos: 51725.44, fps: { num: 25, den: 1, drop: false }, fpsDoArquivo: true, texto: "14:22:05:11" } },
    "/Users/d/Musicas/trilha_referencia_v2.mp3": { nome: "trilha_referencia_v2.mp3", tipo: "MP3", video: false, canais: 2, descricao: "Estéreo", rotulos: ["L", "R"], sr: 44100, duracaoS: 207, inicio: null },
    "/Users/d/Downloads/entrevista_celular.m4a": { nome: "entrevista_celular.m4a", tipo: "M4A", video: false, canais: 1, descricao: "Mono", rotulos: [""], sr: 44100, duracaoS: 725, inicio: null },
    "/Users/d/Downloads/planilha.pdf": null,
  };
  const erros = [];
  window.__ERROS__ = erros;
  addEventListener("error", (e) => erros.push(String(e.message)));

  let canalAtual = null;
  class Channel { constructor() { this.onmessage = null; canalAtual = this; } }

  async function invoke(cmd, args) {
    switch (cmd) {
      case "estado": return ESTADO;
      case "arquivos_iniciais":
        return cena === "vazio" || cena === "ajustes" ? [] : Object.keys(ARQUIVOS).filter((c) => cena !== "mp3" || ARQUIVOS[c]);
      case "inspecionar":
        return args.caminhos.map((c) => ARQUIVOS[c]
          ? { caminho: c, inspecao: { caminho: c, faixas: [], ...ARQUIVOS[c] }, erro: null }
          : { caminho: c, inspecao: null, erro: "arquivo não reconhecido (Invalid data found when processing input)" });
      case "converter": {
        const c = canalAtual;
        if (cena === "convertendo" && args.caminho.includes("BOOM")) {
          c.onmessage && c.onmessage(0.62);
          return new Promise(() => {}); // fica convertendo
        }
        const ins = ARQUIVOS[args.caminho];
        const n = args.opcoes.separar || args.opcoes.formato === "mxf" ? ins.canais : 1;
        const avisos = args.opcoes.formato === "mp3" && ins.canais > 2 ? ["MP3 aceita até 2 canais: 5.1 virou estéreo"] : [];
        return { arquivos: Array.from({ length: n }, (_, k) => `${args.caminho}_${k}`), avisos };
      }
      case "cancelar": return null;
      default: throw new Error("comando desconhecido " + cmd);
    }
  }

  window.__TAURI__ = {
    core: { invoke, Channel },
    dialog: { open: async () => null, message: async (m) => console.log("message:", m) },
    opener: { revealItemInDir: async () => null },
    webview: { getCurrentWebview: () => ({ onDragDropEvent: () => {} }) },
  };

  // preferências de cada cena
  const pref = {
    lote: { formato: "mxf", separar: true },
    convertendo: { formato: "mxf", separar: true },
    pronto: { formato: "wav", separar: false, taxa: 48000 },
    mp3: { formato: "mp3", separar: false },
    ajustes: { formato: "wav" },
    outros: { formato: "opus" },
    vazio: { formato: "wav" },
  }[cena];
  try { localStorage.setItem("destila", JSON.stringify(pref || {})); } catch (_) { /* sem storage */ }

  // ações depois de carregar
  addEventListener("load", () => setTimeout(async () => {
    if (cena === "convertendo" || cena === "pronto" || cena === "mp3") document.querySelector("#acao").click();
    if (cena === "ajustes") document.querySelector("#engrenagem").click();
    if (cena === "outros") document.querySelector("#mais").click();
    setTimeout(() => { document.title = "erros:" + erros.length; document.body.dataset.erros = erros.join(" | "); }, 200);
  }, 150));
})();
