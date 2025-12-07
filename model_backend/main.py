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
from typing import Dict, Optional
from model_utils import load_model, preprocess_data, predict_probabilities, NODEModel, compute_rr_features, ReportRequest

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
        rr_features = {}

        for rid, rri in raw_rr_dict.items():
            rr_features[rid] = compute_rr_features(rri)

        # --- Build response ---
        response = {
            "record_id": agg_probs["record_id"].tolist(),
            "prob_danger": agg_probs["p75_prob_danger"].tolist(),
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

from typing import Dict, Optional, Literal

@app.post("/report/")
async def generate_report(report: ReportRequest):
    """
    Generate PDF for either:
    - Early AF Prediction (threshold 0.53)
    - AF Detection (threshold 0.65)
    """

    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4

    y = height - 50

    c.setFont("Helvetica-Bold", 18)

    if report.task_type == "early_prediction":
        title = "Early Atrial Fibrillation Prediction Report"
    else:
        title = "Atrial Fibrillation Detection Report"

    c.drawString(50, y, title)
    y -= 30

    # BASIC INFORMATION
    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Record ID: {report.record_id}")
    y -= 16
    c.drawString(50, y, f"Date/Time: {report.timestamp or 'N/A'}")
    y -= 16

    # APPLY THRESHOLDS
    p = report.prob_af  / 100.0  

    if report.task_type == "early_prediction":
        # Threshold: 0.53
        decision = "High Risk" if p >= 0.53 else "Low Risk"
        c.drawString(50, y, f"Risk Level: {decision}")
        y -= 16
        c.drawString(50, y, f"Probability of Danger: {report.prob_af:.2f}%")

    else:
        # AF Detection threshold: 0.65
        decision = "AF Detected" if p >= 0.65 else "No AF Detected"
        c.drawString(50, y, f"Decision: {decision}")
        y -= 16
        c.drawString(50, y, f"AF Probability: {report.prob_af:.2f}%")

    y -= 30

    # RR & Heart Rate Summary
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "RR & Heart Rate Summary")
    y -= 18

    c.setFont("Helvetica", 10)
    c.drawString(50, y, "• mean_rr: Average time between two heartbeats in milliseconds.")
    y -= 14
    c.drawString(50, y, "• estimated_hr_bpm: Approximate heart rate (beats per minute) computed from RR intervals.")
    y -= 20

    c.setFont("Helvetica", 11)

    for key, value in report.rr_features.items():
        c.drawString(60, y, f"{key}: {value:.4f}")
        y -= 16

    # HEART RATE INTERPRETATION (SAFE)
    est_hr = report.rr_features.get("estimated_hr_bpm")

    if est_hr is not None:
        if est_hr < 60:
            hr_text = "Slow heart rate (below typical resting range)."
        elif est_hr <= 100:
            hr_text = "Normal resting heart rate range (60–100 bpm)."
        else:
            hr_text = "Fast heart rate (above typical resting range)."
    else:
        hr_text = "Heart rate could not be estimated."

    y -= 15
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Interpretation Summary")
    y -= 20

    c.setFont("Helvetica", 11)
    # Probability text depends on task
    if report.task_type == "early_prediction":
        if p >= 0.53:
            prob_text = "The model predicts a high likelihood of AF occurring soon."
        else:
            prob_text = "The model predicts a low likelihood of imminent AF."
    else:
        if p >= 0.65:
            prob_text = "AF Detected."
        else:
            prob_text = "No AF Detected."

    c.drawString(60, y, prob_text)
    y -= 16
    c.drawString(60, y, hr_text)
    y -= 40

    # DISCLAIMER
    c.setFont("Helvetica-Bold", 11)
    c.drawString(50, y, "Important Disclaimer")
    y -= 18

    c.setFont("Helvetica", 9)
    for line in [
        "This report is generated by a research prototype, not a medical device.",
        "Predictions/Detections are for research and educational use only.",
        "Do not use these results for medical diagnosis or treatment.",
    ]:
        c.drawString(60, y, line)
        y -= 14

    c.showPage()
    c.save()
    buffer.seek(0)

    filename = f"{report.record_id}_{report.task_type}_report.pdf"

    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
