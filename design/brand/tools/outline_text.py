#!/usr/bin/env python3
"""Dev-only: converts a string set in Poppins to SVG path data (text to outlines) for the standalone brand files.

    pip install fonttools
    python3 design/brand/tools/outline_text.py <weight> <font-size> <tracking-em> "<text>"

Prints JSON: {"d": "<path data, baseline at y=0, x starting at 0>", "width": <advance width in px>, "capHeight": ..., "xHeight": ...}.
Fonts come from the self-hosted @fontsource/poppins package (WOFF, zlib), so no network access is needed.
"""
import json
import sys

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

weight, size, tracking, text = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), sys.argv[4]
font = TTFont(f"node_modules/@fontsource/poppins/files/poppins-latin-{weight}-normal.woff")
upm = font["head"].unitsPerEm
cmap = font.getBestCmap()
glyphs = font.getGlyphSet()
hmtx = font["hmtx"]
scale = size / upm
os2 = font["OS/2"]

pen = SVGPathPen(glyphs, ntos=lambda v: f"{v:.2f}".rstrip("0").rstrip("."))
x = 0.0
for i, ch in enumerate(text):
    name = cmap[ord(ch)]
    glyphs[name].draw(TransformPen(pen, (scale, 0, 0, -scale, x, 0)))
    x += hmtx[name][0] * scale
    if i < len(text) - 1:
        x += tracking * size

print(json.dumps({
    "d": pen.getCommands(),
    "width": round(x, 2),
    "capHeight": round(os2.sCapHeight * scale, 2),
    "xHeight": round(os2.sxHeight * scale, 2),
}))
