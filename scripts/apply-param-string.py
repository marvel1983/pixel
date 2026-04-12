#!/usr/bin/env python3
"""Replace req.params.foo with paramString(req.params, "foo") in api-server routes."""
import re
from pathlib import Path

ROUTES = Path(__file__).resolve().parents[1] / "artifacts/api-server/src/routes"
IMPORT_LINE = 'import { paramString } from "../lib/route-params";\n'
PARAM_RE = re.compile(r"\breq\.params\.([a-zA-Z_][a-zA-Z0-9_]*)\b")


def add_import(content: str) -> str:
    if 'from "../lib/route-params"' in content:
        return content
    lines = content.splitlines(keepends=True)
    # Insert immediately before `const router` so we never split a multi-line import.
    for i, line in enumerate(lines):
        if "const router = Router()" in line:
            lines.insert(i, IMPORT_LINE)
            return "".join(lines)
    return IMPORT_LINE + content


def main() -> None:
    for path in sorted(ROUTES.glob("*.ts")):
        text = path.read_text()
        if "req.params." not in text:
            continue
        new = PARAM_RE.sub(lambda m: f'paramString(req.params, "{m.group(1)}")', text)
        if new == text:
            continue
        if "paramString(" in new:
            new = add_import(new)
        path.write_text(new)
        print(path.name)


if __name__ == "__main__":
    main()
