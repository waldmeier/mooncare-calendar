// app/layout.tsx
import "./globals.css";

export const metadata = {
  title: "Mooncare Calendar",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}