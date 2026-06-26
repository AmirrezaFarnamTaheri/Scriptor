#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    if data.len() >= 8 {
        let _ = scriptor_ipc::decode_request(data);
    }
    scriptor_ipc::fuzz_corpus::exercise_read_path(data);
});
