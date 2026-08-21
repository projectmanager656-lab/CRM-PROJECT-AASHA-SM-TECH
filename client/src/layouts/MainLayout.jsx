// Main Layout Component
export default function MainLayout({ children }) {
  return (
    <div className="main-layout">
      {/* Sidebar, Header, etc. will be added in later phases */}
      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
