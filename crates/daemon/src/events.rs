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
