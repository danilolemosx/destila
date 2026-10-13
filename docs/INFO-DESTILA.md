# Destila — informações do app

## Identidade
- **Nome:** DESTILA (com ponto final verde-azulado no logotipo: "DESTILA.")
- **Subtítulo:** conversor de áudio
- **Autor:** Danilo Lemos (montador de cinema e séries)
- **Versão atual:** 0.1.0 (publicada em 10/10/2026)
- **Plataformas:** Mac chip Apple (M1–M4), Mac Intel, Windows 10/11
- **Preço:** gratuito · código aberto (MIT/Apache-2.0)
- **Imagens:** ícone `docs/preview/icone.png` (1024 px, fundo transparente) · janela `docs/preview/janela-app.png`
- **Paleta (gin):** fundo `#1e2a2f`, papel `#e8ede6`, tinta `#20333a`, destaque `#1f7f86` · fonte Archivo (larga, maiúsculas)

## Descrição curta (1 frase)
Converte áudio, e o áudio de vídeos, para os formatos de edição e de entrega, mantendo o timecode do original.

## Descrição (para site ou divulgação)
O Destila converte áudio e o áudio de vídeos para WAV, MXF do Avid, AIFF, FLAC, MP3, AAC, AC3 e outros.
Arraste um lote de arquivos, escolha o formato e pronto. Ele separa o 5.1 em seis monos, usa o nome das
faixas dos gravadores de som e mantém o timecode no WAV e no MXF. Roda no computador, sem internet e sem
instalar mais nada.

## Recursos
- Lê qualquer formato de áudio ou vídeo (WAV/BWF polifônico, MOV, MP4, MXF, MP3, M4A, AIFF, FLAC…)
- Saídas: WAV (Broadcast Wave), MXF Avid (OP-Atom), AIFF, FLAC, ALAC, MP3, AAC, AC3; em "+ OUTROS": E-AC3, OGG, OPUS, WMA, MP2, CAF, W64
- Taxa (original, 44,1, 48, 96 kHz), bits (16, 24, 32 float) ou qualidade em kbps
- Manter juntos ou separar em monos: 5.1 vira _L _R _C _LFE _Ls _Rs; gravadores usam o nome das faixas do iXML (_BOOM, _LAV1…)
- Timecode do original no WAV (bext) e no MXF (alinhado ao quadro, como o Avid exige)
- MXF Avid: juntos = um clipe com várias faixas; separados = um clipe por canal
- Conversão em lote, com progresso e "abrir pasta"
- Nunca sobrescreve: se o arquivo existir, o novo ganha _2, _3…

## Downloads (v0.1.0)
- Mac chip Apple: https://github.com/danilolemosx/destila/releases/download/v0.1.0/Destila_0.1.0_aarch64.dmg (21 MB)
- Mac Intel: https://github.com/danilolemosx/destila/releases/download/v0.1.0/Destila_0.1.0_x64.dmg (24 MB)
- Windows: https://github.com/danilolemosx/destila/releases/download/v0.1.0/Destila_0.1.0_x64-setup.exe (17 MB)
- Página da versão: https://github.com/danilolemosx/destila/releases/tag/v0.1.0
- Sempre a última versão: https://github.com/danilolemosx/destila/releases/latest
- Código: https://github.com/danilolemosx/destila

## Instalação (avisos normais, o app não é assinado)
- Mac "não pode ser aberto": Ajustes do Sistema › Privacidade e Segurança › Abrir Mesmo Assim
- Mac "está danificado": no Terminal, `xattr -cr /Applications/Destila.app`
- Mac não abre: baixou o .dmg errado (aarch64 = chip Apple, x64 = Intel)
- Windows SmartScreen: Mais informações › Executar assim mesmo
- Navegador bloqueia o download: Manter

## Por dentro (técnico)
Tauri v2 + motor em Rust. Programas embutidos: ffmpeg/ffprobe 7.1.1 (LGPL, com LAME, Opus e Vorbis) e
raw2bmx (BBC bmx 1.6) para o MXF. Instaladores gerados pelo GitHub Actions ao publicar uma release.

## Pendências conhecidas
- Testar o app aberto num Windows de verdade (o motor passou nos testes automáticos no Windows)
- Importar um MXF no Avid e conferir o timecode
