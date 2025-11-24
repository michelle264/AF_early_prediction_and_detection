import numpy as np
import torch
from collections import defaultdict
import torch.nn.functional as F
from pathlib import Path
import sys
from model_utils import load_model, preprocess_data_records, predict_probabilities, NODEModel

# --- Config ---
BASE = Path(__file__).parent
METADATA_PATH = "metadata.csv"
RECORDS_PATH = "Records"
MODEL_PATH = "Three_Class_Models/saved_models/NODE_PSR_best.pth"
INPUT_DIM = 138
NUM_CLASSES = 3
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
BATCH_SIZE = 1024

print("Using:")
print(" METADATA_PATH ->", METADATA_PATH)
print(" RECORDS_PATH  ->", RECORDS_PATH)
print(" MODEL_PATH    ->", MODEL_PATH)
print(" DEVICE        ->", DEVICE)

# --- Load model ---
print("\nLoading model...")
model = load_model(NODEModel, MODEL_PATH, INPUT_DIM, NUM_CLASSES)
model.to(DEVICE)
model.eval()

# --- Preprocess ---
print("Preprocessing data...")
X, record_ids = preprocess_data_records(METADATA_PATH, RECORDS_PATH, record_limit=30)
print("Preprocess done. X shape =", getattr(X, "shape", None))

# Scale (same as your main pipeline)
try:
    X = X / 1000.0
except Exception:
    pass

# --- Predict ---
print("Running model predictions in batches...")
probs_list = []
with torch.no_grad():
    for i in range(0, len(X), BATCH_SIZE):
        batch = torch.tensor(X[i:i + BATCH_SIZE], dtype=torch.float32, device=DEVICE)
        out = model(batch)
        probs_batch = F.softmax(out, dim=1).cpu().numpy()
        probs_list.append(probs_batch)

probs = np.concatenate(probs_list, axis=0)
print("Predictions done. probs shape =", probs.shape)

# --- Aggregate per-record P(SR) ---
rec_sr_probs = defaultdict(list)
for i, rid in enumerate(record_ids):
    p_sr = float(probs[i, 0])      # SR class probability
    rec_sr_probs[rid].append(p_sr)

# --- Compute summary using P25(SR) ---
summary = []
for rid, vals in rec_sr_probs.items():
    arr_sr = np.array(vals)

    min_sr     = float(np.min(arr_sr))
    mean_sr    = float(np.mean(arr_sr))
    median_sr  = float(np.median(arr_sr))
    p25_sr     = float(np.percentile(arr_sr, 25))   # <-- key statistic
    p05_sr     = float(np.percentile(arr_sr, 5))

    risk_score = 1.0 - p25_sr                       # <-- RISK = 1 - p25(SR)

    summary.append({
        "record_id": rid,
        "num_windows": len(arr_sr),
        "min_sr": min_sr,
        "mean_sr": mean_sr,
        "median_sr": median_sr,
        "p25_sr": p25_sr,
        "p05_sr": p05_sr,
        "risk_score": risk_score
    })

# --- Classification using risk_score ---
THRESHOLD = 0.54   # try 0.54 first; can test 0.53 / 0.55 too

safe_records   = [s for s in summary if s["risk_score"] < THRESHOLD]
danger_records = [s for s in summary if s["risk_score"] >= THRESHOLD]

print(f"\nTotal records: {len(summary)}")
print(f"Safe records   (risk < {THRESHOLD}): {len(safe_records)}")
print(f"Danger records (risk ≥ {THRESHOLD}): {len(danger_records)}")

print("\n--- Some safe records ---")
for s in sorted(safe_records, key=lambda x: x["risk_score"])[:10]:
    print(
        s["record_id"],
        "risk =", f"{s['risk_score']:.4f}",
        "| p25_sr =", f"{s['p25_sr']:.4f}"
    )

print("\n--- Some dangerous records ---")
for s in sorted(danger_records, key=lambda x: x["risk_score"], reverse=True)[:10]:
    print(
        s["record_id"],
        "risk =", f"{s['risk_score']:.4f}",
        "| p25_sr =", f"{s['p25_sr']:.4f}"
    )

print("\n=== ALL RECORD RISK SCORES (1 - p25 SR) ===")
for s in sorted(summary, key=lambda x: x["risk_score"], reverse=True):
    print(
        f"{s['record_id']} → risk = {s['risk_score']:.4f}, "
        f"p25_sr = {s['p25_sr']:.4f}"
    )
