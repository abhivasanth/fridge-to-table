import { describe, it, expect, vi, beforeEach } from "vitest";
import { compressImage } from "@/lib/imageCompression";

// Set up Canvas API mocks — jsdom doesn't implement canvas
const mockDrawImage = vi.fn();
const mockToDataURL = vi.fn().mockReturnValue("data:image/jpeg;base64,compressed");
const mockGetContext = vi.fn().mockReturnValue({ drawImage: mockDrawImage });

beforeEach(() => {
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    if (tag === "canvas") {
      return {
        getContext: mockGetContext,
        toDataURL: mockToDataURL,
        width: 0,
        height: 0,
      } as unknown as HTMLCanvasElement;
    }
    return document.createElement(tag);
  });
});

describe("compressImage", () => {
  it("rejects if the file is not an image", async () => {
    const file = new File(["text content"], "notes.txt", {
      type: "text/plain",
    });
    await expect(compressImage(file, 1024)).rejects.toThrow(
      "File is not an image"
    );
  });

  it("resolves with a base64 data URL for an image file", async () => {
    const file = new File(["fake jpeg bytes"], "fridge.jpg", {
      type: "image/jpeg",
    });

    // Mock FileReader to simulate file reading
    const mockResult = "data:image/jpeg;base64,fakebytes";
    const mockReader = {
      readAsDataURL: vi.fn(),
      onload: null as any,
      result: mockResult,
    };
    vi.stubGlobal(
      "FileReader",
      vi.fn().mockImplementation(function () {
        return mockReader;
      })
    );

    // Mock Image to simulate loading with known dimensions
    const mockImg = {
      onload: null as any,
      src: "",
      naturalWidth: 2000,
      naturalHeight: 1500,
    };
    vi.stubGlobal(
      "Image",
      vi.fn().mockImplementation(function () {
        // Trigger onload asynchronously after src is assigned
        setTimeout(() => mockImg.onload?.(), 0);
        return mockImg;
      })
    );

    const promise = compressImage(file, 1024);
    // Trigger the FileReader onload callback
    mockReader.onload?.({ target: { result: mockResult } } as any);

    const result = await promise;
    expect(result).toBe("data:image/jpeg;base64,compressed");
  });
});
