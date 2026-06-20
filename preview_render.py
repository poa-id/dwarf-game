"""
One-off preview tool — NOT part of the actual game. Mirrors the logic in
src/render/palette.ts and src/render/testScene.ts in Python+Pillow so we
can eyeball PNG output without a browser. The real game renders via
HTML canvas in TypeScript; this script exists purely for design review.
"""
from PIL import Image, ImageDraw, ImageFont

FONT_PATH = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
CELL_SIZE = 22
COLS, ROWS = 40, 20

GLYPHS = {
    "void": " ",
    "rock_wall": "#",
    "rock_floor": "\u00b7",
    "ore_copper": "o",
    "ore_iron": "O",
    "ore_deep": "\u25c6",
    "dwarf": "@",
    "hearth": "\u2665",
    "forge": "n",
    "tunnel_edge": "%",
}

STAGE_0 = {
    "background": "#000000",
    "colors": {k: "#9a9a9a" for k in GLYPHS.keys()},
}
STAGE_0["colors"]["void"] = "#000000"

STAGE_1 = {
    "background": STAGE_0["background"],
    "colors": {**STAGE_0["colors"], "hearth": "#ff5a1a", "forge": "#c44a14"},
}
STAGE_2 = {
    "background": "#160a05",
    "colors": {
        "void": "#160a05", "rock_wall": "#6b5640", "rock_floor": "#3a2e22",
        "ore_copper": "#d4894a", "ore_iron": "#9aa3ad", "ore_deep": "#7060c0",
        "dwarf": "#f0c896", "hearth": "#ff8c3a", "forge": "#d4661f", "tunnel_edge": "#4a3a2a",
    },
}
STAGE_3 = {
    "background": "#1c2128",
    "colors": {
        "void": "#1c2128", "rock_wall": "#5a6472", "rock_floor": "#343a42",
        "ore_copper": "#e0884a", "ore_iron": "#c8d2dc", "ore_deep": "#9d6fef",
        "dwarf": "#f5dcb0", "hearth": "#ffaa44", "forge": "#e0701f", "tunnel_edge": "#454d56",
    },
}
STAGES = [STAGE_0, STAGE_1, STAGE_2, STAGE_3]
STAGE_LABELS = ["The Dark", "First Ember", "Hearthlight", "True Color"]


def stamp(grid, sprite_rows, origin_col, origin_row):
    for sr, row in enumerate(sprite_rows):
        for sc, kind in enumerate(row):
            if kind is None:
                continue
            grid[origin_row + sr][origin_col + sc] = kind


FORGE_BUILDING = [
    [None, "rock_wall", "rock_wall", None],
    ["rock_wall", "forge", "forge", "rock_wall"],
    ["rock_wall", "forge", "forge", "rock_wall"],
    [None, "rock_wall", "rock_wall", None],
]

CAVE_LURKER = [
    [None, "rock_wall"],
    ["rock_wall", "rock_wall"],
    ["rock_wall", "rock_wall"],
    [None, "rock_wall"],
]


def build_test_scene(cols, rows):
    grid = [["void"] * cols for _ in range(rows)]

    def set_cell(c, r, kind):
        if 0 <= c < cols and 0 <= r < rows:
            grid[r][c] = kind

    for c in range(cols):
        set_cell(c, 0, "rock_wall")
        set_cell(c, rows - 1, "rock_wall")
    for r in range(rows):
        set_cell(0, r, "rock_wall")
        set_cell(cols - 1, r, "rock_wall")

    for r in range(1, rows - 1):
        for c in range(1, cols - 1):
            set_cell(c, r, "rock_floor")

    ore_spots = [
        (8, 5, "ore_copper"), (12, 8, "ore_iron"),
        (20, 12, "ore_iron"), (30, 6, "ore_deep"), (15, 14, "ore_copper"),
    ]
    for c, r, kind in ore_spots:
        set_cell(c, r, kind)

    set_cell(4, 8, "hearth")
    set_cell(10, 10, "dwarf")

    stamp(grid, FORGE_BUILDING, 2, 2)
    stamp(grid, CAVE_LURKER, 33, 9)

    return grid


def render_stage(grid, stage_def, out_path):
    width, height = COLS * CELL_SIZE, ROWS * CELL_SIZE
    img = Image.new("RGB", (width, height), stage_def["background"])
    draw = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT_PATH, int(CELL_SIZE * 0.8))

    for r in range(ROWS):
        for c in range(COLS):
            kind = grid[r][c]
            if kind == "void":
                continue
            glyph = GLYPHS[kind]
            color = stage_def["colors"][kind]
            x = c * CELL_SIZE + CELL_SIZE / 2
            y = r * CELL_SIZE + CELL_SIZE / 2
            bbox = draw.textbbox((0, 0), glyph, font=font)
            tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
            draw.text((x - tw / 2 - bbox[0], y - th / 2 - bbox[1]), glyph, font=font, fill=color)

    img.save(out_path)


if __name__ == "__main__":
    scene = build_test_scene(COLS, ROWS)
    for stage_def, label in zip(STAGES, STAGE_LABELS):
        idx = STAGES.index(stage_def)
        out = f"/home/claude/dwarf-game/preview_stage{idx}_{label.replace(' ', '_').lower()}.png"
        render_stage(scene, stage_def, out)
        print(f"saved {out}")
