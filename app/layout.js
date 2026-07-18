// app/layout.js
export const metadata = {
  title: "Thinking Layer — Multi-Agent Debate",
  description: "A reasoning engine that debates itself before it answers.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>{children}</body>
    </html>
  );
}
