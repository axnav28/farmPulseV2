import { NavLink } from 'react-router-dom';
import { AlertCircle, FileStack, Globe2, Languages, LayoutDashboard, MessageSquareText, Moon, Sprout, Sun, TrendingUp } from 'lucide-react';
import { useTheme } from '../context/useTheme';

const navigation = [
  { name: 'Dashboard', to: '/overview', icon: LayoutDashboard },
  { name: 'Farmer Help', to: '/farmer-advisory', icon: Languages },
  { name: 'Channels', to: '/channel-fallback', icon: MessageSquareText },
  { name: 'District Data', to: '/districts', icon: Globe2 },
  { name: 'Mandi Prices', to: '/mandi-prices', icon: TrendingUp },
  { name: 'INSTITUTIONAL reports', to: '/institutional', icon: FileStack },
  { name: 'Audit Logs', to: '/audit', icon: AlertCircle },
];

export default function Sidebar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <aside className="flex h-full w-72 flex-col border-r border-[#264c37] bg-[#173624] text-white shadow-[18px_0_50px_rgba(12,32,22,0.28)]">
      <div className="border-b border-white/10 px-6 py-6">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/30 bg-white/5 text-primary">
            <Sprout size={24} />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">ET GenAI 2026</p>
            <p className="text-xl font-semibold tracking-tight">FarmPulse AI</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-2 px-4 py-6">
        {navigation.map((item) => (
          <NavLink
            key={item.name}
            to={item.to}
            className={({ isActive }) =>
              'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition ' +
              (isActive ? 'bg-white text-[#173624]' : 'text-white/70 hover:bg-white/8 hover:text-white')
            }
          >
            <item.icon size={18} />
            <span>{item.name}</span>
          </NavLink>
        ))}
      </nav>

      <div className="space-y-4 border-t border-white/10 px-4 py-5">
        <div className="rounded-3xl border border-white/8 bg-white/6 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/55">Simple use</p>
          <p className="mt-3 text-sm leading-6 text-white/70">
            Start with Farmer Help, then use Channels to see message delivery and Mandi Prices to answer sell-or-hold questions.
          </p>
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white"
          >
            {theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />}
            <span>{theme === 'dark' ? 'Dark' : 'Light'} mode</span>
          </button>
          <div className="flex items-center gap-2 rounded-full border border-[#f59e0b]/30 bg-[#f59e0b]/10 px-4 py-3 text-sm text-[#fde68a]">
            <AlertCircle size={16} />
            <span>Audit On</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
