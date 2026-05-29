import Sidebar from './Sidebar';
import Navbar from './Navbar';
import { SidebarProvider } from '../../context/SidebarContext';

export default function Layout({ children }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen bg-[var(--bg-base)] transition-colors duration-300">
        <Sidebar />
        {/* sidebar-offset class adds lg:ml-64 via media query in index.css */}
        <div className="sidebar-offset flex flex-col flex-1 min-w-0">
          <Navbar />
          <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

