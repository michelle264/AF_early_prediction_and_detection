import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AFDetection from "../pages/AF_detection";

// ===== MOCK FIREBASE =====
jest.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } }
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve({ id: "123" }))
}));

import { addDoc } from "firebase/firestore";

// ===== MOCK NOTIFICATION =====
global.Notification = function () {
  return { show: jest.fn() };
};

// ===== MOCK ALERT =====
window.alert = jest.fn();

// ===== RESET MOCKED FETCH =====
beforeEach(() => {
  global.fetch = jest.fn();
});


// Helper to upload files
function uploadFiles(csv, zip) {
  const inputs = document.querySelectorAll("input[type='file']");

  const metadataInput = inputs[0];
  const zipInput = inputs[1];

  fireEvent.change(metadataInput, { target: { files: [csv] } });
  fireEvent.change(zipInput, { target: { files: [zip] } });
}


// Renders the upload fields
test("renders upload inputs", () => {
  render(<AFDetection user={{ uid: "u1" }} />);

  expect(screen.getAllByText(/metadata.csv/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/record.zip/i).length).toBeGreaterThan(0);
});


//  Missing files → alert
test("submit without files shows alert", () => {
  render(<AFDetection user={{ uid: "u1" }} />);

  fireEvent.click(screen.getByText(/submit/i));

  expect(window.alert).toHaveBeenCalledWith(
    "Please select both metadata.csv and record ZIP file!"
  );
});


// Save Record calls Firestore
test("save record triggers addDoc", async () => {

  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      record_ids: ["record_001"],
      prob_af: [0.8],
      rr_features: {
        record_001: { mean_rr: 700, sdnn: 40, rmssd: 20, cvrr: 0.10 }
      }
    })
  });

  render(<AFDetection user={{ uid: "u1" }} />);

  const csv = new File(["aaa"], "metadata.csv", { type: "text/csv" });
  const zip = new File(["bbb"], "records.zip", { type: "application/zip" });

  uploadFiles(csv, zip);

  fireEvent.click(screen.getByText(/submit/i));

  const saveBtn = await screen.findByText(/save record/i);
  fireEvent.click(saveBtn);

  expect(addDoc).toHaveBeenCalledTimes(1);
});


//Report generation calls backend
test("generate report triggers backend", async () => {

  global.fetch
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record_ids: ["record_001"],
        prob_af: [0.6],
        rr_features: {
          record_001: { mean_rr: 750, sdnn: 60, rmssd: 30, cvrr: 0.12 }
        }
      })
    })
    // Report request
    .mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["PDFDATA"], { type: "application/pdf" })
    });

  render(<AFDetection user={{ uid: "u1" }} />);

  const csv = new File(["aaa"], "metadata.csv", { type: "text/csv" });
  const zip = new File(["bbb"], "records.zip", { type: "application/zip" });

  uploadFiles(csv, zip);

  fireEvent.click(screen.getByText(/submit/i));

  const reportBtn = await screen.findByText(/generate pdf report/i);
  fireEvent.click(reportBtn);

  expect(global.fetch).toHaveBeenCalledTimes(2);
});


// Modal appears for AF
test("modal appears when AF detected", async () => {

  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      record_ids: ["record_001"],
      prob_af: [0.95],
      rr_features: {
        record_001: { mean_rr: 700, sdnn: 40, rmssd: 20, cvrr: 0.10 }
      }
    })
  });

  render(<AFDetection user={{ uid: "u1" }} />);

  const csv = new File(["aaa"], "metadata.csv", { type: "text/csv" });
  const zip = new File(["bbb"], "records.zip", { type: "application/zip" });

  uploadFiles(csv, zip);

  fireEvent.click(screen.getByText(/submit/i));

  await waitFor(() => {
    expect(screen.getByText("⚠️ AF Detected")).toBeInTheDocument();
  });
});
