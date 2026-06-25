use keyring::Entry;

use crate::error::BridgeError;

const SERVICE_NAME: &str = "scriptor";

pub fn keychain_set(account: &str, secret: &str) -> Result<(), BridgeError> {
    let entry = Entry::new(SERVICE_NAME, account).map_err(|error| BridgeError::Keychain {
        message: error.to_string(),
    })?;
    entry
        .set_password(secret)
        .map_err(|error| BridgeError::Keychain {
            message: error.to_string(),
        })
}

pub fn keychain_get(account: &str) -> Result<Option<String>, BridgeError> {
    let entry = Entry::new(SERVICE_NAME, account).map_err(|error| BridgeError::Keychain {
        message: error.to_string(),
    })?;
    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(BridgeError::Keychain {
            message: error.to_string(),
        }),
    }
}

pub fn keychain_delete(account: &str) -> Result<(), BridgeError> {
    let entry = Entry::new(SERVICE_NAME, account).map_err(|error| BridgeError::Keychain {
        message: error.to_string(),
    })?;
    match entry.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(error) => Err(BridgeError::Keychain {
            message: error.to_string(),
        }),
    }
}
