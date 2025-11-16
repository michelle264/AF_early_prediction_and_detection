import numpy as np
import pandas as pd
import torch
from Dataset_preparation.record import Record, create_record

# --- Model classes for NODE ---
import torch.nn as nn
import torch.nn.functional as F
from torchdiffeq import odeint

class ODEFunc(nn.Module):
    def __init__(self, dim):
        super(ODEFunc, self).__init__()
        self.net = nn.Sequential(
            nn.Linear(dim, 64),
            nn.Tanh(),
            nn.Linear(64, dim)
        )

    def forward(self, t, x):
        return self.net(x)

class NODEModel(nn.Module):
    def __init__(self, dim, num_classes):
        super(NODEModel, self).__init__()
        self.odefunc = ODEFunc(dim)
        self.classifier = nn.Sequential(
            nn.Linear(dim, 64),
            nn.ReLU(),
            nn.Linear(64, num_classes)
        )

    def forward(self, x):
        # x: (batch, features) — treat as initial state
        t = torch.tensor([0.0, 1.0], dtype=x.dtype, device=x.device)
        out = odeint(self.odefunc, x, t)[-1]
        return self.classifier(out)

def phase_space_reconstruct(x, m=3, tau=2):
    """
    x: 1D array of RRI
    m: embedding dimension
    tau: time delay
    Returns flattened PSR embedding: x(t), x(t+tau), ..., x(t+(m-1)*tau)
    """
    x = np.asarray(x)
    N = len(x)
    if N < (m-1)*tau + 1:
        # pad with zeros if too short
        x = np.pad(x, (0, (m-1)*tau + 1 - N), 'constant')
        N = len(x)
    psr_vectors = [x[i:N-(m-1)*tau + i] for i in range(m)]
    psr_flat = np.column_stack(psr_vectors).flatten()
    return psr_flat


def preprocess_data(metadata_path, records_dir, window_size=50, step_size=5, m=3, tau=2):
    """
    For each record in metadata.csv, segment RRI into overlapping windows, extract PSR features for each window.
    Returns X (features for all windows), record_ids (one per window).
    """
    import traceback
    metadata_df = pd.read_csv(metadata_path)
    feature_rows = []
    record_ids = []

    for record_id in metadata_df["record_id"]:
        try:
            record = create_record(record_id, metadata_df, records_dir)
            record.load_rr_record()
            rri = np.concatenate(record.rr)
            n = len(rri)
            # Sliding window segmentation
            for start in range(0, n - window_size + 1, step_size):
                end = start + window_size
                window = rri[start:end]
                if len(window) < window_size:
                    window = np.pad(window, (0, window_size - len(window)), 'constant')
                psr = phase_space_reconstruct(window, m=m, tau=tau)
                feature_rows.append(psr)
                record_ids.append(record_id)
            # If record is too short, pad and add one window
            if n < window_size:
                window = np.pad(rri, (0, window_size - n), 'constant')
                psr = phase_space_reconstruct(window, m=m, tau=tau)
                feature_rows.append(psr)
                record_ids.append(record_id)
        except Exception as e:
            print(f"Skipping record {record_id}: {e}")
            traceback.print_exc()
            continue

    if len(feature_rows) == 0:
        raise ValueError("No valid records processed. Check zip file structure or metadata.")

    X = np.stack(feature_rows).astype(np.float32)
    record_ids = np.array(record_ids)
    return X, record_ids

def preprocess_data_records(metadata_path, records_dir, window_size=50, step_size=5, m=3, tau=2, record_limit=None):
    """
    For each record in metadata.csv, segment RRI into overlapping windows,
    extract PSR features for each window.
    Returns X (features for all windows), record_ids (one per window).
    Optional: record_limit limits how many records to process (for demo/debug).
    """
    import traceback
    metadata_df = pd.read_csv(metadata_path)

    # --- Add record limit here ---
    if record_limit is not None:
        metadata_df = metadata_df.head(record_limit)
        print(f"[INFO] Limiting to first {record_limit} records for processing.")

    feature_rows = []
    record_ids = []

    for record_id in metadata_df["record_id"]:
        try:
            record = create_record(record_id, metadata_df, records_dir)
            record.load_rr_record()
            rri = np.concatenate(record.rr)
            n = len(rri)

            # Sliding window segmentation
            for start in range(0, n - window_size + 1, step_size):
                end = start + window_size
                window = rri[start:end]
                if len(window) < window_size:
                    window = np.pad(window, (0, window_size - len(window)), 'constant')
                psr = phase_space_reconstruct(window, m=m, tau=tau)
                feature_rows.append(psr)
                record_ids.append(record_id)

            # If record is too short, pad and add one window
            if n < window_size:
                window = np.pad(rri, (0, window_size - n), 'constant')
                psr = phase_space_reconstruct(window, m=m, tau=tau)
                feature_rows.append(psr)
                record_ids.append(record_id)

        except Exception as e:
            print(f"Skipping record {record_id}: {e}")
            traceback.print_exc()
            continue

    if len(feature_rows) == 0:
        raise ValueError("No valid records processed. Check zip file structure or metadata.")

    X = np.stack(feature_rows).astype(np.float32)
    record_ids = np.array(record_ids)
    return X, record_ids

def predict_probabilities(model, X):
    X_tensor = torch.from_numpy(X).float()
    with torch.no_grad():
        logits = model(X_tensor)
        probs = torch.softmax(logits, dim=1).numpy() 
    return probs

def compute_mean_predicted_time_horizon(record_ids, prob_danger, threshold=0.47, window_duration_sec=30):
    results = []
    df = pd.DataFrame({
        "record_id": record_ids,
        "prob_danger": prob_danger,
    })
    for rid, group in df.groupby("record_id"):
        group = group.reset_index(drop=True)
        danger_windows = group[group["prob_danger"] >= threshold]
        if danger_windows.empty:
            continue
        first_alert_idx = danger_windows.index[-1]  
        window_diff = len(group) - first_alert_idx
        time_horizon_sec = window_diff * window_duration_sec
        results.append(time_horizon_sec)
    if results:
        return float(np.mean(results))
    else:
        return 0.0

def load_model(model_class, model_path, *args, **kwargs):
    model = model_class(*args, **kwargs)
    state_dict = torch.load(model_path, map_location=torch.device("cpu"))
    model.load_state_dict(state_dict)
    model.eval()
    return model
