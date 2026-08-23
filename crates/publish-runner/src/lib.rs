//! Publish runner: frontmatter-gated publish planning and apply (W1-6, W1-8).
//!
//! # Flow
//!
//! 1. Call [`plan::plan_publish`] to get a read-only [`plan::PublishPlan`].
//! 2. Present all four buckets to the user via `PublishDiffView` (W1-7, frontend).
//! 3. Pass the user-approved subset to [`compile::publish_apply`].
//! 4. Persist [`compile::PublishApplyOutput::new_state`] as the new bucket state.

mod bounded_io;

pub mod compile;
pub mod error;
pub mod local_site;
pub mod plan;

pub use compile::{
    LocalDirSink, PublishApplyInput, PublishApplyOutput, SiteTemplate, publish_apply,
};
pub use error::PublishError;
pub use local_site::{
    PUBLISH_STATE_FILE, StarlightSite, apply_starlight_site, plan_starlight_site,
    resolve_output_path,
};
pub use plan::{BucketState, PublishCandidate, PublishPlan, PublishPlanOptions, plan_publish};
