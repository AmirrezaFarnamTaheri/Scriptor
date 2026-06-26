use std::collections::VecDeque;
use std::time::{Duration, Instant};

/// Sliding-window rate limiter for per-connection RPC throughput.
#[derive(Debug)]
pub struct RateLimiter {
    window: Duration,
    max_events: u32,
    events: VecDeque<Instant>,
}

impl RateLimiter {
    pub fn per_second(max_events: u32) -> Self {
        Self {
            window: Duration::from_secs(1),
            max_events,
            events: VecDeque::new(),
        }
    }

    pub fn allow(&mut self) -> bool {
        let now = Instant::now();
        while self
            .events
            .front()
            .is_some_and(|instant| now.duration_since(*instant) >= self.window)
        {
            self.events.pop_front();
        }
        if self.events.len() >= self.max_events as usize {
            return false;
        }
        self.events.push_back(now);
        true
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn allows_burst_up_to_limit() {
        let mut limiter = RateLimiter::per_second(60);
        for _ in 0..60 {
            assert!(limiter.allow());
        }
        assert!(!limiter.allow());
    }

    #[test]
    fn refills_after_window() {
        let mut limiter = RateLimiter::per_second(2);
        assert!(limiter.allow());
        assert!(limiter.allow());
        assert!(!limiter.allow());
        thread::sleep(Duration::from_millis(1_100));
        assert!(limiter.allow());
    }
}
