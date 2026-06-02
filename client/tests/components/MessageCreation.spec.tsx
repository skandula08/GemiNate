import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import MessageCreation from "../../src/components/MessageCreation.tsx";
const handleMessageCreation = vi.fn();

describe("MessageCreation component", () => {
  beforeEach(() => {
    handleMessageCreation.mockReset();
  });

  it("triggers the handler when the form is submitted", () => {
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "First?" } });
    fireEvent.submit(screen.getByTestId("message-creation-form"));
    expect(handleMessageCreation).toHaveBeenCalledExactlyOnceWith("First?");
  });

  it("triggers the handler when the button is clicked", () => {
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Comment" } });
    fireEvent.click(screen.getByRole("button"));
    expect(handleMessageCreation).toHaveBeenCalledExactlyOnceWith("Comment");
  });

  it("triggers the handler when Enter is checked", () => {
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Comment" } });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
    });
    expect(handleMessageCreation).toHaveBeenCalledExactlyOnceWith("Comment");
  });

  it("does not triggers the handler when Enter is checked with the shift key active", () => {
    render(<MessageCreation handleMessageCreation={handleMessageCreation} />);

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "Comment" } });
    fireEvent.keyDown(screen.getByRole("textbox"), {
      key: "Enter",
      code: "Enter",
      charCode: 13,
      shiftKey: true,
    });
  });
});
