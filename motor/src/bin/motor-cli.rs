//! Linha de comando do motor, para testar sem a interface:
//!   motor-cli arquivo...                                  (só inspeciona)
//!   motor-cli -f mxf [-r 48000] [-b 24] [-k 320] [-m] [-o pasta] [--fps 24000/1001] arquivo...

use std::path::PathBuf;
use std::process::ExitCode;
use std::sync::atomic::AtomicBool;

use motor::{Ferramentas, Fps, Opcoes};

const USO: &str = "uso: motor-cli [-f formato] [-r taxa] [-b bits] [-k kbps] [-m (separar em monos)] [-o pasta] [--fps 24000/1001] arquivo...";

fn main() -> ExitCode {
    let mut formato: Option<String> = None;
    let mut op = Opcoes { formato: motor::Formato::Wav, taxa: None, bits: 24, kbps: None, separar: false, destino: None, fps: Fps::new(24000, 1001, false) };
    let mut arquivos: Vec<PathBuf> = Vec::new();
    let mut args = std::env::args().skip(1);
    while let Some(a) = args.next() {
        let mut valor = || args.next().unwrap_or_default();
        match a.as_str() {
            "-f" => formato = Some(valor()),
            "-r" => op.taxa = valor().parse().ok(),
            "-b" => op.bits = valor().parse().unwrap_or(24),
            "-k" => op.kbps = valor().parse().ok(),
            "-m" => op.separar = true,
            "-o" => op.destino = Some(PathBuf::from(valor())),
            "--fps" => op.fps = Fps::ler(&valor(), false).unwrap_or(op.fps),
            // usado no teste da interface com dados simulados
            "--json-formatos" => {
                let v: Vec<_> = motor::VELOCIDADES.iter().map(|f| serde_json::json!({ "fps": f, "rotulo": f.rotulo() })).collect();
                println!("{}", serde_json::json!({ "formatos": motor::FORMATOS, "velocidades": v, "versao": env!("CARGO_PKG_VERSION"), "erro": null }));
                return ExitCode::SUCCESS;
            }
            "-h" | "--help" => {
                println!("{USO}");
                return ExitCode::SUCCESS;
            }
            _ => arquivos.push(PathBuf::from(a)),
        }
    }
    if arquivos.is_empty() {
        eprintln!("{USO}");
        return ExitCode::from(2);
    }
    if let Some(f) = &formato {
        match serde_json::from_value(serde_json::Value::String(f.to_lowercase())) {
            Ok(v) => op.formato = v,
            Err(_) => {
                eprintln!("formato desconhecido: {f}");
                return ExitCode::from(2);
            }
        }
    }
    let ferr = match Ferramentas::localizar(None) {
        Ok(f) => f,
        Err(e) => {
            eprintln!("ERRO: {e:#}");
            return ExitCode::FAILURE;
        }
    };
    let cancelar = AtomicBool::new(false);
    let mut ok = true;
    for a in &arquivos {
        let ins = match motor::inspecionar(&ferr, a, op.fps) {
            Ok(i) => i,
            Err(e) => {
                eprintln!("ERRO {}: {e:#}", a.display());
                ok = false;
                continue;
            }
        };
        let tc = ins.inicio.as_ref().map(|i| format!("TC {} @ {}", i.texto, i.fps.rotulo())).unwrap_or_else(|| "sem timecode".into());
        println!("{}: {} · {} canais [{}] · {} Hz · {:.2} s · {tc}", ins.nome, ins.descricao, ins.canais, ins.rotulos.join(" "), ins.sr, ins.duracao_s);
        if formato.is_none() {
            continue;
        }
        match motor::converter(&ferr, &ins, &op, &mut |_| {}, &cancelar) {
            Ok(r) => {
                for f in &r.arquivos {
                    println!("  → {f}");
                }
                for av in &r.avisos {
                    println!("  aviso: {av}");
                }
            }
            Err(e) => {
                eprintln!("ERRO {}: {e:#}", a.display());
                ok = false;
            }
        }
    }
    if ok { ExitCode::SUCCESS } else { ExitCode::FAILURE }
}
