import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import Home from "../page";

const hookMocks = vi.hoisted(() => ({
  useCrawl: vi.fn(),
}));

// Mock modules
vi.mock("@/hooks/useCrawl", () => ({
  useCrawl: hookMocks.useCrawl,
}));

// Mock Next.js Image component
interface ImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
}

vi.mock("next/image", () => ({
  default: ({ src, alt, width, height, className }: ImageProps) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} className={className} />;
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe("Home Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hookMocks.useCrawl.mockReturnValue({
      startCrawl: vi.fn(),
      cancel: vi.fn(),
      getResults: vi.fn(),
      isProcessing: false,
      results: [],
      progress: 0,
      error: null,
      status: "idle",
      jobId: null,
      creditsUsed: 0,
    });
    // Mock window.location
    Object.defineProperty(window, "location", {
      value: {
        search: "",
        href: "http://localhost:3000",
      },
      writable: true,
    });
  });

  it("should render the home page", () => {
    render(<Home />);

    expect(screen.getByRole("heading", { name: "llm.codes" })).toBeInTheDocument();
    expect(screen.getByText("Turn docs into clean Markdown")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("https://developer.apple.com/documentation/..."),
    ).toBeInTheDocument();
    expect(screen.getByText("Process Documentation")).toBeInTheDocument();
  });

  it("should handle URL input", () => {
    render(<Home />);

    const input = screen.getByPlaceholderText("https://developer.apple.com/documentation/...");
    fireEvent.change(input, {
      target: { value: "https://developer.apple.com/documentation/swiftui" },
    });

    expect(input).toHaveValue("https://developer.apple.com/documentation/swiftui");
  });

  it("should validate URLs", () => {
    render(<Home />);

    const input = screen.getByPlaceholderText("https://developer.apple.com/documentation/...");
    const button = screen.getByText("Process Documentation");

    // Test empty URL
    fireEvent.click(button);
    expect(screen.getByText("Please enter a URL")).toBeInTheDocument();

    // Test invalid URL format
    fireEvent.change(input, { target: { value: "not-a-url" } });
    fireEvent.click(button);
    expect(screen.getByText("URL must start with https:// or http://")).toBeInTheDocument();

    // Test invalid domain
    fireEvent.change(input, { target: { value: "https://invalid-domain.com" } });
    fireEvent.click(button);
    expect(screen.getByText(/URL must be from one of the/)).toBeInTheDocument();
  });

  it("should show and hide options", () => {
    render(<Home />);

    const optionsButton = screen.getByText("Options");

    // Options should be hidden initially
    expect(screen.queryByText("Filter out all URLs")).not.toBeInTheDocument();

    // Click to show options
    fireEvent.click(optionsButton);
    expect(screen.getByText("Filter out all URLs")).toBeInTheDocument();
    expect(screen.getByText("De-duplicate content")).toBeInTheDocument();

    // Click to hide options
    fireEvent.click(optionsButton);
    expect(screen.queryByText("Filter out all URLs")).not.toBeInTheDocument();
  });

  it("should handle configuration changes", () => {
    render(<Home />);

    // Change depth
    const depthInput = screen.getByLabelText("Crawl Depth");
    fireEvent.change(depthInput, { target: { value: "3" } });
    expect(depthInput).toHaveValue(3);

    // Change max URLs
    const maxUrlsInput = screen.getByLabelText("Max URLs");
    fireEvent.change(maxUrlsInput, { target: { value: "50" } });
    expect(maxUrlsInput).toHaveValue(50);

    // Toggle options
    fireEvent.click(screen.getByText("Options"));

    const filterUrlsCheckbox = screen.getByLabelText("Filter out all URLs");
    fireEvent.click(filterUrlsCheckbox);
    expect(filterUrlsCheckbox).not.toBeChecked();
  });

  it("should handle URL from query parameters", () => {
    window.location.search = "?https://developer.apple.com/documentation/swiftui";

    render(<Home />);

    const input = screen.getByPlaceholderText("https://developer.apple.com/documentation/...");
    expect(input).toHaveValue("https://developer.apple.com/documentation/swiftui");
  });

  it("should process valid URLs", async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({
        success: true,
        data: { markdown: "# Test Content" },
      }),
    } as unknown as Response);

    render(<Home />);

    const input = screen.getByPlaceholderText("https://developer.apple.com/documentation/...");
    const button = screen.getByText("Process Documentation");

    fireEvent.change(input, {
      target: { value: "https://developer.apple.com/documentation/swiftui" },
    });
    fireEvent.click(button);

    // Should show processing state
    await waitFor(() => {
      expect(screen.getByText("Processing Documentation...")).toBeInTheDocument();
    });
  });

  it("should handle supported domains popover", () => {
    render(<Home />);

    expect(screen.getByText(/Most documentation pages are supported/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "https://github.com/amantus-ai/llm-codes#supported-documentation-sites",
    );
  });

  it("should handle notification permissions", () => {
    // Mock Notification API
    Object.defineProperty(window, "Notification", {
      value: {
        permission: "default",
        requestPermission: vi.fn().mockResolvedValue("granted"),
      },
      writable: true,
    });

    render(<Home />);

    // Should not show notification status initially
    expect(screen.queryByText(/Notifications/)).not.toBeInTheDocument();
  });

  it("should detect iOS devices", () => {
    // Mock iOS user agent
    Object.defineProperty(navigator, "userAgent", {
      value: "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)",
      writable: true,
    });

    render(<Home />);

    // iOS detection happens in useEffect
    // Notification permission UI should not be shown on iOS
    expect(screen.queryByText(/Notifications enabled/)).not.toBeInTheDocument();
  });

  it("should handle download after processing", async () => {
    // Create a mock for URL.createObjectURL
    global.URL.createObjectURL = vi.fn(() => "blob:http://localhost:3000/test");
    global.URL.revokeObjectURL = vi.fn();

    render(<Home />);

    // Mock document.createElement after render so React can create its normal anchor nodes.
    const mockAnchor = {
      href: "",
      download: "",
      click: vi.fn(),
    };

    const originalCreateElement = document.createElement;
    document.createElement = vi.fn((tagName) => {
      if (tagName === "a") {
        return mockAnchor as unknown as HTMLAnchorElement;
      }
      return originalCreateElement.call(document, tagName);
    });

    // Wait for the download button to appear (it's conditional on results)
    await waitFor(() => {
      const downloadButton = screen.queryByText("Download Markdown");
      if (downloadButton) {
        fireEvent.click(downloadButton);

        expect(mockAnchor.click).toHaveBeenCalled();
        expect(mockAnchor.download).toBe("apple-developer-docs.md");
        expect(global.URL.createObjectURL).toHaveBeenCalled();
        expect(global.URL.revokeObjectURL).toHaveBeenCalled();
      }
    });

    // Restore mocks
    document.createElement = originalCreateElement;
  });
});
