# Early Warning of Atrial Fibrillation Using Deep Learning

This project focuses on **early atrial fibrillation (AF) prediction** and **AF detection** using deep learning models based on **R–R interval (RRI)** signals. The aim is to provide early warning signals prior to AF onset, as well as reliable AF detection through an end-to-end system.

## Project Overview

This project covers **data preprocessing**, **model development**, and **full-stack system implementation** for interactive use and result visualisation.

### Model Architectures

The following models are implemented:

- **RAW-NODE** – Neural Ordinary Differential Equation (NODE) model using raw RRI signals  
- **RAW-HYBRID** – Hybrid model combining NODE and attention mechanisms using raw RRI  
- **PSR-NODE** – NODE model using Phase Space Reconstruction (PSR) features  
- **PSR-HYBRID** – Hybrid NODE and attention model using PSR-based features  

These models support:
- Early AF prediction (SR / pre-AF / AF)
- AF detection (SR / AF)

### System Implementation

- **Backend**: FastAPI (preprocessing, model inference, report generation)
- **Frontend**: React (file upload, prediction display, dashboards)
- **End-to-end pipeline**: RRI input → prediction → alerts → result visualisation

## Dataset Setup

Before running the code, download the **IRIDIA-AF dataset** from:

https://github.com/cedricgilon/iridia-af

Place the dataset in the following directory:

```text
model_backend/Records
