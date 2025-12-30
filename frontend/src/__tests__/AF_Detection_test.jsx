import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AFDetection from "../pages/AF_detection";

// MOCK FIREBASE
jest.mock("../firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } }
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  addDoc: jest.fn(() => Promise.resolve({ id: "123" }))
}));

import { addDoc } from "firebase/firestore";

// MOCK NOTIFICATION
global.Notification = function () {
  return { show: jest.fn() };
};

// MOCK ALERT
window.alert = jest.fn();

// RESET MOCKED FETCH
beforeEach(() => {
  global.fetch = jest.fn();
});

// Helper to upload ZIP only
function uploadZip(zip) {
  const zipInput = document.querySelector("input[type='file']");
  fireEvent.change(zipInput, { target: { files: [zip] } });
}

// Renders the upload field
test("renders upload input", () => {
  render(<AFDetection user={{ uid: "u1" }} />);

  // ✅ only record.zip should exist now
  expect(screen.getAllByText(/record\.zip/i).length).toBeGreaterThan(0);

  // ❌ metadata.csv should NOT be present anymore
  expect(screen.queryByText(/metadata\.csv/i)).toBeNull();
});

// Missing file → error modal
test("submit without file shows error modal", async () => {
  render(<AFDetection user={{ uid: "u1" }} />);

  fireEvent.click(screen.getByText(/submit/i));

  await waitFor(() => {
    // ✅ update this string to match your new UI message
    expect(
      screen.getByText("Please select record ZIP file!")
    ).toBeInTheDocument();
  });
});

// Save Record calls Firestore
test("save record triggers addDoc", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      record_ids: ["record_001"],
      prob_af: [0.8],
      rr_features: {
        record_001: {
          mean_rr: 800,
          estimated_hr_bpm: 75.0
        }
      }
    })
  });

  render(<AFDetection user={{ uid: "u1" }} />);

  const zip = new File(["bbb"], "records.zip", { type: "application/zip" });

  uploadZip(zip);

  fireEvent.click(screen.getByText(/submit/i));

  const saveBtn = await screen.findByText(/save record/i);
  fireEvent.click(saveBtn);

  expect(addDoc).toHaveBeenCalledTimes(1);
});

// Report generation calls backend
test("generate report triggers backend", async () => {
  global.fetch
    // Prediction request
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record_ids: ["record_001"],
        prob_af: [0.6],
        rr_features: {
          record_001: {
            mean_rr: 800,
            estimated_hr_bpm: 75.0
          }
        }
      })
    })
    // Report request
    .mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob(["PDFDATA"], { type: "application/pdf" })
    });

  render(<AFDetection user={{ uid: "u1" }} />);

  const zip = new File(["bbb"], "records.zip", { type: "application/zip" });

  uploadZip(zip);

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
        record_001: {
          mean_rr: 800,
          estimated_hr_bpm: 75.0
        }
      }
    })
  });

  render(<AFDetection user={{ uid: "u1" }} />);

  const zip = new File(["bbb"], "records.zip", { type: "application/zip" });

  uploadZip(zip);

  fireEvent.click(screen.getByText(/submit/i));

  await waitFor(() => {
    expect(screen.getByText("⚠️ AF Detected!")).toBeInTheDocument();
  });
});
