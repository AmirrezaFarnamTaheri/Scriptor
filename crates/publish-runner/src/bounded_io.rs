use std::fs::File;
use std::io::Read;
use std::path::Path;

use crate::error::PublishError;

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum BoundedRead {
    Bytes(Vec<u8>),
    TooLarge { observed_bytes: u64 },
}

/// Read at most `limit + 1` bytes from a regular file-sized input.
///
/// Callers often have metadata from an earlier planning pass, but a local file
/// can grow between that check and the read. Opening the file first and using a
/// bounded `take` keeps the allocation capped even under that TOCTOU race.
pub(crate) fn read_bounded(
    path: &Path,
    display_path: &str,
    limit: u64,
) -> Result<BoundedRead, PublishError> {
    let mut file = File::open(path).map_err(|source| PublishError::Io {
        path: display_path.to_string(),
        source,
    })?;
    let initial_len = file
        .metadata()
        .map_err(|source| PublishError::Io {
            path: display_path.to_string(),
            source,
        })?
        .len();
    if initial_len > limit {
        return Ok(BoundedRead::TooLarge {
            observed_bytes: initial_len,
        });
    }

    let mut bytes = Vec::with_capacity(initial_len as usize);
    {
        let mut bounded = (&mut file).take(limit.saturating_add(1));
        bounded
            .read_to_end(&mut bytes)
            .map_err(|source| PublishError::Io {
                path: display_path.to_string(),
                source,
            })?;
    }

    if bytes.len() as u64 > limit {
        let final_len = file
            .metadata()
            .map_err(|source| PublishError::Io {
                path: display_path.to_string(),
                source,
            })?
            .len();
        return Ok(BoundedRead::TooLarge {
            observed_bytes: final_len.max(bytes.len() as u64),
        });
    }

    Ok(BoundedRead::Bytes(bytes))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn bounded_read_rejects_files_over_limit_without_loading_them() {
        let temp = TempDir::new().unwrap();
        let path = temp.path().join("large.bin");
        let file = File::create(&path).unwrap();
        file.set_len(1025).unwrap();

        let result = read_bounded(&path, "large.bin", 1024).unwrap();
        assert!(matches!(
            result,
            BoundedRead::TooLarge {
                observed_bytes: 1025
            }
        ));
    }
}
