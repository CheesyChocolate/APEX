"""
Docking scores figure — binding affinity distribution and ranked hit chart.
Reads docs/data/docking_results.json produced after docking run.
Run: cd docs/figs && python draw_docking_scores.py
"""

import json
from pathlib import Path

import matplotlib.patches as mpatches
import matplotlib.pyplot as plt
import numpy as np

DATA = Path(__file__).parents[1] / "data" / "docking_results.json"
OUT = Path(__file__).parent / "docking_scores.png"
BG = "#F8F9FA"


# Colour scale: green (very negative) → yellow → red (near zero)
def affinity_color(val: float) -> str:
    norm = min(max((val + 12) / 8, 0), 1)  # -12 → 0 (best), -4 → 1 (worst)
    r = int(norm * 220)
    g = int((1 - norm) * 180 + 40)
    return f"#{r:02x}{g:02x}40"


def main():
    if not DATA.exists():
        print(f"Data file not found: {DATA}")
        print("Run docking first to generate data.")
        return

    with open(DATA) as f:
        results = json.load(f)

    valid = [r for r in results if r.get("affinity_kcal_mol") is not None]
    if not valid:
        print("No valid docking results found.")
        return

    valid.sort(key=lambda r: r["affinity_kcal_mol"])
    affinities = np.array([r["affinity_kcal_mol"] for r in valid])

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.patch.set_facecolor(BG)
    for ax in axes:
        ax.set_facecolor(BG)

    # Left: histogram of binding affinities
    ax = axes[0]
    ax.hist(
        affinities,
        bins=20,
        color="#4A90D9",
        edgecolor="white",
        linewidth=0.5,
        alpha=0.85,
    )
    ax.axvline(
        np.median(affinities),
        color="#E74C3C",
        linestyle="--",
        linewidth=1.5,
        label=f"Median: {np.median(affinities):.1f} kcal/mol",
    )
    ax.set_xlabel("Binding Affinity (kcal/mol)", fontsize=11)
    ax.set_ylabel("Count", fontsize=11)
    ax.set_title("Affinity Distribution", fontsize=12, fontweight="bold")
    ax.legend(fontsize=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    # Right: top-20 ranked bar chart coloured by affinity
    ax = axes[1]
    top = valid[:20]
    xs = range(len(top))
    colors = [affinity_color(r["affinity_kcal_mol"]) for r in top]
    ax.bar(
        xs,
        [abs(r["affinity_kcal_mol"]) for r in top],
        color=colors,
        edgecolor="white",
        linewidth=0.5,
    )
    ax.set_xlabel("Rank", fontsize=11)
    ax.set_ylabel("|Binding Affinity| (kcal/mol)", fontsize=11)
    ax.set_title("Top-20 Docking Hits", fontsize=12, fontweight="bold")
    ax.set_xticks(list(xs))
    ax.set_xticklabels([str(i + 1) for i in xs], fontsize=7)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    legend_items = [
        mpatches.Patch(facecolor=affinity_color(-10), label="Strong (≤ -10)"),
        mpatches.Patch(facecolor=affinity_color(-7), label="Moderate (-7 to -10)"),
        mpatches.Patch(facecolor=affinity_color(-4), label="Weak (≥ -4)"),
    ]
    ax.legend(handles=legend_items, fontsize=8)

    plt.suptitle("Molecular Docking Results", fontsize=13, fontweight="bold", y=1.01)
    plt.tight_layout()
    plt.savefig(OUT, dpi=300, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"Created: {OUT}")


if __name__ == "__main__":
    main()
