import io
import zipfile
import pandas as pd
import numpy as np
import torch
from fastapi.testclient import TestClient

from main import app
from model_utils import (
    phase_space_reconstruct,
    compute_rr_features,
    predict_probabilities,
    NODEModel,
)

client = TestClient(app)

# Helper functions
def create_dummy_zip():
    memory_file = io.BytesIO()
    with zipfile.ZipFile(memory_file, "w") as zf:
        zf.writestr("record_001_rr_00.h5", "dummy_rr_data")
        zf.writestr("record_001_rr_labels_00.csv", "start_rr_index,end_rr_index\n0,10")
    memory_file.seek(0)
    return memory_file

def pytest_close_float(a, b, tol=1e-8) -> bool:
    try:
        return abs(float(a) - float(b)) <= tol
    except Exception:
        return False

def should_trigger_alert(prob, threshold=0.8):
    return prob >= threshold


# UNIT TESTS (pure logic - no FastAPI endpoints / no TestClient)
def test_compute_rr_features():
    rr = np.array([800, 820, 840, 860])
    result = compute_rr_features(rr)

    assert isinstance(result, dict)
    assert "mean_rr" in result
    assert isinstance(result["mean_rr"], (int, float, np.floating, np.integer))

    for k, v in result.items():
        assert isinstance(v, (int, float, np.floating, np.integer))

def test_rr_feature_ranges():
    rr = np.array([800, 820, 840, 860])
    features = compute_rr_features(rr)

    assert features["mean_rr"] > 0
    assert features["estimated_hr_bpm"] > 0
    assert features["estimated_hr_bpm"] < 200

def test_alert_threshold_logic():
    assert should_trigger_alert(0.85) is True
    assert should_trigger_alert(0.5) is False

# phase_space_reconstruct
def test_phase_space_reconstruct_output_length():
    x = np.arange(50)
    m, tau = 3, 2
    psr = phase_space_reconstruct(x, m=m, tau=tau)

    expected_len = (len(x) - (m - 1) * tau) * m  # (50-4)*3 = 138
    assert isinstance(psr, np.ndarray)
    assert psr.shape == (expected_len,)

def test_phase_space_reconstruct_pads_short_input():
    x = np.array([1, 2, 3])  # shorter than (m-1)*tau+1
    psr = phase_space_reconstruct(x, m=3, tau=2)

    # sanity: output should not be empty and should be numeric
    assert psr.size > 0
    assert np.isfinite(psr).all()
    # sanity: length should be divisible by m (flattened column stack)
    assert psr.shape[0] % 3 == 0

# compute_rr_features (formula edge cases)
def test_compute_rr_features_estimated_hr_matches_formula():
    rr = np.array([800, 800, 800, 800])  
    features = compute_rr_features(rr)
    assert abs(features["mean_rr"] - 800.0) < 1e-6
    assert abs(features["estimated_hr_bpm"] - 75.0) < 1e-6

def test_compute_rr_features_handles_zero_mean():
    rr = np.array([0, 0, 0])
    features = compute_rr_features(rr)
    assert features["mean_rr"] == 0.0
    assert features["estimated_hr_bpm"] is None

# NODEModel forward (shape)
def test_node_model_forward_output_shape():
    model = NODEModel(dim=138, num_classes=3)
    x = torch.randn(4, 138)
    logits = model(x)
    assert logits.shape == (4, 3)

# predict_probabilities (softmax output)
def test_predict_probabilities_shape_and_row_sum():
    model = NODEModel(dim=138, num_classes=3)
    model.eval()

    X = np.random.rand(10, 138).astype(np.float32)
    probs = predict_probabilities(model, X, batch_size=4)

    assert probs.shape == (10, 3)
    row_sums = probs.sum(axis=1)
    assert np.allclose(row_sums, np.ones_like(row_sums), atol=1e-5)
    assert np.isfinite(probs).all()


# INTEGRATION TESTS (FastAPI endpoints + request/response flow)
def test_predict_endpoint(monkeypatch):
    csv_buffer = io.BytesIO()
    df = pd.DataFrame({
        "record_id": ["record_001"],
        "patient_age": [40],
        "patient_sex": ["F"],
        "record_date": ["2020-01-01"],
        "record_start_time": ["00:00:00"],
        "record_end_time": ["00:01:00"],
        "record_files": ["record_001_rr_00.h5"],
        "record_seconds": [60],
        "record_samples": [300]
    })
    df.to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    zip_buffer = create_dummy_zip()

    monkeypatch.setattr(
        "main.preprocess_data",
        lambda *args, **kwargs: (
            np.random.rand(1, 138),
            ["record_001"],
            {"record_001": [800, 810, 820]}
        )
    )

    monkeypatch.setattr(
        "main.predict_probabilities",
        lambda model, X: np.array([[0.6, 0.3, 0.1]])
    )

    response = client.post(
        "/predict/",
        files={
            "records_zip": ("records.zip", zip_buffer.read(), "application/zip")
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "record_id" in data
    assert "prob_danger" in data
    assert "rr_features" in data
    assert "record_001" in data["rr_features"]

    rrf = data["rr_features"]["record_001"]
    assert isinstance(rrf, dict)
    assert any(isinstance(v, (int, float)) for v in rrf.values())

def test_detect_endpoint(monkeypatch):
    csv_buffer = io.BytesIO()
    pd.DataFrame({"record_id": ["record_001"]}).to_csv(csv_buffer, index=False)
    csv_buffer.seek(0)

    zip_buffer = create_dummy_zip()

    monkeypatch.setattr(
        "main.preprocess_data",
        lambda *a, **k: (
            np.random.rand(1, 138),
            ["record_001"],
            {"record_001": [800, 820, 840]}
        )
    )

    monkeypatch.setattr(
        "main.predict_probabilities",
        lambda model, X: np.array([[0.3, 0.7]])
    )

    response = client.post(
        "/detect/",
        files={
            "records_zip": ("records.zip", zip_buffer.read(), "application/zip")
        }
    )

    assert response.status_code == 200
    data = response.json()

    assert "record_ids" in data
    assert "prob_af" in data
    assert pytest_close_float(data["prob_af"][0], 0.7)

def test_report_pdf():
    payload = {
        "record_id": "record_001",
        "task_type": "early_prediction",
        "decision": "Yes",
        "prob_af": 87,
        "rr_features": {
            "mean_rr": 800.0,
            "estimated_hr_bpm": 75.0
        },
        "timestamp": "2025-05-01 10:00:00"
    }

    response = client.post("/report/", json=payload)

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert len(response.content) > 100

def test_report_missing_fields():
    payload = {
        "record_id": "record_001",
        "prob_af": 80,
        "rr_features": {
            "mean_rr": 800,
            "estimated_hr_bpm": 75.0
        }
    }

    response = client.post("/report/", json=payload)
    assert response.status_code == 422

def test_report_invalid_rr_features():
    payload = {
        "record_id": "record_001",
        "task_type": "detection",
        "decision": "Yes",
        "prob_af": 80,
        "rr_features": {
            "mean_rr": "not a number",
            "estimated_hr_bpm": 75.0
        }
    }

    response = client.post("/report/", json=payload)
    assert response.status_code in (400, 422)
