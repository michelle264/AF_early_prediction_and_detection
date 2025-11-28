import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AF_early_prediction from "../pages/AF_early_prediction";

// Mock backend API
global.fetch = jest.fn();

// Mock Firebase (must include getFirestore)
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

beforeAll(() => {
  global.Notification = jest.fn();
  global.Notification.permission = "granted";
  global.Notification.requestPermission = jest.fn();
});


describe("AF Early Prediction Component", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  /* --------------------------------------------------------
     Test 1: Component renders the correct file input fields
  ---------------------------------------------------------*/
  test("renders upload fields", () => {
    render(<AF_early_prediction user={mockUser} />);

    const inputs = document.querySelectorAll("input[type='file']");
    expect(inputs.length).toBe(2); // Same style as AF_detection_test

    expect(screen.getByText(/submit/i)).toBeInTheDocument();
  });

  /* --------------------------------------------------------
     Test 2: File upload works correctly
  ---------------------------------------------------------*/
  test("file upload works", () => {
    render(<AF_early_prediction user={mockUser} />);

    const [metadataInput, zipInput] = document.querySelectorAll("input[type='file']");

    const csvFile = new File(["data"], "meta.csv", { type: "text/csv" });
    const zipFile = new File(["zip"], "records.zip", { type: "application/zip" });

    fireEvent.change(metadataInput, { target: { files: [csvFile] } });
    fireEvent.change(zipInput, { target: { files: [zipFile] } });

    expect(metadataInput.files[0]).toBe(csvFile);
    expect(zipInput.files[0]).toBe(zipFile);
  });

  /* --------------------------------------------------------
     Test 3: Predict triggers backend and shows result
  ---------------------------------------------------------*/
  test("predict shows result (Risky / Safe)", async () => {
    render(<AF_early_prediction user={mockUser} />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prob_danger: [0.8],
        rr_features: { record_001: { mean_rr: 800, sdnn: 50 } },
      }),
    });

    const [metadataInput, zipInput] = document.querySelectorAll("input[type='file']");

    fireEvent.change(metadataInput, { target: { files: [new File(["a"], "meta.csv")] } });
    fireEvent.change(zipInput, { target: { files: [new File(["b"], "records.zip")] } });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() => expect(screen.getByText(/risky/i)).toBeInTheDocument());
  });

    //  Test 4: Modal appears when prediction is risky
  test("shows modal when AF risk is high", async () => {
    render(<AF_early_prediction user={mockUser} />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prob_danger: [0.9],
        rr_features: { record_001: { mean_rr: 700, sdnn: 100 } },
      }),
    });

    const [metadataInput, zipInput] = document.querySelectorAll("input[type='file']");

    fireEvent.change(metadataInput, { target: { files: [new File(["a"], "meta.csv")] } });
    fireEvent.change(zipInput, { target: { files: [new File(["b"], "records.zip")] } });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() =>
      expect(screen.getByText(/High AFib Risk Detected/i)).toBeInTheDocument()
    );
  });


    //  Test 5: save record → calls Firestore addDoc
  test("save record calls addDoc", async () => {
    const { addDoc } = require("firebase/firestore");

    render(<AF_early_prediction user={mockUser} />);

    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        prob_danger: [0.3],
        rr_features: { record_001: { mean_rr: 800 } },
      }),
    });

    const [metadataInput, zipInput] = document.querySelectorAll("input[type='file']");

    fireEvent.change(metadataInput, { target: { files: [new File(["a"], "meta.csv")] } });
    fireEvent.change(zipInput, { target: { files: [new File(["b"], "records.zip")] } });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() => screen.getByText(/safe/i));

    fireEvent.click(screen.getByText(/save record/i));

    expect(addDoc).toHaveBeenCalled();
  });

//      Test 6: Backend error → shows alert
  test("shows alert when backend request fails", async () => {
    render(<AF_early_prediction user={mockUser} />);

    jest.spyOn(window, "alert").mockImplementation(() => {});

    fetch.mockRejectedValueOnce(new Error("Server error"));

    const [metadataInput, zipInput] = document.querySelectorAll("input[type='file']");

    fireEvent.change(metadataInput, { target: { files: [new File(["a"], "meta.csv")] } });
    fireEvent.change(zipInput, { target: { files: [new File(["b"], "records.zip")] } });

    fireEvent.click(screen.getByText(/submit/i));

    await waitFor(() =>
      expect(window.alert).toHaveBeenCalledWith(
        "Prediction failed. Please try again."
      )
    );
  });
});
