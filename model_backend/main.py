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

@app.get("/")
def root():
    return {"status": "running", "message": "AF project backend is live."}
    
@app.post("/predict/")
async def predict(
    metadata_file: UploadFile = File(...),
    records_zip: UploadFile = File(...)
):
    """
    Accepts metadata.csv and a zip of the Records folder.
    Returns prediction results.
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

        print("Extracted contents:", os.listdir(records_dir))

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
        print("X shape:", X.shape)
        print("X mean:", np.mean(X), "X std:", np.std(X))

        # Run model prediction
        with torch.no_grad():
            probs = predict_probabilities(model, X)

        # Debug: print first few input features and model outputs
        print("First 3 input feature rows:", X[:3])
        print("First 3 model outputs (softmax):", probs[:3])

        # Calculate probability of danger (1 - P(SR))
        prob_danger = 1 - probs[:, 0]

        # Aggregate by mean per record
        df = pd.DataFrame({
            "record_id": record_ids,
            "prob_danger": prob_danger
        })
        mean_probs = (
            df.groupby("record_id")["prob_danger"]
            .mean()
            .reset_index()
)

        # Calculate mean predicted time horizon using the function above
        mean_predicted_time_horizon = compute_mean_predicted_time_horizon(
            record_ids, prob_danger, threshold=0.52, window_duration_sec=30
        )

        response = {
            "record_ids": mean_probs["record_id"].tolist(),
            "prob_danger": mean_probs["prob_danger"].tolist(),
            "mean_predicted_time_horizon": mean_predicted_time_horizon
        }
        return response


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
