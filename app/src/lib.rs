//! Backend Tauri: comandos chamados pela interface (ui/app.js). A lógica fica no crate `motor`.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;

use serde::Serialize;
use tauri::ipc::Channel;

use motor::{Ferramentas, Fps, Opcoes};

/// Ferramentas embutidas (ffmpeg, ffprobe, raw2bmx), procuradas ao lado do executável.
static FERRAMENTAS: OnceLock<Result<Ferramentas, String>> = OnceLock::new();
static CANCELAR: AtomicBool = AtomicBool::new(false);

fn ferramentas() -> Result<&'static Ferramentas, String> {
    FERRAMENTAS
        .get_or_init(|| {
            let pasta = std::env::current_exe().ok().and_then(|e| e.parent().map(PathBuf::from));
            Ferramentas::localizar(pasta.as_deref()).map_err(|e| format!("{e:#}"))
        })
        .as_ref()
        .map_err(Clone::clone)
}

#[derive(Serialize)]
struct Velocidade {
    fps: Fps,
    rotulo: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Estado {
    formatos: &'static [motor::InfoFormato],
    velocidades: Vec<Velocidade>,
    versao: &'static str,
    /// Mensagem quando falta algum programa embutido.
    erro: Option<String>,
}

#[tauri::command]
fn estado() -> Estado {
    let erro = match ferramentas() {
        Err(e) => Some(e),
        Ok(f) if f.raw2bmx.is_none() => Some("raw2bmx não encontrado (sem ele não dá para gravar MXF)".into()),
        Ok(_) => None,
    };
    Estado {
        formatos: motor::FORMATOS,
        velocidades: motor::VELOCIDADES.iter().map(|f| Velocidade { fps: *f, rotulo: f.rotulo() }).collect(),
        versao: env!("CARGO_PKG_VERSION"),
        erro,
    }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct Item {
    caminho: String,
    inspecao: Option<motor::Inspecao>,
    erro: Option<String>,
}

/// Arquivos passados na linha de comando (por exemplo, "Abrir com…").
#[tauri::command]
fn arquivos_iniciais() -> Vec<String> {
    std::env::args().skip(1).filter(|a| !a.starts_with('-') && std::path::Path::new(a).is_file()).collect()
}

/// Inspeciona os arquivos (em outra thread, para não travar a janela).
#[tauri::command]
async fn inspecionar(caminhos: Vec<String>, fps: Fps) -> Vec<Item> {
    tauri::async_runtime::spawn_blocking(move || {
        let ferr = ferramentas();
        caminhos
            .into_iter()
            .map(|c| {
                let r = ferr.clone().and_then(|f| motor::inspecionar(f, &PathBuf::from(&c), fps).map_err(|e| format!("{e:#}")));
                match r {
                    Ok(i) => Item { caminho: c, inspecao: Some(i), erro: None },
                    Err(e) => Item { caminho: c, inspecao: None, erro: Some(e) },
                }
            })
            .collect()
    })
    .await
    .unwrap_or_default()
}

/// Converte um arquivo, mandando o progresso (0..1) pelo canal.
#[tauri::command]
async fn converter(caminho: String, opcoes: Opcoes, progresso: Channel<f64>) -> Result<motor::Resultado, String> {
    CANCELAR.store(false, Ordering::Relaxed);
    tauri::async_runtime::spawn_blocking(move || {
        let ferr = ferramentas()?;
        let ins = motor::inspecionar(ferr, &PathBuf::from(&caminho), opcoes.fps).map_err(|e| format!("{e:#}"))?;
        let mut ultimo = -1.0;
        let mut enviar = |p: f64| {
            if p - ultimo >= 0.005 || p >= 1.0 {
                ultimo = p;
                let _ = progresso.send(p);
            }
        };
        motor::converter(ferr, &ins, &opcoes, &mut enviar, &CANCELAR).map_err(|e| format!("{e:#}"))
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
fn cancelar() {
    CANCELAR.store(true, Ordering::Relaxed);
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![estado, arquivos_iniciais, inspecionar, converter, cancelar])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar o aplicativo");
}
