"""
Pipeline architecture figure — full APEX workflow from target selection to ranked hits.
Run: cd docs/figs && python draw_pipeline.py
"""

from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt

OUT = Path(__file__).parent / "pipeline.png"

COLORS = {
    "input": "#4A90D9",
    "data": "#7B68EE",
    "qsar": "#2ECC71",
    "dock": "#E67E22",
    "output": "#E74C3C",
    "arrow": "#555555",
    "bg": "#F8F9FA",
}

STEPS = [
    ("Target\nSelection", COLORS["input"]),
    ("ChEMBL\nBioactivity\nFetch", COLORS["data"]),
    ("Preprocessing\n(SMILES val.\nIC50 → label)", COLORS["data"]),
    ("QSAR\nScreening\n(RF Classifier)", COLORS["qsar"]),
    ("Structure\nFetch\n(AlphaFold/PDB)", COLORS["dock"]),
    ("Molecular\nDocking\n(AutoDock Vina)", COLORS["dock"]),
    ("Ranked\nHit List", COLORS["output"]),
]

CACHE_LABEL = "SQLite\nCache"
QSAR_DETAIL = "Morgan FP\n+ Descriptors\n→ RF model"

fig, ax = plt.subplots(figsize=(14, 5))
ax.set_xlim(0, 14)
ax.set_ylim(0, 5)
ax.set_aspect("equal")
ax.axis("off")
fig.patch.set_facecolor(COLORS["bg"])
ax.set_facecolor(COLORS["bg"])

BOX_W, BOX_H = 1.5, 1.1
Y_CENTER = 2.5
X_START = 0.5
X_GAP = 1.9


def draw_box(ax, x, y, label, color, fontsize=8.5):
    rect = mpatches.FancyBboxPatch(
        (x - BOX_W / 2, y - BOX_H / 2),
        BOX_W,
        BOX_H,
        boxstyle="round,pad=0.08",
        facecolor=color,
        edgecolor="white",
        linewidth=1.5,
        zorder=3,
    )
    ax.add_patch(rect)
    ax.text(
        x,
        y,
        label,
        ha="center",
        va="center",
        fontsize=fontsize,
        color="white",
        fontweight="bold",
        zorder=4,
        linespacing=1.3,
    )


def draw_arrow(ax, x1, x2, y):
    ax.annotate(
        "",
        xy=(x2 - BOX_W / 2, y),
        xytext=(x1 + BOX_W / 2, y),
        arrowprops=dict(arrowstyle="-|>", color=COLORS["arrow"], lw=1.5),
        zorder=2,
    )


xs = [X_START + i * X_GAP for i in range(len(STEPS))]
for i, ((label, color), x) in enumerate(zip(STEPS, xs)):
    draw_box(ax, x, Y_CENTER, label, color)
    if i < len(STEPS) - 1:
        draw_arrow(ax, x, xs[i + 1], Y_CENTER)

# Cache annotation under ChEMBL box
cache_x, cache_y = xs[1], Y_CENTER - 1.35
rect_c = mpatches.FancyBboxPatch(
    (cache_x - 0.65, cache_y - 0.3),
    1.3,
    0.6,
    boxstyle="round,pad=0.05",
    facecolor="#95A5A6",
    edgecolor="white",
    linewidth=1,
    zorder=3,
)
ax.add_patch(rect_c)
ax.text(
    cache_x,
    cache_y,
    CACHE_LABEL,
    ha="center",
    va="center",
    fontsize=7.5,
    color="white",
    fontweight="bold",
    zorder=4,
)
ax.annotate(
    "",
    xy=(xs[1], Y_CENTER - BOX_H / 2),
    xytext=(cache_x, cache_y + 0.3),
    arrowprops=dict(arrowstyle="<->", color="#95A5A6", lw=1.2),
    zorder=2,
)

# QSAR detail annotation
qsar_x = xs[3]
ax.text(
    qsar_x,
    Y_CENTER + 1.1,
    QSAR_DETAIL,
    ha="center",
    va="bottom",
    fontsize=7,
    color="#555",
    style="italic",
    linespacing=1.3,
)
ax.annotate(
    "",
    xy=(qsar_x, Y_CENTER + BOX_H / 2),
    xytext=(qsar_x, Y_CENTER + 0.85),
    arrowprops=dict(arrowstyle="-", color="#AAA", lw=1),
    zorder=2,
)

# Title
ax.text(
    7,
    4.7,
    "APEX Pipeline",
    ha="center",
    va="top",
    fontsize=13,
    fontweight="bold",
    color="#333",
)

# Legend
legend_items = [
    mpatches.Patch(facecolor=COLORS["input"], label="User Input"),
    mpatches.Patch(facecolor=COLORS["data"], label="Data Layer"),
    mpatches.Patch(facecolor=COLORS["qsar"], label="QSAR"),
    mpatches.Patch(facecolor=COLORS["dock"], label="Docking"),
    mpatches.Patch(facecolor=COLORS["output"], label="Output"),
]
ax.legend(
    handles=legend_items,
    loc="lower right",
    fontsize=7.5,
    framealpha=0.8,
    ncol=5,
    bbox_to_anchor=(1.0, 0.0),
)

plt.tight_layout()
plt.savefig(OUT, dpi=300, bbox_inches="tight", facecolor=COLORS["bg"])
plt.close()
print(f"Created: {OUT}")
