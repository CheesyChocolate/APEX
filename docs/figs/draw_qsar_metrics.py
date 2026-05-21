"""
QSAR performance figure — activity probability distribution + ROC curve placeholder.
Reads docs/data/cox2_predictions.json produced by the pipeline run.
Run: cd docs/figs && python draw_qsar_metrics.py
"""
import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np

DATA = Path(__file__).parents[1] / "data" / "cox2_predictions.json"
OUT = Path(__file__).parent / "qsar_metrics.png"
BG = "#F8F9FA"


def main():
    if not DATA.exists():
        print(f"Data file not found: {DATA}")
        print("Run the QSAR pipeline first to generate data.")
        return

    with open(DATA) as f:
        data = json.load(f)

    preds = data["predictions"]
    probs = np.array([p["activity_probability"] for p in preds])
    actives = np.array([p["predicted_active"] for p in preds])

    fig, axes = plt.subplots(1, 2, figsize=(12, 5))
    fig.patch.set_facecolor(BG)
    for ax in axes:
        ax.set_facecolor(BG)

    # Left: probability distribution by class
    ax = axes[0]
    active_probs = probs[actives]
    inactive_probs = probs[~actives]
    ax.hist(inactive_probs, bins=30, alpha=0.7, color="#E74C3C", label=f"Inactive (n={len(inactive_probs)})")
    ax.hist(active_probs, bins=30, alpha=0.7, color="#2ECC71", label=f"Active (n={len(active_probs)})")
    ax.axvline(0.5, color="#333", linestyle="--", linewidth=1, label="Threshold (0.5)")
    ax.set_xlabel("Predicted Activity Probability", fontsize=11)
    ax.set_ylabel("Count", fontsize=11)
    ax.set_title("Activity Probability Distribution", fontsize=12, fontweight="bold")
    ax.legend(fontsize=9)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    # Right: top-N compound bar chart
    ax = axes[1]
    top = sorted(preds, key=lambda p: p["activity_probability"], reverse=True)[:20]
    xs = range(len(top))
    bar_colors = ["#2ECC71" if p["predicted_active"] else "#E74C3C" for p in top]
    ax.bar(xs, [p["activity_probability"] for p in top], color=bar_colors, edgecolor="white", linewidth=0.5)
    ax.axhline(0.5, color="#333", linestyle="--", linewidth=1, alpha=0.6)
    ax.set_xlabel("Compound Rank", fontsize=11)
    ax.set_ylabel("Activity Probability", fontsize=11)
    ax.set_title(f"Top-20 Predicted Actives\n({data['target_id']})", fontsize=12, fontweight="bold")
    ax.set_ylim(0, 1.05)
    ax.set_xticks(list(xs))
    ax.set_xticklabels([str(i + 1) for i in xs], fontsize=7)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)

    legend_items = [
        plt.Rectangle((0, 0), 1, 1, fc="#2ECC71", label="Active"),
        plt.Rectangle((0, 0), 1, 1, fc="#E74C3C", label="Inactive"),
    ]
    ax.legend(handles=legend_items, fontsize=9)

    plt.suptitle("QSAR Model Results — COX-2 (CHEMBL230)", fontsize=13, fontweight="bold", y=1.01)
    plt.tight_layout()
    plt.savefig(OUT, dpi=300, bbox_inches="tight", facecolor=BG)
    plt.close()
    print(f"Created: {OUT}")


if __name__ == "__main__":
    main()
