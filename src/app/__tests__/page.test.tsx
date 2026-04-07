import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import HomePage from "../page";

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) =>
    createElement("a", { href }, children),
}));

describe("HomePage", () => {
  it("renders the homepage without crashing", () => {
    render(createElement(HomePage));

    expect(screen.getByRole("heading", { name: /build youtube story videos/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /view projects/i })).toHaveAttribute("href", "/projects");
    expect(screen.getByRole("link", { name: /create new project/i })).toHaveAttribute("href", "/projects/new");
  });
});
