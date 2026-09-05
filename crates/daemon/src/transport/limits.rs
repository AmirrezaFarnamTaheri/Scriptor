use std::sync::Arc;
use std::sync::atomic::{AtomicUsize, Ordering};

pub(super) const MAX_CONCURRENT_CONNECTIONS: usize = 32;
pub(super) const MAX_PREAUTH_CONNECTIONS: usize = 8;

#[derive(Clone)]
pub(super) struct ConnectionBudget {
    counter: Arc<AtomicUsize>,
    limit: usize,
}

impl ConnectionBudget {
    pub(super) fn new(limit: usize) -> Self {
        Self {
            counter: Arc::new(AtomicUsize::new(0)),
            limit,
        }
    }

    pub(super) fn current(&self) -> usize {
        self.counter.load(Ordering::SeqCst)
    }

    pub(super) fn try_acquire(&self) -> Option<ConnectionSlot> {
        let acquired = self
            .counter
            .fetch_update(Ordering::SeqCst, Ordering::SeqCst, |current| {
                (current < self.limit).then_some(current + 1)
            })
            .is_ok();
        acquired.then(|| ConnectionSlot {
            counter: Arc::clone(&self.counter),
        })
    }
}

pub(super) struct ConnectionSlot {
    pub(super) counter: Arc<AtomicUsize>,
}

impl ConnectionSlot {
    pub(super) fn release(self) {
        self.counter.fetch_sub(1, Ordering::SeqCst);
        std::mem::forget(self);
    }
}

impl Drop for ConnectionSlot {
    fn drop(&mut self) {
        self.counter.fetch_sub(1, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn budget_rejects_over_limit_and_recovers_on_drop() {
        let budget = ConnectionBudget::new(1);
        let slot = budget.try_acquire().expect("first slot");
        assert_eq!(budget.current(), 1);
        assert!(budget.try_acquire().is_none());
        slot.release();
        assert_eq!(budget.current(), 0);
        assert!(budget.try_acquire().is_some());
    }
}
