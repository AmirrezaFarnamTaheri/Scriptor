# Unix process-group timeout review — 2026-10-04

## Observed failure

At revision `890ac2777f0f1ea78856f2d3bcdeb56c46ce9d1f`, the hosted
[Rust workspace job](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37202257167/job/111436785271)
reported eight passing system-bridge unit tests and one failure:
`timeout_stops_term_ignoring_descendant_after_leader_exits`. Its descendant
heartbeat grew from 157 to 164 bytes during the 150 ms observation after the
timeout returned. Continued writes establish a surviving descendant, rather
than a delayed reader-thread join or a harmless zombie process.

## Source finding and correction

Unix launch configuration creates a dedicated process group. Teardown sent
`kill -TERM -<group>` followed by `kill -KILL -<group>`. The negative operand
was not separated from option parsing. The
[procps implementation](https://raw.githubusercontent.com/warmchang/procps/master/src/kill.c)
continues through `getopt_long` after recognizing the shorthand signal; its
special handling of negative arguments differs from the normal PID loop.
The [kill utility documentation](https://man7.org/linux/man-pages/man1/kill.1.html)
also documents the ambiguity between negative signal options and group PIDs.

Both commands now include the explicit `--` option terminator, making the
negative value unambiguously a process-group operand. TERM-to-KILL escalation,
its 250 ms grace, direct-child fallback, output-drain bounds, and the existing
heartbeat equality regression remain unchanged. No assertion was weakened and
no extra delay was added to make the test pass.

The argument-parsing defect is supported by source inspection. The unchanged
descendant-heartbeat regression subsequently passed in the Rust workspace lane
of [CI 37206096340](https://github.com/AmirrezaFarnamTaheri/Scriptor/actions/runs/37206096340)
at `7f2539bd08bf44249a6a3a45a2adbd8b1bec8800`. Formatting, checking and Clippy
also passed there; the separate desktop workers passed on all three platforms.

## Verification boundary

The scoped Git whitespace check passed. No local build, test, installation,
fixture process, or runtime workload was started. GitHub must rerun Rust
formatting, checking, Clippy, and the workspace tests, including the unchanged
descendant-heartbeat regression. Desktop compilation should remain green on
Linux, macOS, and Windows. If the heartbeat still changes, preserve the failed
assertion and investigate the runner's signal delivery and process-group
membership instead of extending sleeps or relaxing equality.
