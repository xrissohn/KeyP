from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
DOCS = ROOT / "docs"
BG = "#080D1A"
PANEL = "#111A2E"
PANEL_2 = "#17223B"
INK = "#F4F7FF"
MUTED = "#A9B6D2"
BLUE = "#6D8CFF"
CYAN = "#43D6C5"
PINK = "#FF6B8A"
GOLD = "#FFC857"
GREEN = "#55D98B"
RED = "#F36B7F"
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FONT_BOLD = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(FONT_BOLD if bold else FONT, size)


def rounded(draw: ImageDraw.ImageDraw, box, fill, outline=None, radius=22, width=2):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def centered(draw: ImageDraw.ImageDraw, box, text, fnt, fill=INK, spacing=8):
    x1, y1, x2, y2 = box
    bounds = draw.multiline_textbbox((0, 0), text, font=fnt, align="center", spacing=spacing)
    tw, th = bounds[2] - bounds[0], bounds[3] - bounds[1]
    draw.multiline_text(((x1 + x2 - tw) / 2, (y1 + y2 - th) / 2), text, font=fnt, fill=fill, align="center", spacing=spacing)


def arrow(draw: ImageDraw.ImageDraw, start, end, color=BLUE, width=5):
    draw.line([start, end], fill=color, width=width)
    x, y = end
    sx, sy = start
    if abs(x - sx) > abs(y - sy):
        sign = 1 if x > sx else -1
        points = [(x, y), (x - sign * 16, y - 10), (x - sign * 16, y + 10)]
    else:
        sign = 1 if y > sy else -1
        points = [(x, y), (x - 10, y - sign * 16), (x + 10, y - sign * 16)]
    draw.polygon(points, fill=color)


def save_interactions():
    image = Image.new("RGB", (1800, 1200), BG)
    draw = ImageDraw.Draw(image)
    draw.text((80, 50), "KeyP GPT-5.6 Signal Swarm", font=font(48, True), fill=INK)
    draw.text((82, 112), "Small specialists, parallel fan-outs, deterministic product gates", font=font(24), fill=MUTED)

    rounded(draw, (90, 180, 440, 305), PANEL, BLUE)
    centered(draw, (90, 180, 440, 305), "Natural-language\ninterest", font(27, True))
    rounded(draw, (590, 170, 1210, 315), PANEL_2, BLUE)
    centered(draw, (590, 170, 1210, 315), "GPT-5.6 Manager\nIntentRefiner  →  QueryDecomposer", font(27, True))
    arrow(draw, (440, 242), (590, 242))

    rounded(draw, (80, 370, 1720, 630), PANEL, CYAN)
    draw.text((115, 395), "PARALLEL SEARCH FAN-OUT", font=font(22, True), fill=CYAN)
    scouts = ["Official", "Breaking", "Social", "Video", "Community", "Korea"]
    for index, label in enumerate(scouts):
        x1 = 115 + index * 255
        rounded(draw, (x1, 455, x1 + 220, 555), PANEL_2, CYAN, 16)
        centered(draw, (x1, 455, x1 + 220, 555), f"{label} Scout\nPerplexity", font(20, True))
    rounded(draw, (460, 570, 1340, 615), "#0E2A2A", CYAN, 14)
    centered(draw, (460, 570, 1340, 615), "Public adapters · Bluesky · Hacker News · GDELT · optional SearXNG / RSS", font(18, True), CYAN)
    arrow(draw, (900, 315), (900, 370), CYAN)

    rounded(draw, (610, 685, 1190, 790), PANEL_2, GOLD)
    centered(draw, (610, 685, 1190, 790), "DETERMINISTIC URL GATE\nDNS · redirects · private IP · status · soft-404", font(21, True))
    arrow(draw, (900, 630), (900, 685), GOLD)

    rounded(draw, (145, 850, 1655, 1015), PANEL, PINK)
    draw.text((180, 872), "PARALLEL GPT-5.6 JUDGES", font=font(21, True), fill=PINK)
    judges = [("Credibility", 180), ("Relevance", 550), ("Freshness", 920), ("Novelty", 1290)]
    for label, x1 in judges:
        rounded(draw, (x1, 925, x1 + 300, 990), PANEL_2, PINK, 15)
        centered(draw, (x1, 925, x1 + 300, 990), label, font(22, True))
    arrow(draw, (900, 790), (900, 850), PINK)

    rounded(draw, (310, 1070, 710, 1160), PANEL_2, GREEN)
    centered(draw, (310, 1070, 710, 1160), "Deterministic\nFusion Ranker", font(22, True))
    rounded(draw, (870, 1070, 1270, 1160), PANEL_2, BLUE)
    centered(draw, (870, 1070, 1270, 1160), "GPT-5.6\nMultilingualEditor", font(22, True))
    rounded(draw, (1430, 1070, 1710, 1160), "#173024", GREEN)
    centered(draw, (1430, 1070, 1710, 1160), "Verified alerts", font(22, True), GREEN)
    arrow(draw, (755, 1015), (510, 1070), GREEN)
    arrow(draw, (710, 1115), (870, 1115), BLUE)
    arrow(draw, (1270, 1115), (1430, 1115), GREEN)
    image.save(DOCS / "agent-interactions.png", quality=95)


def save_sequence():
    image = Image.new("RGB", (1800, 1120), BG)
    draw = ImageDraw.Draw(image)
    draw.text((80, 50), "One KeyP alert sweep", font=font(48, True), fill=INK)
    draw.text((82, 112), "The two fan-outs reduce wall time; deterministic gates remain serial", font=font(24), fill=MUTED)
    names = ["Client / API", "GPT-5.6 Manager", "Source Swarm", "URL Gate", "4 GPT-5.6 Judges", "Editor / Delivery"]
    colors = [BLUE, BLUE, CYAN, GOLD, PINK, GREEN]
    centers = [150, 450, 750, 1050, 1350, 1650]
    for name, color, x in zip(names, colors, centers):
        rounded(draw, (x - 125, 180, x + 125, 250), PANEL_2, color, 15)
        centered(draw, (x - 125, 180, x + 125, 250), name, font(18, True))
        draw.line((x, 250, x, 1040), fill="#33415F", width=3)

    events = [
        (150, 450, 315, "interest + known alerts", BLUE),
        (450, 750, 405, "6 lane tasks", CYAN),
        (750, 750, 485, "6 scouts + adapters in parallel", CYAN),
        (750, 1050, 575, "normalized candidates", GOLD),
        (1050, 1350, 665, "reachable exact URLs", PINK),
        (1350, 1350, 755, "4 independent scores in parallel", PINK),
        (1350, 1650, 845, "fused top candidates", GREEN),
        (1650, 150, 945, "alerts + steps + metrics", GREEN),
    ]
    for start_x, end_x, y, label, color in events:
        arrow(draw, (start_x, y), (end_x, y), color, 4)
        box = draw.textbbox((0, 0), label, font=font(17, True))
        width = box[2] - box[0]
        draw.rectangle((min(start_x, end_x) + (abs(end_x - start_x) - width) / 2 - 8, y - 30,
                        min(start_x, end_x) + (abs(end_x - start_x) + width) / 2 + 8, y - 7), fill=BG)
        draw.text((min(start_x, end_x) + (abs(end_x - start_x) - width) / 2, y - 30), label, font=font(17, True), fill=color)

    rounded(draw, (630, 445, 870, 525), "#0E2A2A", CYAN, 14)
    centered(draw, (630, 445, 870, 525), "Promise.all\nsearch fan-out", font(17, True), CYAN)
    rounded(draw, (1230, 715, 1470, 795), "#321827", PINK, 14)
    centered(draw, (1230, 715, 1470, 795), "Promise.all\njudge fan-out", font(17, True), PINK)
    rounded(draw, (930, 525, 1170, 615), "#332B16", GOLD, 14)
    centered(draw, (930, 525, 1170, 615), "Reject dead / unsafe\nsource URLs", font(17, True), GOLD)
    rounded(draw, (1530, 805, 1770, 885), "#173024", GREEN, 14)
    centered(draw, (1530, 805, 1770, 885), "Translate text only\nnever rewrite URL", font(17, True), GREEN)
    image.save(DOCS / "agent-sequence.png", quality=95)


if __name__ == "__main__":
    DOCS.mkdir(parents=True, exist_ok=True)
    save_interactions()
    save_sequence()
