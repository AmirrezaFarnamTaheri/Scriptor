//! Malformed-frame exercise harness for property tests and `cargo fuzz`.

use std::io::Cursor;

use crate::{decode_request, read_frame, read_frame_resyncing, IpcError, MAX_FRAME_BYTES};

/// Exercises decode/read paths on arbitrary bytes. Must not panic.
pub fn exercise_read_path(data: &[u8]) {
    let _ = read_frame(&mut Cursor::new(data));
    let _ = read_frame_resyncing(&mut Cursor::new(data));
    if data.len() >= 8 {
        let _ = decode_request(data);
    }
}

struct Rng(u64);

impl Rng {
    fn new(seed: u64) -> Self {
        Self(seed)
    }

    fn next_u32(&mut self) -> u32 {
        self.0 = self.0.wrapping_mul(6_364_136_223_847_679_361).wrapping_add(1);
        (self.0 >> 32) as u32
    }

    fn next_usize(&mut self, upper_exclusive: usize) -> usize {
        if upper_exclusive == 0 {
            return 0;
        }
        (self.next_u32() as usize) % upper_exclusive
    }
}

/// Runs 10⁴ pseudo-random malformed frames; asserts bounded allocations and no panic.
pub fn run_malformed_frame_corpus(iterations: usize) {
    let mut rng = Rng::new(0x4152_434c);
    for _ in 0..iterations {
        let header_magic = rng.next_u32();
        let header_len = rng.next_u32();
        let extra_body = rng.next_usize(256);

        let mut frame = Vec::with_capacity(8 + extra_body);
        frame.extend_from_slice(&header_magic.to_le_bytes());
        frame.extend_from_slice(&header_len.to_le_bytes());
        for byte_index in 0..extra_body {
            frame.push((rng.next_u32() ^ byte_index as u32) as u8);
        }

        exercise_read_path(&frame);

        let frame_bytes = frame.clone();
        let mut cursor = Cursor::new(frame);
        if let Ok(body) = read_frame(&mut cursor) {
            assert!(
                body.capacity() <= MAX_FRAME_BYTES,
                "read_frame allocated {} bytes (cap {})",
                body.len(),
                body.capacity()
            );
        }

        let mut resync_cursor = Cursor::new(frame_bytes);
        if let Ok(body) = read_frame_resyncing(&mut resync_cursor) {
            assert!(
                body.capacity() <= MAX_FRAME_BYTES,
                "read_frame_resyncing allocated past cap"
            );
        }
    }
}

/// Returns whether an I/O error is an expected graceful disconnect.
pub fn is_expected_disconnect(error: &IpcError) -> bool {
    matches!(
        error,
        IpcError::Io(io) if matches!(
            io.kind(),
            std::io::ErrorKind::UnexpectedEof | std::io::ErrorKind::BrokenPipe | std::io::ErrorKind::ConnectionReset
        )
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn malformed_frame_corpus_10k() {
        run_malformed_frame_corpus(10_000);
    }
}
