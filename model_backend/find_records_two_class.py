import numpy as np
import torch
from collections import defaultdict
from pathlib import Path
import csv
import sys

# Import project helpers
sys.path.insert(0, str(Path(__file__).parent))
from model_utils import load_model, preprocess_data_records, predict_probabilities, NODEModel

# Config
BASE = Path(__file__).parent
METADATA_PATH = "metadata.csv"
RECORDS_PATH = "Records"
MODEL_PATH = "Two_Class_Models/saved_models/NODE_PSR_two_class_best.pth"
INPUT_DIM = 138
NUM_CLASSES = 2
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
BATCH_SIZE = 1024

print('Using:')
print(' METADATA_PATH ->', METADATA_PATH)
print(' RECORDS_PATH ->', RECORDS_PATH)
print(' MODEL_PATH ->', MODEL_PATH)
print(' DEVICE ->', DEVICE)

# Load model
print('Loading model...')
model = load_model(NODEModel, MODEL_PATH, INPUT_DIM, NUM_CLASSES)
model.to(DEVICE)
model.eval()

# Preprocess data
print('Preprocessing data (this may take a while)...')
X, aligned_record_ids = preprocess_data_records(METADATA_PATH, RECORDS_PATH, record_limit=30)
print('Preprocess done. X shape =', getattr(X, 'shape', None))

# Scale input
try:
    X = X / 1000.0
except Exception:
    pass

# Batch prediction
print('Running model predictions in batches...')
import torch.nn.functional as F

probs_list = []
with torch.no_grad():
    for i in range(0, len(X), BATCH_SIZE):
        batch = torch.tensor(X[i:i+BATCH_SIZE], dtype=torch.float32, device=DEVICE)
        out = model(batch)
        probs_batch = F.softmax(out, dim=1).cpu().numpy()
        probs_list.append(probs_batch)

probs = np.concatenate(probs_list, axis=0)
print('Predictions done. probs shape =', probs.shape)

# Aggregate per-record (AF class = index 1)
rec_probs = defaultdict(list)
for i, rid in enumerate(aligned_record_ids):
    rec_probs[rid].append(float(probs[i, 1]))

# ---- Compute summary using MAX ----
summary = []
for rid, vals in rec_probs.items():
    arr = np.array(vals)

    max_prob = float(arr.max())       # <--- USE MAX HERE
    mean_prob = float(arr.mean())
    p95_prob = float(np.percentile(arr, 95))
    count_above = int((arr > 0.5).sum())

    summary.append((rid, len(arr), max_prob, mean_prob, p95_prob, count_above))

# ---- Threshold for MAX ----
THRESHOLD = 0.68     # adjust if needed

safe_records = [r for r in summary if r[2] < THRESHOLD]
danger_records = [r for r in summary if r[2] >= THRESHOLD]

# Save CSV
csv_path = BASE / 'demo_record_scores_max.csv'
with open(csv_path, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['record_id', 'n_windows', 'max_prob', 'mean_prob', 'p95_prob', 'count_above_0.5'])
    for row in summary:
        writer.writerow(row)

# Print results
print(f"\nTotal records: {len(summary)}")
print(f"Safe records  (<{THRESHOLD} max): {len(safe_records)}")
print(f"Danger records (≥{THRESHOLD} max): {len(danger_records)}")

print("\n--- Some safe records ---")
for r in sorted(safe_records, key=lambda x: x[2])[:10]:
    print(r)

print("\n--- Some dangerous records ---")
for r in sorted(danger_records, key=lambda x: x[2], reverse=True)[:10]:
    print(r)

# Print ALL max values
print("\n=== ALL RECORD MAX VALUES ===")
for r in sorted(summary, key=lambda x: x[2], reverse=True):
    print(f"{r[0]} → max = {r[2]:.4f}")

print('\nSaved CSV to', csv_path)
print('Done.')
