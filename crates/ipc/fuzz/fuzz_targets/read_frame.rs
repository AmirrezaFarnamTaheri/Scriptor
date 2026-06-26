#![no_main]

use libfuzzer_sys::fuzz_target;

fuzz_target!(|data: &[u8]| {
    scriptor_ipc::fuzz_corpus::exercise_read_path(data);
});
