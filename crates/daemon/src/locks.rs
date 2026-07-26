//! Poison-tolerant mutex helpers.
//!
//! A daemon that dies permanently because one request handler panicked is worse
//! than one that degrades: `Mutex::lock` returns `Err` forever once a guard is
//! dropped during an unwind, so every subsequent RPC would panic too. Every lock
//! in this crate therefore recovers the guard instead of propagating poisoning.
//! The protected state is either rebuilt on the next request or is plain data
//! whose worst case is a stale field, so continuing to serve is the safer choice.

use std::sync::{Mutex, MutexGuard, PoisonError};

/// Locks `mutex`, recovering the inner guard if a previous holder panicked.
pub fn lock_recover<T: ?Sized>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(PoisonError::into_inner)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;

    #[test]
    fn recovers_guard_after_poisoning() {
        let value = Arc::new(Mutex::new(1u32));
        let poisoner = Arc::clone(&value);
        let handle = std::thread::spawn(move || {
            let mut guard = lock_recover(&poisoner);
            *guard = 2;
            panic!("poison the lock");
        });
        assert!(handle.join().is_err(), "helper thread should have panicked");
        assert!(value.lock().is_err(), "mutex should be poisoned");

        // The whole point: the next caller still gets usable state.
        let mut guard = lock_recover(&value);
        assert_eq!(*guard, 2);
        *guard = 3;
        drop(guard);
        assert_eq!(*lock_recover(&value), 3);
    }
}
