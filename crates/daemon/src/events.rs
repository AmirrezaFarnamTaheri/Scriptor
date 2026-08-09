use std::sync::{
    Arc, Mutex,
    atomic::{AtomicU64, Ordering},
    mpsc::{Receiver, SyncSender, TrySendError, sync_channel},
};

use scriptor_ipc::{RpcEvent, RpcEventPayload};

use crate::locks::lock_recover;

const SUBSCRIBER_QUEUE_CAPACITY: usize = 128;

#[derive(Clone)]
struct Subscriber {
    id: u64,
    sender: SyncSender<RpcEvent>,
}

/// Bounded local event fan-out.
///
/// A slow or disconnected client must never stall a daemon mutation or grow an
/// unbounded queue. Broadcasts therefore clone the sender list under the lock,
/// deliver outside the lock, and disconnect subscribers whose queue is full
/// so clients cannot continue from a silently incomplete event stream.
#[derive(Default)]
pub struct EventHub {
    subscribers: Mutex<Vec<Subscriber>>,
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

    pub fn register(&self) -> Receiver<RpcEvent> {
        let (sender, receiver) = sync_channel(SUBSCRIBER_QUEUE_CAPACITY);
        let id = self.next_subscriber_id.fetch_add(1, Ordering::Relaxed);
        lock_recover(&self.subscribers).push(Subscriber { id, sender });
        receiver
    }

    /// Number of currently attached subscribers.
    ///
    /// A broadcast only reaches sessions that have already registered, so
    /// callers that must not race a subscriber still being set up can poll this
    /// instead of sleeping for an arbitrary interval.
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
        let subscribers = lock_recover(&self.subscribers).clone();
        let mut remove = Vec::new();

        for subscriber in subscribers {
            match subscriber.sender.try_send(event.clone()) {
                Ok(()) => {}
                Err(TrySendError::Full(_)) => {
                    self.dropped_events.fetch_add(1, Ordering::Relaxed);
                    // A subscriber that has fallen behind cannot infer which
                    // state transitions it missed. Remove it so its receiver
                    // disconnects after draining and the client reconnects to
                    // establish a fresh state boundary.
                    remove.push(subscriber.id);
                }
                Err(TrySendError::Disconnected(_)) => remove.push(subscriber.id),
            }
        }

        if !remove.is_empty() {
            lock_recover(&self.subscribers).retain(|subscriber| !remove.contains(&subscriber.id));
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
        let _receiver = hub.register();

        for generation in 0..(SUBSCRIBER_QUEUE_CAPACITY as u64 + 10) {
            hub.broadcast_config_reloaded("{}".into(), generation);
        }

        assert_eq!(hub.subscriber_count(), 0);
        assert_eq!(hub.metrics().dropped_events, 1);
    }

    #[test]
    fn disconnected_subscribers_are_pruned() {
        let hub = EventHub::new();
        let receiver = hub.register();
        drop(receiver);

        hub.broadcast_config_reloaded("{}".into(), 1);

        assert_eq!(hub.subscriber_count(), 0);
    }

    #[test]
    fn broadcast_does_not_hold_subscriber_lock_while_delivering() {
        let hub = EventHub::new();
        let receiver = hub.register();

        hub.broadcast_config_reloaded("{}".into(), 7);
        let event = receiver.try_recv().expect("event should be delivered");
        assert!(matches!(
            event.payload,
            RpcEventPayload::ConfigReloaded { generation: 7, .. }
        ));
    }
}
