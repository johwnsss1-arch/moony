use std::io::Write;

fn main() {
    let conf: serde_json::Value = serde_json::from_str(&std::fs::read_to_string("../src-tauri/tauri.conf.json").unwrap()).unwrap();
    println!("cargo:rustc-env=MOONY_VERSION={}", conf["version"].as_str().unwrap());
    println!("cargo:rerun-if-changed=../src-tauri/tauri.conf.json");

    let exe = std::env::var("MOONY_EXE").unwrap_or("../src-tauri/target/release/moony.exe".into());
    println!("cargo:rerun-if-changed={exe}");
    println!("cargo:rerun-if-env-changed=MOONY_EXE");
    let bytes = std::fs::read(&exe).expect("build Moony first (src-tauri/target/release/moony.exe)");
    let out = std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("moony.zip");
    let mut z = zip::ZipWriter::new(std::fs::File::create(out).unwrap());
    let opt = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated).compression_level(Some(9));
    z.start_file("moony.exe", opt).unwrap();
    z.write_all(&bytes).unwrap();
    z.finish().unwrap();

    tauri_build::build()
}
