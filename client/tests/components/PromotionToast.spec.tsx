import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PromotionToast } from "../../src/components/PromotionToast.tsx";

describe("PromotionToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders DJ content for role 'dj'", () => {
    render(<PromotionToast role="dj" onDismiss={vi.fn()} />);
    expect(screen.getByText("You're now a DJ")).toBeTruthy();
    expect(screen.getByText("You can manage the community jukebox queue.")).toBeTruthy();
  });

  it("renders demotion content for role 'demotion'", () => {
    render(<PromotionToast role="demotion" onDismiss={vi.fn()} />);
    expect(screen.getByText("You're no longer a DJ")).toBeTruthy();
    expect(screen.getByText("Your DJ role has been removed.")).toBeTruthy();
  });

  it("renders owner content for role 'owner'", () => {
    render(<PromotionToast role="owner" onDismiss={vi.fn()} />);
    expect(screen.getByText("You're the new owner")).toBeTruthy();
    expect(screen.getByText("You now have full control of this community.")).toBeTruthy();
  });

  it("calls onDismiss after 4 seconds", () => {
    const onDismiss = vi.fn();
    render(<PromotionToast role="dj" onDismiss={onDismiss} />);

    expect(onDismiss).not.toHaveBeenCalled();

    for (let i = 0; i < 4; i++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }

    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("does not call onDismiss before 4 seconds", () => {
    const onDismiss = vi.fn();
    render(<PromotionToast role="dj" onDismiss={onDismiss} />);

    act(() => {
      vi.advanceTimersByTime(3999);
    });

    expect(onDismiss).not.toHaveBeenCalled();
  });
});
