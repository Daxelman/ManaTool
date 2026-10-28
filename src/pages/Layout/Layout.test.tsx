import { render, screen } from "@testing-library/react";
import Layout from "./Layout";

test("renders home linke on layout", () => {
  render(<Layout />);
  const homeLinkElement = screen.getByText(/home/i);
  expect(homeLinkElement).toBeInTheDocument();
});
