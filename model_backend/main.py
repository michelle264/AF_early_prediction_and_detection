from fastapi import FastAPI, UploadFile, File
import uvicorn
import os
import tempfile
import zipfile
import pandas as pd
import torch
import numpy as np
import shutil
from fastapi.middleware.cors import CORSMiddleware
from model_utils import load_model, preprocess_data, predict_probabilities, compute_mean_predicted_time_horizon, NODEModel

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load your trained model once at startup
MODEL_PATH = "Three_Class_Models/saved_models/NODE_PSR_best.pth"
input_dim = 138  # PSR feature length for m=3, tau=2, RRI length 50
num_classes = 3
model = load_model(NODEModel, MODEL_PATH, input_dim, num_classes)
# Load two-class model for AF detection
TWO_MODEL_PATH = "Two_Class_Models/saved_models/NODE_PSR_two_class_best.pth"
two_input_dim = input_dim
two_num_classes = 2
two_model = load_model(NODEModel, TWO_MODEL_PATH, two_input_dim, two_num_classes)

@app.get("/")
def root():
    return {"status": "running", "message": "AF project backend is live."}
    
@app.post("/predict/")
async def predict(
    metadata_file: UploadFile = File(...),
    records_zip: UploadFile = File(...),
):
    import tempfile, os, zipfile, shutil, torch
    import pandas as pd
    from torch import no_grad

    with tempfile.TemporaryDirectory() as tmpdir:
        metadata_path = os.path.join(tmpdir, "metadata.csv")
        zip_path = os.path.join(tmpdir, "records.zip")

        # --- Save uploaded files ---
        with open(metadata_path, "wb") as f:
            f.write(await metadata_file.read())
        with open(zip_path, "wb") as f:
            f.write(await records_zip.read())

        # --- Unzip ---
        records_dir = os.path.join(tmpdir, "Records")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(records_dir)

        print("Extracted contents:", os.listdir(records_dir))

        # --- Fix flat structure if necessary ---
        if not any(os.path.isdir(os.path.join(records_dir, d)) for d in os.listdir(records_dir)):
            for file in os.listdir(records_dir):
                if not os.path.isfile(os.path.join(records_dir, file)):
                    continue
                prefix = "_".join(file.split("_")[:2])
                record_subdir = os.path.join(records_dir, prefix)
                os.makedirs(record_subdir, exist_ok=True)
                shutil.move(os.path.join(records_dir, file), record_subdir)

        # --- Preprocessing ---
        X, record_ids = preprocess_data(metadata_path, records_dir)
        X = X / 1000.0

        # --- Model inference ---
        with torch.no_grad():
            probs = predict_probabilities(model, X)  # shape [N, 3]
        
        # --- Probability of danger ---
        prob_danger = 1 - probs[:, 0]  # (1 - P(SR))

        df = pd.DataFrame({
            "record_id": record_ids,
            "prob_danger": prob_danger
        })

        # --- Aggregate per record using 95th percentile (instead of mean) ---
        agg_probs = (
            df.groupby("record_id")["prob_danger"]
            .quantile(0.95)  # <-- p95 instead of mean
            .reset_index()
            .rename(columns={"prob_danger": "p95_prob_danger"})
        )

        # --- Compute mean predicted time horizon with threshold = 0.45 ---
        mean_predicted_time_horizon = compute_mean_predicted_time_horizon(
            record_ids, prob_danger, threshold=0.45, window_duration_sec=30
        )

        # --- Build response ---
        response = {
            "record_id": agg_probs["record_id"].tolist(),
            "prob_danger": agg_probs["p95_prob_danger"].tolist(),
            "mean_predicted_time_horizon": mean_predicted_time_horizon,
        }

        return response

@app.post("/detect/")
async def detect(
    metadata_file: UploadFile = File(...),
    records_zip: UploadFile = File(...),
):
    """
    POST endpoint for AF detection using the two-class NODE model.
    Returns probability of AF for each record (max or mean) and mean predicted time horizon.
    """
    with tempfile.TemporaryDirectory() as tmpdir:
        metadata_path = os.path.join(tmpdir, "metadata.csv")
        zip_path = os.path.join(tmpdir, "records.zip")

        with open(metadata_path, "wb") as f:
            f.write(await metadata_file.read())

        with open(zip_path, "wb") as f:
            f.write(await records_zip.read())

        # Unzip the records folder
        records_dir = os.path.join(tmpdir, "Records")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(records_dir)

        print("[two-class] Extracted contents:", os.listdir(records_dir))

        # If files are flat (no record_* folders)
        if not any(os.path.isdir(os.path.join(records_dir, d)) for d in os.listdir(records_dir)):
            for file in os.listdir(records_dir):
                if not os.path.isfile(os.path.join(records_dir, file)):
                    continue
                prefix = "_".join(file.split("_")[:2])
                record_subdir = os.path.join(records_dir, prefix)
                os.makedirs(record_subdir, exist_ok=True)
                shutil.move(os.path.join(records_dir, file), record_subdir)

        # Continue with preprocessing
        X, record_ids = preprocess_data(metadata_path, records_dir)
        X = X / 1000.0
        print("[two-class] X shape:", X.shape)

        # Run two-class model prediction
        with torch.no_grad():
            probs = predict_probabilities(two_model, X)

        prob_af = probs[:, 1]

        df = pd.DataFrame({
            "record_id": record_ids,
            "prob_af": prob_af
        })

        agg_probs = (
            df.groupby("record_id")["prob_af"]
            .agg(["mean", "max"])
            .reset_index()
            .rename(columns={"mean": "mean_prob_af", "max": "max_prob_af"})
        )

        response = {
            "record_ids": agg_probs["record_id"].tolist(),
            "prob_af": agg_probs["max_prob_af"].tolist(),
        }
        return response


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
