//! Motor do Destila. Toda a lógica (inspecionar e converter áudio) fica aqui, sem nada de interface,
//! para poder ser testada sozinha (`cargo test -p motor`) e usada pela linha de comando (`motor-cli`).
//!
//! O trabalho pesado é feito por programas externos embutidos no app: ffmpeg/ffprobe (ler e gravar
//! qualquer formato) e raw2bmx (MXF OP-Atom do Avid).

pub mod conversao;
pub mod ferramentas;
pub mod formatos;
pub mod inspecao;
pub mod timecode;
pub mod wav;

pub use conversao::{converter, n_saidas, Opcoes, Resultado};
pub use ferramentas::Ferramentas;
pub use formatos::{Formato, InfoFormato, FORMATOS};
pub use inspecao::{inspecionar, Inspecao};
pub use timecode::{Fps, VELOCIDADES};
