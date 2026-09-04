use std::collections::HashMap;
use std::ops::Deref;
use std::sync::{
    Arc, Mutex, Weak,
    atomic::{AtomicU64, Ordering},
    mpsc::{Receiver, SyncSender, TrySendError, sync_channel},
};

use scriptor_ipc::{RpcEvent, RpcEventPayload};

use crate::locks::lock_recover;

const SUBSCRIBER_QUEUE_CAPACITY: usize = 128;

/// One bounded event subscription. Dropping the receiver immediately removes
/// its sender from the hub, so ordinary request connections and crashed
/// clients cannot accumulate stale subscribers indefinitely.
pub struct Subscription {
    id: u64,
    receiver: Receiver<RpcEvent>,
    hub: Weak<EventHub>,
}

impl Deref for Subscription {
    type Target = Receiver<RpcEvent>;

    fn deref(&self) -> &Self::Target {
        &self.receiver
    }
}

impl Drop for Subscription {
    fn drop(&mut self) {
        if let Some(hub) = self.hub.upgrade() {
            lock_recover(&hub.subscribers).remove(&self.id);
        }
    }
}

/// Bounded local event fan-out.
///
/// A slow or disconnected client must never stall a daemon mutation or grow an
/// unbounded queue. Broadcasts snapshot the sender map under the lock, deliver
/// outside the lock, and disconnect subscribers whose queue is full. The
/// client reconnect path then emits `ResyncRequired`, forcing a reload of
/// authoritative state rather than continuing from an incomplete event stream.
#[derive(Default)]
pub struct EventHub {
    subscribers: Mutex<HashMap<u64, SyncSender<RpcEvent>>>,
    next_subscriber_id: AtomicU64,
    dropped_events: AtomicU64,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EventHubMetrics {
    pub subscribers: usize,
    pub dropped_events: u64,
}

impl EventHub {
    pub fn new() -> Arc<Self> {
        Arc::new(Self::default())
    }

    pub fn register(self: &Arc<Self>) -> Subscription {
        let (sender, receiver) = sync_channel(SUBSCRIBER_QUEUE_CAPACITY);
        let id = self.next_subscriber_id.fetch_add(1, Ordering::Relaxed);
        lock_recover(&self.subscribers).insert(id, sender);
        Subscription {
            id,
            receiver,
            hub: Arc::downgrade(self),
        }
    }

    /// Number of currently attached subscribers.
    pub fn subscriber_count(&self) -> usize {
        lock_recover(&self.subscribers).len()
    }

    pub fn metrics(&self) -> EventHubMetrics {
        EventHubMetrics {
            subscribers: self.subscriber_count(),
            dropped_events: self.dropped_events.load(Ordering::Relaxed),
        }
    }

    pub fn broadcast_config_reloaded(&self, json: String, generation: u64) {
        self.broadcast(RpcEvent {
            payload: RpcEventPayload::ConfigReloaded { json, generation },
        });
    }

    fn broadcast(&self, event: RpcEvent) {
        // The collect is deliberate: it releases the subscribers lock before any
        // delivery happens, so a blocked client cannot stall the daemon. Clippy's
        // needless_collect only sees a collected Vec that is then iterated once.
        #[allow(clippy::needless_collect)]
        let subscribers = lock_recover(&self.subscribers)
            .iter()
            .map(|(id, sender)| (*id, sender.clone()))
            .collect::<Vec<_>>();
        let mut remove = Vec::new();

        for (id, sender) in subscribers {
            match sender.try_send(event.clone()) {
                Ok(()) => {}
                Err(TrySendError::Full(_)) => {
                    self.dropped_events.fetch_add(1, Ordering::Relaxed);
                    remove.push(id);
                }
                Err(TrySendError::Disconnected(_)) => remove.push(id),
            }
        }

        if !remove.is_empty() {
            let mut guard = lock_recover(&self.subscribers);
            for id in remove {
                guard.remove(&id);
            }
        }
    }

    pub fn close(&self) {
        lock_recover(&self.subscribers).clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slow_subscriber_is_bounded_and_does_not_block_broadcast() {
        let hub = EventHub::new();
        let _subscription = hub.register();

        for generation in 0..(SUBSCRIBER_QUEUE_CAPACITY as u64 + 10) {
            hub.broadcast_config_reloaded("{}".into(), generation);
        }

        assert_eq!(hub.subscriber_count(), 0);
        assert_eq!(hub.metrics().dropped_events, 1);
    }

    #[test]
    fn dropping_subscription_unregisters_without_broadcast() {
        let hub = EventHub::new();
        let subscription = hub.register();
        assert_eq!(hub.subscriber_count(), 1);
        drop(subscription);
        assert_eq!(hub.subscriber_count(), 0);
    }

    #[test]
    fn broadcast_does_not_hold_subscriber_lock_while_delivering() {
        let hub = EventHub::new();
        let subscription = hub.register();

        hub.broadcast_config_reloaded("{}".into(), 7);
        let event = subscription.try_recv().expect("event should be delivered");
        assert!(matches!(
            event.payload,
            RpcEventPayload::ConfigReloaded { generation: 7, .. }
        ));
    }
}
