import "./styles.css";

export const metadata = {
  title: "OpenHuman Mascot Tester",
  description: "Local Rive mascot manifest and state-engine tester"
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
