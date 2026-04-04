import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const mockReplace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
}));

let mockUser: { id: string } | null = null;
let mockIsLoading = false;

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ user: mockUser, isLoading: mockIsLoading }),
}));

import { AuthGuard } from "./AuthGuard";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  mockUser = null;
  mockIsLoading = false;
});

describe("AuthGuard", () => {
  it("renders children when user is authenticated", () => {
    mockUser = { id: "user-1" };
    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );
    expect(screen.getByText("Protected content")).toBeInTheDocument();
  });

  it("renders nothing when loading", () => {
    mockIsLoading = true;
    const { container } = render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when not authenticated", () => {
    mockUser = null;
    mockIsLoading = false;
    const { container } = render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );
    expect(container.innerHTML).toBe("");
  });

  it("redirects to /login when not authenticated", () => {
    mockUser = null;
    mockIsLoading = false;
    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );
    expect(mockReplace).toHaveBeenCalledWith("/login");
  });

  it("does not redirect when loading", () => {
    mockIsLoading = true;
    render(
      <AuthGuard>
        <div>Protected content</div>
      </AuthGuard>,
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
