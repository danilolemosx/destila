# DESTILA — conversor de áudio

App para Mac (Apple Silicon e Intel) e Windows que converte áudio, e o áudio de vídeos, para os formatos
de edição e de entrega, mantendo o timecode do original.

- **Arraste** um ou vários arquivos de áudio ou vídeo (qualquer formato: WAV, BWF polifônico, MOV, MP4, MXF,
  MP3, M4A, AIFF, FLAC…).
- **Escolha o formato**: WAV (Broadcast Wave), **MXF Avid** (OP-Atom), AIFF, FLAC, ALAC, MP3, AAC, AC3 e, em
  "+ OUTROS", E-AC3, OGG, OPUS, WMA, MP2, CAF e W64.
- **Taxa** (original, 44,1, 48 ou 96 kHz), **bits** (16, 24 ou 32 float) ou **qualidade** (kbps).
- **Manter juntos ou separar em monos**: o 5.1 vira 6 monos (`_L _R _C _LFE _Ls _Rs`); arquivos de gravador
  de som usam o nome das faixas do iXML (`_BOOM _LAV1…`).
- **Timecode do original** no WAV (bext) e no MXF (alinhado ao quadro, como o Avid exige).
- Nunca sobrescreve: se o arquivo já existir, o novo ganha `_2`, `_3`…

Por dentro: [Tauri v2](https://tauri.app), motor em Rust (`motor/`), e programas embutidos compilados no
GitHub Actions: **ffmpeg/ffprobe** (LGPL, com lame, opus e vorbis) e **raw2bmx** (BBC bmx, para o MXF).

## Desenvolvimento

```bash
cargo test -p motor                                          # testes (precisam de ffmpeg; MXF precisa de raw2bmx)
cargo run -p motor --bin motor-cli -- arquivo.mov            # inspeciona
cargo run -p motor --bin motor-cli -- -f mxf -m arquivo.mov  # converte (ver --help)
scripts/compilar-ferramentas.sh aarch64-apple-darwin         # compila ffmpeg/ffprobe/raw2bmx em app/binaries
testes-ui/capturar.sh                                        # captura a interface com dados simulados
cd app && npx @tauri-apps/cli@2 dev                          # abre o app
```

## Publicar uma versão

1. Atualize `"version"` em `app/tauri.conf.json`.
2. Confira na aba **Actions** que **Testes** e **Ferramentas embutidas** passaram.
3. Em **Releases → Draft a new release**, crie a tag `vX.Y.Z`, dê o título `Destila vX.Y.Z` e clique em
   **Publish release**.
4. Em 20 a 30 minutos, os instaladores aparecem no fim da página da Release:
   `Destila_X.Y.Z_aarch64.dmg` (Mac M1–M4), `Destila_X.Y.Z_x64.dmg` (Mac Intel) e
   `Destila_X.Y.Z_x64-setup.exe` (Windows).

## Licenças
- Destila: MIT OR Apache-2.0.
- FFmpeg (LGPL 2.1+), LAME (LGPL), Opus e Vorbis (BSD), bmx (BSD 3-Clause), embutidos como programas separados.
  Os códigos-fonte e as versões exatas estão em `scripts/compilar-ferramentas.sh`.
- Fonte Archivo (Omnibus-Type): SIL Open Font License 1.1, veja `ui/fonts/OFL.txt`.
