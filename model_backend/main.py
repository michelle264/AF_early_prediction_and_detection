from fastapi import FastAPI, UploadFile, File
import uvicorn
import os
import tempfile
import zipfile
import pandas as pd
import torch
import numpy as np
import shutil
from io import BytesIO
from fastapi.middleware.cors import CORSMiddleware
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from starlette.responses import StreamingResponse
from pydantic import BaseModel
from typing import Dict, Optional
from model_utils import load_model, preprocess_data, predict_probabilities, compute_mean_predicted_time_horizon, NODEModel, compute_rr_features, ReportRequest

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
        X, record_ids, raw_rr_dict = preprocess_data(metadata_path, records_dir)
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

        agg_probs = (
            df.groupby("record_id")["prob_danger"]
            .quantile(0.75)  
            .reset_index()
            .rename(columns={"prob_danger": "p75_prob_danger"})
        )

        # --- Compute mean predicted time horizon with threshold = 0.53 ---
        mean_predicted_time_horizon = compute_mean_predicted_time_horizon(
            record_ids, prob_danger, threshold=0.53, window_duration_sec=30
        )
        
        rr_features = {}

        for rid, rri in raw_rr_dict.items():
            rr_features[rid] = compute_rr_features(rri)

        # --- Build response ---
        response = {
            "record_id": agg_probs["record_id"].tolist(),
            "prob_danger": agg_probs["p75_prob_danger"].tolist(),
            "mean_predicted_time_horizon": mean_predicted_time_horizon,
            "rr_features": rr_features,
        }

        return response

@app.post("/detect/")
async def detect(
    metadata_file: UploadFile = File(...),
    records_zip: UploadFile = File(...),
):
    with tempfile.TemporaryDirectory() as tmpdir:
        metadata_path = os.path.join(tmpdir, "metadata.csv")
        zip_path = os.path.join(tmpdir, "records.zip")

        with open(metadata_path, "wb") as f:
            f.write(await metadata_file.read())

        with open(zip_path, "wb") as f:
            f.write(await records_zip.read())

        # Unzip
        records_dir = os.path.join(tmpdir, "Records")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(records_dir)

        # If flat files
        if not any(os.path.isdir(os.path.join(records_dir, d)) for d in os.listdir(records_dir)):
            for file in os.listdir(records_dir):
                full_path = os.path.join(records_dir, file)
                if not os.path.isfile(full_path):
                    continue
                prefix = "_".join(file.split("_")[:2])
                target_dir = os.path.join(records_dir, prefix)
                os.makedirs(target_dir, exist_ok=True)
                shutil.move(full_path, target_dir)

        # Preprocess
        X, record_ids, raw_rr_dict = preprocess_data(metadata_path, records_dir)
        X = X / 1000.0

        # Predict
        with torch.no_grad():
            probs = predict_probabilities(two_model, X)

        prob_af = probs[:, 1]  # AF probability

        # Convert to DataFrame
        df = pd.DataFrame({
            "record_id": record_ids,
            "prob_af": prob_af
        })

        agg_probs = (
            df.groupby("record_id")["prob_af"]
            .max()
            .reset_index()
        )

        # Compute RR features
        rr_features = {
            rid: compute_rr_features(rri)
            for rid, rri in raw_rr_dict.items()
        }

        response = {
            "record_ids": agg_probs["record_id"].tolist(),
            "prob_af": agg_probs["prob_af"].tolist(),  
            "rr_features": rr_features,
        }

        return response

class ReportRequest(BaseModel):
    record_id: str
    decision: str         
    prob_af: float       
    rr_features: Dict[str, float]
    timestamp: Optional[str] = None

@app.post("/report/")
async def generate_report(report: ReportRequest):
    """
    Generate a PDF report for AF detection with HRV Summary and Interpretation.
    """
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50

    # Header
    c.setFont("Helvetica-Bold", 18)
    c.drawString(50, y, "Atrial Fibrillation Detection Report")
    y -= 30

    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Record ID: {report.record_id}")
    y -= 16
    c.drawString(50, y, f"Date/Time: {report.timestamp or 'N/A'}")
    y -= 16
    c.drawString(
        50,
        y,
        f"Decision: {'AF Detected' if report.decision == 'Yes' else 'No AF Detected'}"
    )
    y -= 16
    c.drawString(50, y, f"AF Probability: {report.prob_af}%")
    y -= 30

    # HRV Summary
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Heart Rate Variability (HRV) Summary")
    y -= 22

    c.setFont("Helvetica", 11)
    for key, value in report.rr_features.items():
        c.drawString(60, y, f"{key}: {value:.4f}")
        y -= 16
        if y < 80:
            c.showPage()
            y = height - 50
            c.setFont("Helvetica", 11)

    # Prepare Interpretation Values
    mean_rr = report.rr_features.get("mean_rr")
    sdnn = report.rr_features.get("sdnn")
    rmssd = report.rr_features.get("rmssd")
    cvrr = report.rr_features.get("cvrr")

    p = report.prob_af / 100

    # AF probability meaning
    if p < 0.3:
        prob_text = "Low irregularity detected."
    elif p < 0.6:
        prob_text = "Moderate irregularity observed."
    else:
        prob_text = "High irregularity detected. Rhythm resembles AF-like pattern."

    # mean_rr interpretation
    if mean_rr < 700:
        mean_rr_text = "Fast heart rate detected."
    elif mean_rr < 1100:
        mean_rr_text = "Normal heart rate range."
    else:
        mean_rr_text = "Slow heart rate detected."

    # sdnn interpretation
    if sdnn < 50:
        sdnn_text = "Low variability (stable rhythm)."
    elif sdnn < 100:
        sdnn_text = "Moderate variability."
    else:
        sdnn_text = "High variability (possible irregular rhythm)."

    # rmssd interpretation
    if rmssd < 30:
        rmssd_text = "Low short-term variability (steady rhythm)."
    elif rmssd < 80:
        rmssd_text = "Moderate short-term variability."
    else:
        rmssd_text = "High short-term variability (may reflect irregular rhythm)."

    # cvrr interpretation
    if cvrr < 0.05:
        cvrr_text = "Very stable rhythm."
    elif cvrr < 0.15:
        cvrr_text = "Moderately variable rhythm."
    else:
        cvrr_text = "Highly irregular rhythm."

    # Interpretation Summary
    y -= 15

    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Interpretation Summary")
    y -= 22

    c.setFont("Helvetica", 11)
    c.drawString(60, y, f"AF Probability: {prob_text}")
    y -= 16
    c.drawString(60, y, f"Mean RR: {mean_rr_text}")
    y -= 16
    c.drawString(60, y, f"SDNN: {sdnn_text}")
    y -= 16
    c.drawString(60, y, f"RMSSD: {rmssd_text}")
    y -= 16
    c.drawString(60, y, f"CVRR: {cvrr_text}")
    y -= 30

    # Finalize PDF
    c.showPage()
    c.save()
    buffer.seek(0)

    filename = f"AF_Report_{report.record_id}.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
