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

def compute_mean_predicted_time_horizon(record_ids, prob_danger, threshold=0.52, window_duration_sec=30):
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
        first_alert_idx = danger_windows.index[-1]  # latest danger
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


# --- Spectrogram processor (windowed 1D -> 2D/flat features) ---
class SpectrogramProcessor:
    def __init__(
        self,
        n_fft: int = 32,
        hop_length: int = 8,
        win_length: int | None = None,
        center: bool = False,
        log_amplitude: bool = True,
        normalize: bool = True,
        flatten: bool = True,
        window: str = "hann",
    ) -> None:
        self.n_fft = int(n_fft)
        self.hop_length = int(hop_length)
        self.win_length = int(win_length) if win_length is not None else int(n_fft)
        self.center = bool(center)
        self.log_amplitude = bool(log_amplitude)
        self.normalize = bool(normalize)
        self.flatten = bool(flatten)
        self.window_type = window

        if self.window_type == "hann":
            self._window = torch.hann_window(self.win_length)
        else:
            raise ValueError(f"Unsupported window type: {self.window_type}")

    def _stft(self, x1d: np.ndarray) -> np.ndarray:
        x = torch.as_tensor(x1d, dtype=torch.float32)
        # Ensure window is on same device/dtype
        win = self._window.to(device=x.device, dtype=x.dtype)
        spec = torch.stft(
            x,
            n_fft=self.n_fft,
            hop_length=self.hop_length,
            win_length=self.win_length,
            window=win,
            center=self.center,
            return_complex=True,
        )
        mag = spec.abs()  # (n_freq, n_frames)
        if self.log_amplitude:
            mag = torch.log1p(mag)
        if self.normalize:
            m = mag.mean()
            s = mag.std().clamp_min(1e-6)
            mag = (mag - m) / s
        out = mag
        if self.flatten:
            out = out.reshape(-1)
        return out.detach().cpu().numpy().astype(np.float32)

    def __call__(self, x1d: np.ndarray) -> np.ndarray:
        return self._stft(x1d)


def spectrogram_feature_dim(
    window_size: int,
    n_fft: int = 32,
    hop_length: int = 8,
    win_length: int | None = None,
    center: bool = False,
    flatten: bool = True,
) -> int | tuple[int, int]:
    """
    Compute feature dimensionality for spectrogram of a 1D window.
    If flatten=True, returns flattened length; else returns (n_freq, n_frames).
    """
    wl = n_fft if win_length is None else win_length
    n_freq = n_fft // 2 + 1
    if center:
        # PyTorch STFT with center=True pads by n_fft//2 on both sides
        L_eff = window_size + 2 * (n_fft // 2)
    else:
        L_eff = window_size
    # Number of frames as in PyTorch STFT
    n_frames = 1 + max(0, (L_eff - wl) // hop_length)
    if flatten:
        return int(n_freq * n_frames)
    return int(n_freq), int(n_frames)


def preprocess_data_spectrogram(
    metadata_path,
    records_dir,
    window_size: int = 50,
    step_size: int = 5,
    n_fft: int = 32,
    hop_length: int = 8,
    win_length: int | None = None,
    center: bool = False,
    log_amplitude: bool = True,
    normalize: bool = True,
    flatten: bool = True,
    record_limit: int | None = None,
):
    """
    Segment each record's RRI into windows and compute a spectrogram for each window.
    Returns X (features) and record_ids aligned per-window.
    """
    import traceback
    metadata_df = pd.read_csv(metadata_path)

    if record_limit is not None:
        metadata_df = metadata_df.head(record_limit)
        print(f"[INFO] Limiting to first {record_limit} records for processing.")

    processor = SpectrogramProcessor(
        n_fft=n_fft,
        hop_length=hop_length,
        win_length=win_length,
        center=center,
        log_amplitude=log_amplitude,
        normalize=normalize,
        flatten=flatten,
    )

    feature_rows: list[np.ndarray] = []
    record_ids: list[str] = []

    for record_id in metadata_df["record_id"]:
        try:
            record = create_record(record_id, metadata_df, records_dir)
            record.load_rr_record()
            rri = np.concatenate(record.rr)
            n = len(rri)

            for start in range(0, n - window_size + 1, step_size):
                end = start + window_size
                window = rri[start:end]
                if len(window) < window_size:
                    window = np.pad(window, (0, window_size - len(window)), 'constant')
                feat = processor(window.astype(np.float32))
                feature_rows.append(feat)
                record_ids.append(record_id)

            if n < window_size:
                window = np.pad(rri, (0, window_size - n), 'constant')
                feat = processor(window.astype(np.float32))
                feature_rows.append(feat)
                record_ids.append(record_id)

        except Exception as e:
            print(f"[spectrogram] Skipping record {record_id}: {e}")
            traceback.print_exc()
            continue

    if len(feature_rows) == 0:
        raise ValueError("No valid records processed for spectrogram. Check data.")

    X = np.stack(feature_rows).astype(np.float32)
    record_ids = np.array(record_ids)
    return X, record_ids


def build_node_for_spectrogram(
    window_size: int,
    num_classes: int,
    n_fft: int = 32,
    hop_length: int = 8,
    win_length: int | None = None,
    center: bool = False,
) -> tuple[NODEModel, int]:
    """Convenience builder for a NODE sized to spectrogram features."""
    dim = spectrogram_feature_dim(
        window_size,
        n_fft=n_fft,
        hop_length=hop_length,
        win_length=win_length,
        center=center,
        flatten=True,
    )
    model = NODEModel(dim, num_classes)
    return model, dim
