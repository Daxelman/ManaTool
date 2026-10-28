import React from "react";
import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders learn react link", () => {
  render(<App />);
  const welcomeTitle = screen.getByText(/welcome pluto/i);
  expect(welcomeTitle).toBeInTheDocument();
});
