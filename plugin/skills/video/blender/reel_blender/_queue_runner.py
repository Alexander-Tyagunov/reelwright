"""Runner of a render queue (see renderqueue.py). Started detached by renderqueue.ensure_runner; not imported.
Usage: python _queue_runner.py <queue_dir> <blender binary>   (or blender --background --python ... -- <same>)."""
import json
import os
import subprocess
import sys
import time

ARGS = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
QUEUE, BLENDER = os.path.abspath(ARGS[0]), ARGS[1]
HERE = os.path.dirname(os.path.abspath(__file__))
LOCK = os.path.join(QUEUE, "runner.lock")


def read(path, default=None):
    try:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)
    except Exception:
        return default


def write(path, data):
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=1)
    os.replace(tmp, path)


def alive(pid):
    try:
        os.kill(int(pid), 0)
        return True
    except PermissionError:
        return True
    except Exception:
        return False


def say(*a):
    print(time.strftime("%H:%M:%S"), *a, flush=True)


def take_lock():
    """One runner per queue: the lock file is created exclusively; a lock left by a dead runner is removed."""
    for _ in range(3):
        try:
            fd = os.open(LOCK, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump({"pid": os.getpid(), "started": time.time()}, fh)
            return True
        except FileExistsError:
            old = read(LOCK, {})
            if old.get("pid") and alive(old["pid"]):
                return False
            time.sleep(0.5)                      # give a runner that is just writing its lock time to finish
            old = read(LOCK, {})
            if not (old.get("pid") and alive(old["pid"])):
                try:
                    os.remove(LOCK)
                except OSError:
                    pass
    return False


def ids():
    d = os.path.join(QUEUE, "jobs")
    return sorted(int(n[:-5]) for n in os.listdir(d) if n.endswith(".json") and n[:-5].isdigit())


def paths(n):
    base = os.path.join(QUEUE, "jobs", "%04d" % n)
    return base + ".json", base + ".state"


def next_job():
    for n in ids():
        jp, sp = paths(n)
        st = read(sp, {"state": "queued"})
        if st["state"] == "rendering" and not alive(st.get("pid", -1)):
            st = {"state": "queued"}             # left over from a runner that died: take it up again (resume)
        if st["state"] == "queued":
            return n
    return None


def run(n):
    jp, sp = paths(n)
    job = read(jp)
    if job is None:
        write(sp, {"state": "error", "error": "unreadable job file"})
        return
    if not os.path.isfile(job["blend"]):
        write(sp, {"state": "error", "error": "missing " + job["blend"]})
        return
    write(job["progress"], {"state": "starting", "done": 0, "total": len(job["frames"]), "job": n,
            "started": time.time()})
    t0 = time.time()
    with open(job["log"], "a", encoding="utf-8") as log:
        proc = subprocess.Popen([BLENDER, "--background", job["blend"], "--python", os.path.join(HERE,
                "_bg_worker.py"), "--", jp],
                                stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
        write(sp, {"state": "rendering", "pid": proc.pid, "started": t0})
        say("job", n, job["name"], "started, pid", proc.pid)
        rc = proc.wait()
    pr = read(job["progress"], {})
    ok = rc == 0 and pr.get("state") == "done"
    write(sp, {"state": "done" if ok else "error", "started": t0, "finished": time.time(),
            "elapsed": round(time.time() - t0, 1),
               "returncode": rc, "sec_per_frame": pr.get("sec_per_frame"),
               "error": None if ok else (pr.get("error") or "exit %s" % rc)})
    say("job", n, job["name"], "done" if ok else "FAILED", "in", round(time.time() - t0), "s")


def main():
    while True:
        if not take_lock():
            say("another runner holds the lock; leaving")
            return
        say("runner", os.getpid(), "started")
        idle = 0
        try:
            while idle < 5:                       # five quiet seconds before leaving
                n = next_job()
                if n is None:
                    idle += 1
                    time.sleep(1.0)
                    continue
                idle = 0
                run(n)
        finally:
            try:
                os.remove(LOCK)
            except OSError:
                pass
        if next_job() is None:                    # a job submitted while the lock was being released is not lost
            say("queue empty; runner leaving")
            return


main()
