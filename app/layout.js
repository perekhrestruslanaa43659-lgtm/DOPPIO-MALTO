export default function Layout({ children }) {
  return (
    <html lang="en">
      <body>
        <header>
          <h1>Doppio Malto</h1>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}