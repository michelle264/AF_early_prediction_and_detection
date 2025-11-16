import numpy as np
import torch
from collections import defaultdict
from pathlib import Path
import csv
import sys
import torch.nn.functional as F

# Import project helpers
sys.path.insert(0, str(Path(__file__).parent))
from model_utils import load_model, preprocess_data_records, predict_probabilities, NODEModel

# --- Config ---
BASE = Path(__file__).parent
METADATA_PATH = "metadata.csv"
RECORDS_PATH = "Records"
MODEL_PATH = "Three_Class_Models/saved_models/NODE_PSR_best.pth"
INPUT_DIM = 138
NUM_CLASSES = 3
DEVICE = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
BATCH_SIZE = 1024  # reduce if memory runs out

print('Using:')
print(' METADATA_PATH ->', METADATA_PATH)
print(' RECORDS_PATH ->', RECORDS_PATH)
print(' MODEL_PATH ->', MODEL_PATH)
print(' DEVICE ->', DEVICE)

# --- Load model ---
print('Loading model...')
model = load_model(NODEModel, MODEL_PATH, INPUT_DIM, NUM_CLASSES)
model.to(DEVICE)
model.eval()

# --- Preprocess data ---
print('Preprocessing data (this may take a while)...')
X, aligned_record_ids = preprocess_data_records(METADATA_PATH, RECORDS_PATH, record_limit=30)
print('Preprocess done. X shape =', getattr(X, 'shape', None))

# Optional scaling
try:
    X = X / 1000.0
except Exception:
    pass

# --- Restrict to last 30 unique records for demo ---
unique_records = list(dict.fromkeys(aligned_record_ids))
selected_records = set(unique_records[:30])
selected_indices = [i for i, rid in enumerate(aligned_record_ids) if rid in selected_records]
X = X[selected_indices]
aligned_record_ids = [aligned_record_ids[i] for i in selected_indices]
print(f'Using first {len(selected_records)} records only.')

# --- Safe batch prediction ---
print('Running model predictions in batches...')
probs_list = []
with torch.no_grad():
    for i in range(0, len(X), BATCH_SIZE):
        batch = torch.tensor(X[i:i+BATCH_SIZE], dtype=torch.float32, device=DEVICE)
        out = model(batch)
        probs_batch = F.softmax(out, dim=1).cpu().numpy()
        probs_list.append(probs_batch)

probs = np.concatenate(probs_list, axis=0)
print('Predictions done. probs shape =', probs.shape)

# --- Aggregate per-record (Danger = 1 - P(SR)) ---
rec_probs = defaultdict(list)
for i, rid in enumerate(aligned_record_ids):
    p_sr = float(probs[i, 0])  # SR class index = 0
    p_danger = 1.0 - p_sr
    rec_probs[rid].append(p_danger)

# --- Summarize per record (using p95) ---
summary = []
for rid, vals in rec_probs.items():
    arr = np.array(vals)
    summary.append((
        rid,
        int(len(arr)),
        float(np.mean(arr)),        # mean danger
        float(np.percentile(arr, 95)),  # 95th percentile danger
        int((arr >= 0.47).sum())   # count of danger windows above threshold
    ))

# --- Save CSV ---
csv_path = BASE / 'demo_record_scores_three_class_p95.csv'
with open(csv_path, 'w', newline='') as f:
    writer = csv.writer(f)
    writer.writerow(['record_id', 'n_windows', 'mean_prob_danger', 'p95_prob_danger', 'count_above_0.47'])
    for row in summary:
        writer.writerow(row)

# --- Sort and print ---
top_by_p95 = sorted(summary, key=lambda x: x[3], reverse=True)[:30]
bottom_by_p95 = sorted(summary, key=lambda x: x[3])[:30]

print('\nTop 30 by 95th percentile danger probability:')
for r in top_by_p95:
    print(r)

print('\nBottom 30 by 95th percentile danger probability:')
for r in bottom_by_p95:
    print(r)

print('\nSaved CSV to', csv_path)
print('Done.')
