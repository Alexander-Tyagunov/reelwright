"""Plate folder helpers (no bpy). A plate is <dir>/frames/0001.jpg... plus <dir>/tracks.json."""
import json
import os
import zipfile


def check_plate(plate_dir):
    """Compare frames on disk with tracks.json. Returns dict(ok, frames_on_disk, problems)."""
    problems = []
    tj = os.path.join(plate_dir, "tracks.json")
    fdir = os.path.join(plate_dir, "frames")
    names = sorted(n for n in os.listdir(fdir) if n.lower().endswith((".jpg", ".png"))) if os.path.isdir(fdir) else []
    if not os.path.isfile(tj):
        return {"ok": False, "frames_on_disk": len(names), "problems": ["tracks.json missing"]}
    with open(tj) as fh:
        t = json.load(fh)
    n = t.get("frames", 0)
    if len(names) != n:
        problems.append("frames on disk %d != tracks frames %d" % (len(names), n))
    for i in (t.get("first", 1), t.get("first", 1) + n - 1):
        if not os.path.isfile(os.path.join(plate_dir, t["frame_pattern"] % i)):
            problems.append("missing " + t["frame_pattern"] % i)
    for name, p in t.get("points", {}).items():
        for k in ("x", "y", "visible", "depth"):
            if len(p.get(k, [])) != n:
                problems.append("point %s.%s has %d values, want %d" % (name, k, len(p.get(k, [])), n))
    for e in t.get("events", []):
        if not 0 <= e["frame"] < n:
            problems.append("event %s frame %s out of range" % (e["name"], e["frame"]))
    return {"ok": not problems, "frames_on_disk": len(names), "problems": problems}


def pack_plate(plate_dir, zip_path=None):
    """Zip frames/ and tracks.json (stored, not recompressed) for transfer.

    Returns dict(zip, bytes, files). Paths inside the zip are relative to plate_dir.
    """
    plate_dir = os.path.abspath(plate_dir)
    zip_path = zip_path or plate_dir.rstrip("/") + ".zip"
    count = 0
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_STORED) as z:
        tj = os.path.join(plate_dir, "tracks.json")
        if os.path.isfile(tj):
            z.write(tj, "tracks.json")
            count += 1
        fdir = os.path.join(plate_dir, "frames")
        for n in sorted(os.listdir(fdir)):
            if n.lower().endswith((".jpg", ".png")):
                z.write(os.path.join(fdir, n), "frames/" + n)
                count += 1
    return {"zip": zip_path, "bytes": os.path.getsize(zip_path), "files": count}
