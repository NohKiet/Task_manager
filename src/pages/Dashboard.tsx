import { useEffect, useState } from 'react';
import { supabase, Task, TaskComment } from '../lib/supabase';
import { AlertCircle, Calendar, CheckCircle, TrendingUp } from 'lucide-react';

type TaskStats = {
  overdue: number;
  dueToday: number;
  completed: number;
  byPriority: { low: number; medium: number; high: number };
};

type UpcomingTask = Task & {
  assignees: { username: string }[];
};

export default function Dashboard() {
  const [stats, setStats] = useState<TaskStats>({
    overdue: 0,
    dueToday: 0,
    completed: 0,
    byPriority: { low: 0, medium: 0, high: 0 },
  });
  const [upcomingTasks, setUpcomingTasks] = useState<UpcomingTask[]>([]);
  const [recentActivity, setRecentActivity] = useState<(TaskComment & { task_title: string; username: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const today = new Date().toISOString().split('T')[0];

      const { data: tasks } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', false);

      if (tasks) {
        const overdue = tasks.filter(
          (t) => t.due_date && t.due_date < today && t.status !== 'done'
        ).length;

        const dueToday = tasks.filter(
          (t) => t.due_date === today && t.status !== 'done'
        ).length;

        const completed = tasks.filter((t) => t.status === 'done').length;

        const byPriority = {
          low: tasks.filter((t) => t.priority === 'low' && t.status !== 'done').length,
          medium: tasks.filter((t) => t.priority === 'medium' && t.status !== 'done').length,
          high: tasks.filter((t) => t.priority === 'high' && t.status !== 'done').length,
        };

        setStats({ overdue, dueToday, completed, byPriority });
      }

      const { data: upcoming } = await supabase
        .from('tasks')
        .select(`
          *,
          task_assignees!inner(
            profiles!inner(username)
          )
        `)
        .eq('is_deleted', false)
        .not('due_date', 'is', null)
        .neq('status', 'done')
        .order('due_date', { ascending: true })
        .limit(5);

      if (upcoming) {
        const formattedTasks = upcoming.map((task: any) => ({
          ...task,
          assignees: task.task_assignees.map((ta: any) => ({ username: ta.profiles.username })),
        }));
        setUpcomingTasks(formattedTasks);
      }

      const { data: comments } = await supabase
        .from('task_comments')
        .select(`
          *,
          tasks!inner(title),
          profiles!inner(username)
        `)
        .order('created_at', { ascending: false })
        .limit(10);

      if (comments) {
        const formattedComments = comments.map((c: any) => ({
          ...c,
          task_title: c.tasks.title,
          username: c.profiles.username,
        }));
        setRecentActivity(formattedComments);
      }
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <span className="text-3xl font-semibold text-slate-900">{stats.overdue}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Tasks Overdue</h3>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-amber-50 rounded-xl flex items-center justify-center">
              <Calendar className="w-6 h-6 text-amber-600" />
            </div>
            <span className="text-3xl font-semibold text-slate-900">{stats.dueToday}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Due Today</h3>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-3xl font-semibold text-slate-900">{stats.completed}</span>
          </div>
          <h3 className="text-sm font-medium text-slate-600">Total Completed</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Tasks by Priority</h3>
          </div>

          <div className="space-y-4">
            {(['high', 'medium', 'low'] as const).map((priority) => {
              const count = stats.byPriority[priority];
              const total = Object.values(stats.byPriority).reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? (count / total) * 100 : 0;
              const color = priority === 'high' ? 'bg-red-500' : priority === 'medium' ? 'bg-amber-500' : 'bg-green-500';

              return (
                <div key={priority}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-700 capitalize">{priority}</span>
                    <span className="text-sm font-semibold text-slate-900">{count}</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2">
                    <div
                      className={`${color} h-2 rounded-full transition-all duration-500`}
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">Upcoming Deadlines</h3>
          </div>

          <div className="space-y-3">
            {upcomingTasks.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-8">No upcoming deadlines</p>
            ) : (
              upcomingTasks.map((task) => (
                <div
                  key={task.id}
                  className="flex items-start justify-between p-3 bg-slate-50 rounded-xl hover:bg-slate-100 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-slate-900 mb-1">{task.title}</h4>
                    <p className="text-xs text-slate-500">
                      {task.assignees.length > 0 && `Assigned to ${task.assignees.map(a => a.username).join(', ')}`}
                    </p>
                  </div>
                  <div className="text-right ml-4">
                    <span className="text-xs font-medium text-slate-900">
                      {new Date(task.due_date!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                    <div className={`text-xs font-medium mt-1 ${
                      task.priority === 'high' ? 'text-red-600' :
                      task.priority === 'medium' ? 'text-amber-600' : 'text-green-600'
                    }`}>
                      {task.priority}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900 mb-6">Recent Activity</h3>
        <div className="space-y-4">
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No recent activity</p>
          ) : (
            recentActivity.map((activity) => (
              <div key={activity.id} className="flex items-start space-x-4">
                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-blue-600">
                    {activity.username.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-900">
                    <span className="font-medium">{activity.username}</span> commented on{' '}
                    <span className="font-medium">{activity.task_title}</span>
                  </p>
                  <p className="text-sm text-slate-600 mt-1">{activity.content}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(activity.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
