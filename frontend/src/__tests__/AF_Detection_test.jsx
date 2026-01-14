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

// MOCK UTILS
const mockSaveRecordToFirebase = jest.fn(() => Promise.resolve({ success: true, error: null }));
jest.mock("../components/Utils", () => ({
  ...jest.requireActual("../components/Utils"),
  saveRecordToFirebase: (...args) => mockSaveRecordToFirebase(...args)
}));

// MOCK NOTIFICATION
global.Notification = function () {
  return { show: jest.fn() };
};

// MOCK ALERT
window.alert = jest.fn();

// RESET MOCKED FETCH
beforeEach(() => {
  global.fetch = jest.fn();
  mockSaveRecordToFirebase.mockImplementation(() => Promise.resolve({ success: true, error: null }));
});

// Helper to upload HDF5 files
function uploadH5Files(files) {
  const fileInput = document.querySelector("input[type='file']");
  fireEvent.change(fileInput, { target: { files } });
}

// Renders the upload field
test("renders upload input", () => {
  render(<AFDetection user={{ uid: "u1" }} />);
  expect(screen.getByText(/RRI Data Files/i)).toBeInTheDocument();
  const fileInput = document.querySelector("input[type='file']");
  expect(fileInput).toHaveAttribute("accept", ".h5");
  expect(fileInput).toHaveAttribute("multiple");
});

// Missing file → error modal
test("submit without file shows error modal", async () => {
  render(<AFDetection user={{ uid: "u1" }} />);

  fireEvent.click(screen.getByText(/submit/i));

  await waitFor(() => {
    expect(
      screen.getByText("Please select at least one .h5 file!")
    ).toBeInTheDocument();
  });
});

// Save Record calls Firestore
test("save record triggers saveRecordToFirebase", async () => {
  global.fetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({
      record_id: ["record_001"],
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

  const h5File = new File(["data"], "record_001_rr_00.h5", { type: "application/x-hdf5" });

  uploadH5Files([h5File]);

  fireEvent.click(screen.getByText(/submit/i));

  const saveBtn = await screen.findByText(/save record/i);
  fireEvent.click(saveBtn);

  expect(mockSaveRecordToFirebase).toHaveBeenCalledTimes(1);
});

// Report generation calls backend
test("generate report triggers backend", async () => {
  global.fetch
    // Detection request
    .mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record_id: ["record_001"],
        prob_af: [0.8],
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

  const h5File = new File(["data"], "record_001_rr_00.h5", { type: "application/x-hdf5" });

  uploadH5Files([h5File]);

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
      record_id: ["record_001"],
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

  const h5File = new File(["data"], "record_001_rr_00.h5", { type: "application/x-hdf5" });

  uploadH5Files([h5File]);

  fireEvent.click(screen.getByText(/submit/i));

  await waitFor(() => {
    expect(screen.getByText("⚠️ AF Detected!")).toBeInTheDocument();
  });
});
