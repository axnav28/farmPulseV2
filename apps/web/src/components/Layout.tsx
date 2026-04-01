import { NavLink, Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';

const mobileNav = [
  { label: 'Dashboard', to: '/overview' },
  { label: 'Farmer Help', to: '/farmer-advisory' },
  { label: 'Channels', to: '/channel-fallback' },
  { label: 'District Data', to: '/districts' },
  { label: 'Market Prices', to: '/mandi-prices' },
  { label: 'Reports', to: '/institutional' },
  { label: 'Audit', to: '/audit' },
];

export default function Layout() {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-text-main xl:h-dvh xl:flex-row xl:overflow-hidden">
      <div className="hidden xl:block xl:h-dvh">
        <Sidebar />
      </div>
      <main className="min-w-0 flex-1 xl:overflow-hidden">
        <div className="flex min-h-dvh flex-col bg-transparent xl:h-full xl:min-h-0">
          <div className="sticky top-0 z-[1000] border-b border-border bg-[rgba(255,255,255,0.82)] px-4 py-3 backdrop-blur xl:hidden">
            <div className="touch-scroll flex gap-2 overflow-x-auto pb-1">
              {mobileNav.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    'whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold ' +
                    (isActive ? 'bg-primary text-white shadow-[0_10px_20px_rgba(26,58,42,0.18)]' : 'bg-surface-1 text-text-main')
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          </div>
          <div className="flex-1 overscroll-contain xl:min-h-0 xl:overflow-y-auto">
            <div className="mx-auto min-h-full max-w-[1760px]">
              <Outlet />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
