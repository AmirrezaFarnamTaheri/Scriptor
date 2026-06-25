use regex::Regex;
use serde_json::Value;

static REDACTION_PATTERNS: &[(&str, &str)] = &[
    (r"(?i)Bearer\s+\S+", "Bearer [REDACTED]"),
    (r"(?i)(api[_-]?key|token|secret|password)\s*[:=]\s*\S+", "$1=[REDACTED]"),
    (r"sk-[A-Za-z0-9]{8,}", "sk-[REDACTED]"),
];

pub fn redact_sensitive_text(input: &str) -> String {
    let mut output = input.to_string();
    for (pattern, replacement) in REDACTION_PATTERNS {
        let re = Regex::new(pattern).expect("valid redaction regex");
        output = re.replace_all(&output, *replacement).into_owned();
    }
    output
}

pub fn redact_json_value(value: &Value) -> Value {
    match value {
        Value::String(text) => Value::String(redact_sensitive_text(text)),
        Value::Array(items) => Value::Array(items.iter().map(redact_json_value).collect()),
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, item)| {
                    let redacted_key = redact_sensitive_text(key);
                    let redacted_item = {
                        let key_lower = key.to_ascii_lowercase();
                        if key_lower.contains("token")
                            || key_lower.contains("secret")
                            || key_lower.contains("password")
                            || key_lower.ends_with("_key")
                            || key_lower == "api_key"
                        {
                            Value::String("[REDACTED]".into())
                        } else {
                            redact_json_value(item)
                        }
                    };
                    (redacted_key, redacted_item)
                })
                .collect(),
        ),
        other => other.clone(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_bearer_tokens() {
        let input = "Authorization: Bearer abc123secret";
        assert!(redact_sensitive_text(input).contains("[REDACTED]"));
        assert!(!redact_sensitive_text(input).contains("abc123secret"));
    }

    #[test]
    fn redacts_api_key_fields_in_json() {
        let value = serde_json::json!({ "api_key": "super-secret", "note": "hello" });
        let redacted = redact_json_value(&value);
        assert_eq!(redacted["api_key"], "[REDACTED]");
        assert_eq!(redacted["note"], "hello");
    }
}
