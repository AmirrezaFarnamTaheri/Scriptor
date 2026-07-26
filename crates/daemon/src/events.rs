use std::sync::{Arc, Mutex};

use scriptor_ipc::{RpcEvent, RpcEventPayload};

use crate::locks::lock_recover;

#[derive(Default)]
pub struct EventHub {
    subscribers: Mutex<Vec<std::sync::mpsc::Sender<RpcEvent>>>,
}

impl EventHub {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn register(&self) -> std::sync::mpsc::Receiver<RpcEvent> {
        let (tx, rx) = std::sync::mpsc::channel();
        lock_recover(&self.subscribers).push(tx);
        rx
    }

    /// Number of currently attached subscribers.
    ///
    /// A broadcast only reaches sessions that have already registered, so
    /// callers that must not race a subscriber still being set up (tests
    /// waiting for a reconnected event listener, for instance) can poll this
    /// instead of sleeping for an arbitrary interval.
    pub fn subscriber_count(&self) -> usize {
        lock_recover(&self.subscribers).len()
    }

    pub fn broadcast_config_reloaded(&self, json: String, generation: u64) {
        let event = RpcEvent {
            payload: RpcEventPayload::ConfigReloaded { json, generation },
        };
        let mut subscribers = lock_recover(&self.subscribers);
        subscribers.retain(|tx| tx.send(event.clone()).is_ok());
    }

    pub fn close(&self) {
        lock_recover(&self.subscribers).clear();
    }
}
