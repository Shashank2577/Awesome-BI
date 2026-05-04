'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LayoutDashboard, Database, MessageSquare, Settings, Zap, ChevronLeft, ChevronRight, HelpCircle } from 'lucide-react';
import { useState } from 'react';

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/questions', label: 'Questions', icon: MessageSquare },
  { href: '/database', label: 'Database', icon: Database },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`flex flex-col border-r border-border bg-surface transition-all duration-300 ${collapsed ? 'w-16' : 'w-56'}`}>
      <div className="flex h-14 items-center border-b border-border px-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary"><Zap className="h-4 w-4 text-white" /></div>
          {!collapsed && <span className="font-semibold text-sm tracking-tight">Awesome BI</span>}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 p-3">
        {nav.map((item) => {
          const active = path === item.href || path.startsWith(item.href + '/');
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors ${
                active ? 'bg-primary/10 text-primary font-medium' : 'text-muted hover:text-foreground hover:bg-surface-hover'
              } ${collapsed ? 'justify-center' : ''}`}
              title={collapsed ? item.label : undefined}>
              <item.icon className="h-4 w-4 flex-shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3">
        {!collapsed && <div className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted"><HelpCircle className="h-3.5 w-3.5" />Help & Guides</div>}
        <button onClick={() => setCollapsed(!collapsed)} className="mt-1 flex w-full items-center justify-center rounded-lg p-2 text-muted hover:bg-surface-hover">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  );
}
