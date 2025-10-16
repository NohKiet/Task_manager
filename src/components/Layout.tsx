import { ReactNode } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  CheckSquare,
  Trash2,
  Users,
  LogOut,
  User
} from 'lucide-react';

type LayoutProps = {
  children: ReactNode;
  currentPage: 'dashboard' | 'tasks' | 'trash' | 'team' | 'profile';
  onNavigate: (page: 'dashboard' | 'tasks' | 'trash' | 'team' | 'profile') => void;
};

export default function Layout({ children, currentPage, onNavigate }: LayoutProps) {
  const { profile, signOut } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'tasks', label: 'Tasks', icon: CheckSquare },
    { id: 'trash', label: 'Trash', icon: Trash2 },
    ...(profile?.role === 'admin' ? [{ id: 'team', label: 'Team', icon: Users }] : []),
  ] as const;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <CheckSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-slate-900">TaskFlow</h1>
              <p className="text-xs text-slate-500">Manage with ease</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentPage === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id as any)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-1">
          <button
            onClick={() => onNavigate('profile')}
            className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all ${
              currentPage === 'profile'
                ? 'bg-blue-50 text-blue-600'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="font-medium">Profile</span>
          </button>
          <button
            onClick={signOut}
            className="w-full flex items-center space-x-3 px-4 py-3 rounded-xl text-slate-600 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 capitalize">
                  {currentPage}
                </h2>
                {profile && (
                  <p className="text-sm text-slate-500 mt-1">
                    Welcome back, {profile.username}
                  </p>
                )}
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {profile?.role}
                </span>
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
              </div>
            </div>
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
