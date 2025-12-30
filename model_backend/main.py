from fastapi import FastAPI, UploadFile, File, HTTPException
import uvicorn
import os
import tempfile
import zipfile
import pandas as pd
import torch
import numpy as np
import shutil
import time
from io import BytesIO
from fastapi.middleware.cors import CORSMiddleware
from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from starlette.responses import StreamingResponse
from typing import Dict, Optional
from model_utils import (
    load_model, preprocess_data, predict_probabilities,
    NODEModel, compute_rr_features, ReportRequest
)

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MODEL_PATH = "Three_Class_Models/saved_models/NODE_PSR_best.pth"
input_dim = 138
num_classes = 3
model = load_model(NODEModel, MODEL_PATH, input_dim, num_classes)

TWO_MODEL_PATH = "Two_Class_Models/saved_models/NODE_PSR_two_class_best.pth"
two_model = load_model(NODEModel, TWO_MODEL_PATH, input_dim, 2)

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model.to(device).eval()
two_model.to(device).eval()

# Warmup (avoid first-request latency)
dummy = torch.zeros((4096, 138), device=device)
with torch.inference_mode():
    _ = model(dummy)
    _ = two_model(dummy)
if device.type == "cuda":
    torch.cuda.synchronize()

@app.get("/")
def root():
    return {"status": "running", "message": "AF project backend is live."}


def _fix_flat_structure(records_dir: str) -> None:
    """
    If extracted ZIP has no subfolders, group files into record folders.
    Example file: record_022_rr_00.csv -> folder: record_022/
    """
    if not any(os.path.isdir(os.path.join(records_dir, d)) for d in os.listdir(records_dir)):
        for f in os.listdir(records_dir):
            p = os.path.join(records_dir, f)
            if os.path.isfile(p):
                rid = "_".join(f.split("_")[:2])  
                target = os.path.join(records_dir, rid)
                os.makedirs(target, exist_ok=True)
                shutil.move(p, os.path.join(target, f))


def _validate_zip_files(records_dir: str) -> None:
    """
    Validate file extensions inside extracted ZIP (recursive).
    Only allows .h5 and .csv.
    """
    invalid = []
    for root, _, files in os.walk(records_dir):
        for f in files:
            if not f.lower().endswith((".h5", ".csv")):
                invalid.append(os.path.relpath(os.path.join(root, f), records_dir))
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid file(s) found in ZIP: {', '.join(invalid)}. Only .h5 or .csv allowed."
        )

@app.post("/predict/")
async def predict(
    records_zip: UploadFile = File(...),
):
    t_start = time.time()

    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "records.zip")

        #Read ZIP bytes & save
        records_bytes = await records_zip.read()
        with open(zip_path, "wb") as f:
            f.write(records_bytes)

        #Extract ZIP
        records_dir = os.path.join(tmpdir, "Records")
        try:
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(records_dir)
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=400,
                detail="Invalid records.zip file. Please upload a valid ZIP archive."
            )
        _validate_zip_files(records_dir)
        _fix_flat_structure(records_dir)

        available_records = {
            d.strip()
            for d in os.listdir(records_dir)
            if os.path.isdir(os.path.join(records_dir, d))
        }
        if not available_records:
            raise HTTPException(
                status_code=400,
                detail="No record folders found in ZIP after structure fix."
            )

        # Preprocessing
        try:
            X, record_ids, raw_rr_dict = preprocess_data(records_dir=records_dir)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        
        # Normalization
        X = X / 1000.0

        # Model inference 
        with torch.no_grad():
            probs = predict_probabilities(model, X)

        # Aggregate prob_danger (p75)
        prob_danger = 1 - probs[:, 0]
        df = pd.DataFrame({"record_id": record_ids, "prob_danger": prob_danger})

        agg_probs = (
            df.groupby("record_id")["prob_danger"]
            .quantile(0.75)
            .reset_index()
            .rename(columns={"prob_danger": "p75_prob_danger"})
        )

        # RR features
        rr_features = {rid: compute_rr_features(rri) for rid, rri in raw_rr_dict.items()}
        response = {
            "record_id": agg_probs["record_id"].tolist(),
            "prob_danger": agg_probs["p75_prob_danger"].tolist(),
            "rr_features": rr_features,
        }

        print(f"[/predict] TOTAL endpoint time: {time.time() - t_start:.4f}s")
        return response

@app.post("/detect/")
async def detect(
    records_zip: UploadFile = File(...),
):

    t_start = time.time()
    with tempfile.TemporaryDirectory() as tmpdir:
        zip_path = os.path.join(tmpdir, "records.zip")

        records_bytes = await records_zip.read()
        with open(zip_path, "wb") as f:
            f.write(records_bytes)
        records_dir = os.path.join(tmpdir, "Records")
        try:
            with zipfile.ZipFile(zip_path, "r") as zip_ref:
                zip_ref.extractall(records_dir)
        except zipfile.BadZipFile:
            raise HTTPException(
                status_code=400,
                detail="Invalid records.zip file. Please upload a valid ZIP archive."
            )

        _validate_zip_files(records_dir)
        _fix_flat_structure(records_dir)

        available_records = {
            d.strip()
            for d in os.listdir(records_dir)
            if os.path.isdir(os.path.join(records_dir, d))
        }
        if not available_records:
            raise HTTPException(
                status_code=400,
                detail="No record folders found in ZIP after structure fix."
            )

        # Preprocess
        try:
            X, record_ids, raw_rr_dict = preprocess_data(records_dir=records_dir)
        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))

        # Normalize
        X = X / 1000.0

        with torch.no_grad():
            probs = predict_probabilities(two_model, X)

        # Aggregate (max AF prob per record)
        prob_af = probs[:, 1]
        df = pd.DataFrame({"record_id": record_ids, "prob_af": prob_af})
        agg_probs = df.groupby("record_id")["prob_af"].max().reset_index()

        # RR features
        rr_features = {rid: compute_rr_features(rri) for rid, rri in raw_rr_dict.items()}
        response = {
            "record_ids": agg_probs["record_id"].tolist(),
            "prob_af": agg_probs["prob_af"].tolist(),
            "rr_features": rr_features,
        }

        print(f"[/detect] TOTAL endpoint time: {time.time() - t_start:.4f}s")
        return response

@app.post("/report/")
async def generate_report(report: ReportRequest):
    buffer = BytesIO()
    c = canvas.Canvas(buffer, pagesize=A4)
    width, height = A4
    y = height - 50

    c.setFont("Helvetica-Bold", 18)
    title = "Early Atrial Fibrillation Prediction Report" if report.task_type == "early_prediction" \
        else "Atrial Fibrillation Detection Report"
    title_x = (width - c.stringWidth(title, "Helvetica-Bold", 18)) / 2
    c.drawString(title_x, y, title)
    y -= 45

    c.setFont("Helvetica", 11)
    c.drawString(50, y, f"Record ID: {report.record_id}")
    y -= 16
    c.drawString(50, y, f"Date/Time: {report.timestamp or 'N/A'}")
    y -= 16

    p = report.prob_af / 100.0
    if report.task_type == "early_prediction":
        decision = "High Risk" if p >= 0.53 else "Low Risk"
        c.drawString(50, y, f"Risk Level: {decision}")
        y -= 16
        c.drawString(50, y, f"Probability of Danger: {round(report.prob_af)}%")
    else:
        decision = "AF Detected" if p >= 0.65 else "No AF Detected"
        c.drawString(50, y, f"Decision: {decision}")
        y -= 16
        c.drawString(50, y, f"AF Probability: {round(report.prob_af)}%")

    y -= 45
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Heartbeat Timing Summary")
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

    mean_rr = report.rr_features.get("mean_rr")
    if mean_rr is not None:
        rr_text = "Short RR intervals (consistent with faster heart rate)." if mean_rr < 600 \
            else "Normal RR interval range." if mean_rr <= 1000 \
            else "Long RR intervals (consistent with slower heart rate)."
    else:
        rr_text = "RR interval summary unavailable."

    est_hr = report.rr_features.get("estimated_hr_bpm")
    if est_hr is not None:
        hr_text = "Slow heart rate (below typical resting range)." if est_hr < 60 \
            else "Normal resting heart rate range (60–100 bpm)." if est_hr <= 100 \
            else "Fast heart rate (above typical resting range)."
    else:
        hr_text = "Heart rate could not be estimated."

    y -= 35
    c.setFont("Helvetica-Bold", 13)
    c.drawString(50, y, "Interpretation Summary")
    y -= 20

    c.setFont("Helvetica", 11)
    if report.task_type == "early_prediction":
        prob_text = "The model predicts a high likelihood of AF occurring soon." if p >= 0.53 \
            else "The model predicts a low likelihood of imminent AF."
    else:
        prob_text = "AF Detected." if p >= 0.65 else "No AF Detected."

    c.drawString(60, y, prob_text)
    y -= 16
    c.drawString(60, y, rr_text)
    y -= 16
    c.drawString(60, y, hr_text)
    y -= 40

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
