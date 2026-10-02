"""Private mailbox protocol; launched exclusively by Scriptor's process broker."""
import contextlib
import io
import json
import os
import pathlib
import sys
import threading
import time
import traceback

root = pathlib.Path(sys.argv[1])
CAPTURE_LIMIT = 120 * 1024
PLOT_LIMIT = 4 * 1024 * 1024
namespace = {"__name__": "__main__"}
current = None
capture_lock = threading.Lock()

def write_json(name, value):
    target = root / name
    temporary = target.with_suffix(target.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False)
    os.replace(temporary, target)

class Capture(io.TextIOBase):
    def __init__(self):
        self.parts = []
        self.size = 0
        self.truncated = False
    def write(self, text):
        encoded = str(text).encode("utf-8", errors="replace")
        with capture_lock:
            remaining = max(0, CAPTURE_LIMIT - self.size)
            accepted = encoded[:remaining].decode("utf-8", errors="ignore")
            if accepted:
                self.parts.append(accepted)
            self.size += len(accepted.encode("utf-8"))
            self.truncated |= len(encoded) > remaining
        return len(text)
    def text(self):
        return "".join(self.parts) + ("\n[Output truncated]" if self.truncated else "")
    def flush(self):
        pass

def progress_worker():
    while True:
        time.sleep(0.2)
        with capture_lock:
            running = current
            if running is not None:
                value = {"run_id": running[0], "stdout": running[1].text(), "stderr": running[2].text()}
            else:
                continue
        try:
            write_json("progress.json", value)
        except OSError:
            pass

write_json("ready.json", {"python_version": sys.version.split()[0], "executable": sys.executable})
threading.Thread(target=progress_worker, daemon=True).start()
while True:
    request_path = root / "request.json"
    if not request_path.exists():
        time.sleep(0.03)
        continue
    with request_path.open("r", encoding="utf-8") as stream:
        request = json.load(stream)
    request_path.unlink()
    run_id = request["id"]
    stdout, stderr = Capture(), Capture()
    plots = []
    def display_png(data):
        if not isinstance(data, bytes) or not data.startswith(b"\x89PNG\r\n\x1a\n") or len(data) > PLOT_LIMIT or len(plots) >= 3:
            raise ValueError("Display accepts at most three PNG images of 4 MiB each")
        name = run_id + "-" + str(len(plots)) + ".png"
        with (root / name).open("xb") as stream:
            stream.write(data)
        plots.append(name)
    namespace["scriptor_display_png"] = display_png
    with capture_lock:
        current = (run_id, stdout, stderr)
    started = time.monotonic()
    exit_code = 0
    with contextlib.redirect_stdout(stdout), contextlib.redirect_stderr(stderr):
        try:
            exec(compile(request["code"], "<Scriptor cell>", "exec"), namespace, namespace)
        except BaseException:
            exit_code = 1
            traceback.print_exc()
        try:
            pyplot = sys.modules.get("matplotlib.pyplot")
            if pyplot is not None:
                for number in pyplot.get_fignums()[:max(0, 3 - len(plots))]:
                    buffer = io.BytesIO()
                    pyplot.figure(number).savefig(buffer, format="png")
                    display_png(buffer.getvalue())
                pyplot.close("all")
        except BaseException:
            traceback.print_exc()
    variables = []
    for name, value in list(namespace.items()):
        if name.startswith("_") or name == "scriptor_display_png" or len(variables) >= 64:
            continue
        kind = type(value)
        try:
            preview = str(value)[:200] if kind in (str, int, float, bool, type(None)) else "(" + kind.__name__ + ")"
        except BaseException:
            preview = "(value unavailable)"
        variables.append({"name": name[:128], "type": kind.__name__[:128], "value": preview})
    with capture_lock:
        current = None
        result = {"exit_code": exit_code, "stdout": stdout.text(), "stderr": stderr.text(), "duration_ms": int((time.monotonic() - started) * 1000), "variables": variables, "plots": plots}
    write_json(run_id + ".json", result)
