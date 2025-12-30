import numpy as np
import pandas as pd
import torch, os
from Dataset_preparation.record import Record, create_record

import torch.nn as nn
import torch.nn.functional as F
from torchdiffeq import odeint

from pydantic import BaseModel
from typing import Dict, Optional, Literal

import time
import numpy as np
import pandas as pd

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

def preprocess_data(
    records_dir: str,
    window_size=50,
    step_size=5,
    m=3,
    tau=2
):
    """
    - Detect record folders inside records_dir
    - Load RR from each folder using Record(record_folder, metadata_record=None)
    - Build PSR windows -> X
    """
    if not records_dir or not os.path.isdir(records_dir):
        raise ValueError("records_dir not found / invalid")

    record_list = sorted([
        d for d in os.listdir(records_dir)
        if os.path.isdir(os.path.join(records_dir, d))
    ])

    if not record_list:
        raise ValueError("No record folders found in records_dir.")

    feature_rows = []
    record_ids = []
    raw_rr = {}

    processed_count = 0
    skipped_count = 0
    t_global = time.time()

    for record_id in record_list:
        try:
            record = create_record(record_id, None, records_dir)
            record.load_rr_record()

            rri = np.concatenate(record.rr)
            raw_rr[record_id] = rri
            n = len(rri)

            # windows (at least one)
            for start in range(0, max(1, n - window_size + 1), step_size):
                window = rri[start:start + window_size]
                if len(window) < window_size:
                    window = np.pad(window, (0, window_size - len(window)), "constant")

                psr = phase_space_reconstruct(window, m=m, tau=tau)
                feature_rows.append(psr)
                record_ids.append(record_id)

                if n < window_size:
                    break

            processed_count += 1

        except Exception as e:
            skipped_count += 1
            print(f"[preprocess_data] SKIP {record_id}: {type(e).__name__}: {e}")
            continue

    if len(feature_rows) == 0:
        raise ValueError(
            "No valid records processed. Check zip structure (record folders + RR file names)."
        )

    X = np.stack(feature_rows).astype(np.float32)
    record_ids = np.array(record_ids)
    return X, record_ids, raw_rr

def predict_probabilities(model, X, batch_size=4096):
    import time
    t0 = time.time()

    model.eval()
    device = next(model.parameters()).device
    X_tensor = torch.from_numpy(X).float().to(device)

    probs_list = []
    with torch.no_grad():
        for start in range(0, X_tensor.shape[0], batch_size):
            end = start + batch_size
            batch = X_tensor[start:end]
            logits = model(batch)
            probs = torch.softmax(logits, dim=1)
            probs_list.append(probs.cpu())

    probs = torch.cat(probs_list, dim=0).numpy()
    return probs


def load_model(model_class, model_path, *args, **kwargs):
    model = model_class(*args, **kwargs)
    state_dict = torch.load(model_path, map_location=torch.device("cpu"))
    model.load_state_dict(state_dict)
    model.eval()
    return model

def compute_rr_features(rr):
    rr = np.array(rr)

    # Mean RR interval in milliseconds
    mean_rr = float(np.mean(rr))

    # Estimated heart rate (BPM)
    # HR (bpm) = 60000 ms per minute / mean RR (ms)
    estimated_hr_bpm = float(60000.0 / mean_rr) if mean_rr > 0 else None

    return {
        "mean_rr": mean_rr,
        "estimated_hr_bpm": estimated_hr_bpm,
    }


class ReportRequest(BaseModel):
    record_id: str
    task_type: Literal["early_prediction", "af_detection"]
    decision: str
    prob_af: float
    rr_features: Dict[str, float]
    timestamp: Optional[str] = None

