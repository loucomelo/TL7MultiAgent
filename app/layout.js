// app/layout.js
import { ClerkProvider } from "@clerk/nextjs";

export const metadata = {
  title: "Thinking Layer — Multi-Agent Debate",
  description: "A reasoning engine that debates itself before it answers.",
};

export default function RootLayout({ children }) {
  return (
    <ClerkProvider
      appearance={{
        variables: { colorPrimary: "#f0e040", colorBackground: "#0b0c14", colorText: "#d4d4c8" },
      }}
    >
      <html lang="en">
        <body style={{ margin: 0 }}>{children}</body>
      </html>
    </ClerkProvider>
  );
}
