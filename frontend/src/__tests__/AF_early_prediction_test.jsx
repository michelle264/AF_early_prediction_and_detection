import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AF_early_prediction from "../pages/AF_early_prediction";

// Mock backend API
global.fetch = jest.fn();

// Mock Firebase
jest.mock("firebase/firestore", () => ({
  getFirestore: jest.fn(() => ({})),
  collection: jest.fn(() => ({})),
  addDoc: jest.fn(() => Promise.resolve({ id: "123" })),
}));

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(() => ({ currentUser: { uid: "test-user" } })),
}));

jest.mock("firebase/storage", () => ({
  getStorage: jest.fn(() => ({})),
}));

const mockUser = { uid: "user123" };

// MOCK UTILS
const mockSaveRecordToFirebase = jest.fn(() => Promise.resolve({ success: true, error: null }));
jest.mock("../components/Utils", () => ({
  ...jest.requireActual("../components/Utils"),
  saveRecordToFirebase: (...args) => mockSaveRecordToFirebase(...args)
}));

beforeAll(() => {
  global.Notification = jest.fn();
  global.Notification.permission = "granted";
  global.Notification.requestPermission = jest.fn();
});

describe("AF Early Prediction Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSaveRecordToFirebase.mockImplementation(() => Promise.resolve({ success: true, error: null }));
  });

  // Test 1: Component renders the correct file input field
  test("renders upload field", () => {
    render(<AF_early_prediction user={mockUser} />);

    const inputs = document.querySelectorAll("input[type='file']");
    expect(inputs.length).toBe(1);
    
    const fileInput = inputs[0];
    expect(fileInput).toHaveAttribute("accept", ".h5");
    expect(fileInput).toHaveAttribute("multiple");

    expect(screen.getByText(/submit/i)).toBeInTheDocument();
  });

  // Test 2: File upload works correctly
  test("file upload works", () => {
    render(<AF_early_prediction user={mockUser} />);

    const fileInput = document.querySelector("input[type='file']");

    const h5File = new File(["data"], "record_001_rr_00.h5", {
      type: "application/x-hdf5",
    });

    fireEvent.change(fileInput, { target: { files: [h5File] } });

    expect(fileInput.files[0]).toBe(h5File);
  });

  // Test 3: Predict triggers backend and shows result
  test("predict shows result (Risky / Safe)", async () => {
    render(<AF_early_prediction user={mockUser} />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record_id: ["record_001"],
        prob_danger: [0.8],
        rr_features: { record_001: { mean_rr: 800, estimated_hr_bpm: 75.0 } },
      }),
    });

    const fileInput = document.querySelector("input[type='file']");

    fireEvent.change(fileInput, {
      target: { files: [new File(["data"], "record_001_rr_00.h5")] },
    });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() =>
      expect(screen.getByText(/risky/i)).toBeInTheDocument()
    );
  });

  // Test 4: Modal appears when prediction is risky
  test("shows modal when AF risk is high", async () => {
    render(<AF_early_prediction user={mockUser} />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record_id: ["record_001"],
        prob_danger: [0.9],
        rr_features: { record_001: { mean_rr: 700, estimated_hr_bpm: 85.0 } },
      }),
    });

    const fileInput = document.querySelector("input[type='file']");

    fireEvent.change(fileInput, {
      target: { files: [new File(["data"], "record_001_rr_00.h5")] },
    });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() =>
      expect(
        screen.getByText(/High Probability of Danger Detected/i)
      ).toBeInTheDocument()
    );
  });

  // Test 5: save record → calls saveRecordToFirebase
  test("save record calls saveRecordToFirebase", async () => {
    render(<AF_early_prediction user={mockUser} />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        record_id: ["record_001"],
        prob_danger: [0.3],
        rr_features: { record_001: { mean_rr: 800, estimated_hr_bpm: 75.0 } },
      }),
    });

    const fileInput = document.querySelector("input[type='file']");

    fireEvent.change(fileInput, {
      target: { files: [new File(["data"], "record_001_rr_00.h5")] },
    });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() => screen.getByText(/safe/i));

    fireEvent.click(screen.getByText(/save record/i));

    expect(mockSaveRecordToFirebase).toHaveBeenCalled();
  });

  // Test 6: Backend error → shows alert
  test("shows error modal when backend request fails", async () => {
    render(<AF_early_prediction user={mockUser} />);

    fetch.mockRejectedValueOnce(new Error("Server error"));

    const fileInput = document.querySelector("input[type='file']");

    fireEvent.change(fileInput, {
      target: { files: [new File(["data"], "record_001_rr_00.h5")] },
    });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() => {
      expect(
        screen.getByText(
          "Prediction failed. Please check file format and try again."
        )
      ).toBeInTheDocument();
    });
  });
});
