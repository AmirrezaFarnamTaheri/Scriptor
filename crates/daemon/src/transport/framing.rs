//! Deadline-bounded frame I/O for the daemon's local transport.
//!
//! [`crate::transport`]'s connection loop drives a nonblocking local socket, so
//! every frame read or write has to tolerate `WouldBlock` without discarding
//! partial progress. That polling adapter and the encode-then-write helpers
//! live here so the transport module stays about RPC rather than socket
//! mechanics.

use std::io::{self, Read, Write};
use std::time::{Duration, Instant};

use scriptor_ipc::{
    IpcError, RpcError, RpcEvent, RpcResponse, RpcResult, ServerMessage, encode_server_message,
    read_frame,
};

/// Budget for a single response or event write once the frame is encoded.
const WRITE_TIMEOUT: Duration = Duration::from_secs(10);

/// Poll a nonblocking local-socket stream until I/O succeeds or the absolute
/// deadline expires. Keeping the partial progress inside `Read::read`/
/// `Write::write` means `read_exact` and `write_all` can safely use this
/// adapter without restarting a partially consumed frame.
pub(super) struct DeadlineIo<'a, T> {
    inner: &'a mut T,
    deadline: Instant,
}

impl<'a, T> DeadlineIo<'a, T> {
    pub(super) fn new(inner: &'a mut T, timeout: Duration) -> Self {
        Self {
            inner,
            deadline: Instant::now() + timeout,
        }
    }

    pub(super) fn wait_or_timeout(&self) -> io::Result<()> {
        if Instant::now() >= self.deadline {
            return Err(io::Error::new(
                io::ErrorKind::TimedOut,
                "local IPC deadline exceeded",
            ));
        }
        std::thread::sleep(Duration::from_millis(2));
        Ok(())
    }
}

impl<T: Read> Read for DeadlineIo<'_, T> {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        loop {
            match self.inner.read(buf) {
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                    self.wait_or_timeout()?
                }
                result => return result,
            }
        }
    }
}

impl<T: Write> Write for DeadlineIo<'_, T> {
    fn write(&mut self, buf: &[u8]) -> io::Result<usize> {
        if buf.is_empty() {
            return Ok(0);
        }
        // The local-socket backend requests 512-byte Windows pipe buffers.
        // A larger PIPE_NOWAIT write may make no progress even on an empty pipe.
        let buf = if cfg!(windows) {
            &buf[..buf.len().min(512)]
        } else {
            buf
        };
        loop {
            match self.inner.write(buf) {
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                    self.wait_or_timeout()?
                }
                // PIPE_NOWAIT reports a full output buffer as a zero-byte write.
                Ok(0) if cfg!(windows) => self.wait_or_timeout()?,
                result => return result,
            }
        }
    }

    fn flush(&mut self) -> io::Result<()> {
        loop {
            match self.inner.flush() {
                Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                    self.wait_or_timeout()?
                }
                result => return result,
            }
        }
    }
}

pub(super) fn read_frame_with_timeout<R: Read>(
    reader: &mut R,
    timeout: Duration,
) -> Result<Vec<u8>, IpcError> {
    let mut io = DeadlineIo::new(reader, timeout);
    read_frame(&mut io)
}

pub(super) fn write_encoded_with_timeout<W: Write>(
    writer: &mut W,
    frame: &[u8],
    timeout: Duration,
) -> Result<(), IpcError> {
    let mut io = DeadlineIo::new(writer, timeout);
    io.write_all(frame).map_err(IpcError::from)?;
    io.flush().map_err(IpcError::from)
}

pub(super) fn write_response_with_timeout<W: Write>(
    writer: &mut W,
    response: RpcResponse,
) -> Result<(), IpcError> {
    let frame = match encode_server_message(&ServerMessage::Response(response.clone())) {
        Ok(frame) => frame,
        Err(IpcError::FrameTooLarge(size)) => {
            encode_server_message(&ServerMessage::Response(RpcResponse {
                id: response.id,
                result: RpcResult::Error(RpcError::with_code(
                    "rpc.payload_too_large",
                    format!("response exceeds local IPC frame budget ({size} bytes)"),
                    false,
                )),
            }))?
        }
        Err(error) => return Err(error),
    };
    write_encoded_with_timeout(writer, &frame, WRITE_TIMEOUT)
}

pub(super) fn write_event_with_timeout<W: Write>(
    writer: &mut W,
    event: RpcEvent,
) -> Result<(), IpcError> {
    let frame = match encode_server_message(&ServerMessage::Event(event)) {
        Ok(frame) => frame,
        Err(IpcError::FrameTooLarge(_)) => {
            encode_server_message(&ServerMessage::Event(RpcEvent {
                payload: scriptor_ipc::RpcEventPayload::ResyncRequired {
                    reason: "event exceeded local IPC frame budget".into(),
                },
            }))?
        }
        Err(error) => return Err(error),
    };
    write_encoded_with_timeout(writer, &frame, WRITE_TIMEOUT)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;

    #[test]
    fn a_permanently_full_pipe_reaches_its_write_deadline() {
        let mut storage = [];
        let mut writer = io::Cursor::new(&mut storage[..]);
        let result =
            write_encoded_with_timeout(&mut writer, b"response", Duration::from_millis(10));
        assert!(
            matches!(result, Err(IpcError::Io(error)) if error.kind() == io::ErrorKind::TimedOut)
        );
    }

    #[test]
    fn zero_byte_pipe_writes_preserve_progress_until_the_buffer_drains() {
        #[derive(Default)]
        struct BackpressuredWriter {
            bytes: Vec<u8>,
            full: bool,
        }
        impl Write for BackpressuredWriter {
            fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
                if bytes.len() > 512 {
                    return Ok(0);
                }
                self.full = !self.full;
                if self.full {
                    return Ok(0);
                }
                let count = bytes.len().min(512);
                self.bytes.extend_from_slice(&bytes[..count]);
                Ok(count)
            }
            fn flush(&mut self) -> io::Result<()> {
                Ok(())
            }
        }
        let mut writer = BackpressuredWriter::default();
        let response = vec![42; 4096];
        write_encoded_with_timeout(&mut writer, &response, Duration::from_secs(1)).unwrap();
        assert_eq!(writer.bytes, response);
    }
}
