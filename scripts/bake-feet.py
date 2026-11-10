"""Bake the airborne frames' foot offsets (scripts/measure-feet.mjs) into
assets/manifest.json, keeping the manifest's Python JSON style.
    node scripts/measure-feet.mjs --json | python3 scripts/bake-feet.py"""
import json, sys, pathlib
path = pathlib.Path(__file__).resolve().parent.parent / "assets" / "manifest.json"
manifest = json.loads(path.read_text())
for d in manifest.values():
    if isinstance(d, dict) and isinstance(d.get("frames"), list):
        for f in d["frames"]:
            if isinstance(f, dict):
                f.pop("foot", None)
for q in json.loads(sys.stdin.read()):
    manifest[q["sheet"]]["frames"][q["frame"]]["foot"] = q["foot"]
path.write_text(json.dumps(manifest, indent=2) + "\n")
