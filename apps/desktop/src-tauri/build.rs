use std::{fs, path::PathBuf};

// Generate a minimal valid Windows .ico for the development shell.
// Replace with approved Vantora brand assets before production packaging.
fn ensure_development_icon() -> std::io::Result<()> {
    let icon_path = PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("icons/icon.ico");
    if icon_path.exists() { return Ok(()); }
    fs::create_dir_all(icon_path.parent().expect("icon directory"))?;

    const SIZE: usize = 32;
    const XOR_BYTES: usize = SIZE * SIZE * 4;
    const AND_BYTES: usize = SIZE * 4; // 32 pixels / 8 bits, aligned to 4 bytes
    const HEADER_BYTES: usize = 40;
    const IMAGE_BYTES: usize = HEADER_BYTES + XOR_BYTES + AND_BYTES;
    let mut ico = Vec::with_capacity(6 + 16 + IMAGE_BYTES);
    ico.extend_from_slice(&0u16.to_le_bytes()); // reserved
    ico.extend_from_slice(&1u16.to_le_bytes()); // icon
    ico.extend_from_slice(&1u16.to_le_bytes()); // image count
    ico.extend_from_slice(&[SIZE as u8, SIZE as u8, 0, 0]);
    ico.extend_from_slice(&1u16.to_le_bytes()); // color planes
    ico.extend_from_slice(&32u16.to_le_bytes()); // bits per pixel
    ico.extend_from_slice(&(IMAGE_BYTES as u32).to_le_bytes());
    ico.extend_from_slice(&22u32.to_le_bytes()); // image data offset

    // BITMAPINFOHEADER: doubled height accounts for XOR and AND masks.
    ico.extend_from_slice(&40u32.to_le_bytes());
    ico.extend_from_slice(&(SIZE as i32).to_le_bytes());
    ico.extend_from_slice(&((SIZE * 2) as i32).to_le_bytes());
    ico.extend_from_slice(&1u16.to_le_bytes());
    ico.extend_from_slice(&32u16.to_le_bytes());
    ico.extend_from_slice(&0u32.to_le_bytes());
    ico.extend_from_slice(&(XOR_BYTES as u32).to_le_bytes());
    ico.extend_from_slice(&0i32.to_le_bytes());
    ico.extend_from_slice(&0i32.to_le_bytes());
    ico.extend_from_slice(&0u32.to_le_bytes());
    ico.extend_from_slice(&0u32.to_le_bytes());

    for y in 0..SIZE {
        for x in 0..SIZE {
            let in_mark = (x as i32 - 16).abs() + (y as i32 - 16).abs() < 12;
            let (r, g, b) = if in_mark { (194, 252, 90) } else { (13, 18, 29) };
            ico.extend_from_slice(&[b, g, r, 255]);
        }
    }
    ico.resize(6 + 16 + IMAGE_BYTES, 0); // opaque AND mask
    fs::write(icon_path, ico)
}

fn main() {
    ensure_development_icon().expect("failed to create development Windows icon");
    tauri_build::build();
}
