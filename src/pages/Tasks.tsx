import { useEffect, useState } from 'react';
import { supabase, Task, Profile } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  Plus,
  LayoutGrid,
  List,
  Filter,
  Calendar,
  Tag,
  User,
  X,
  MessageSquare,
} from 'lucide-react';
import TaskModal from '../components/TaskModal';

type TaskWithAssignees = Task & {
  assignees: Profile[];
  comments_count: number;
};

type ViewMode = 'kanban' | 'list';

export default function Tasks() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<TaskWithAssignees[]>([]);
  const [filteredTasks, setFilteredTasks] = useState<TaskWithAssignees[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('kanban');
  const [loading, setLoading] = useState(true);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskWithAssignees | null>(null);
  const [filters, setFilters] = useState({
    assignee: '',
    category: '',
    tag: '',
  });
  const [allUsers, setAllUsers] = useState<Profile[]>([]);

  useEffect(() => {
    loadTasks();
    loadUsers();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [tasks, filters]);

  const loadUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('status', 'active');
    if (data) setAllUsers(data);
  };

  const loadTasks = async () => {
    try {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', false)
        .order('created_at', { ascending: false });

      if (tasksData) {
        const tasksWithDetails = await Promise.all(
          tasksData.map(async (task) => {
            const { data: assignees } = await supabase
              .from('task_assignees')
              .select('profiles(*)')
              .eq('task_id', task.id);

            const { count } = await supabase
              .from('task_comments')
              .select('*', { count: 'exact', head: true })
              .eq('task_id', task.id);

            return {
              ...task,
              assignees: assignees?.map((a: any) => a.profiles) || [],
              comments_count: count || 0,
            };
          })
        );

        setTasks(tasksWithDetails);
      }
    } catch (error) {
      console.error('Error loading tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...tasks];

    if (filters.assignee) {
      filtered = filtered.filter((task) =>
        task.assignees.some((a) => a.id === filters.assignee)
      );
    }

    if (filters.category) {
      filtered = filtered.filter((task) => task.category === filters.category);
    }

    if (filters.tag) {
      filtered = filtered.filter((task) => task.tags.includes(filters.tag));
    }

    setFilteredTasks(filtered);
  };

  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    e.dataTransfer.setData('taskId', taskId);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    const taskId = e.dataTransfer.getData('taskId');

    const { error } = await supabase
      .from('tasks')
      .update({ status: newStatus })
      .eq('id', taskId);

    if (!error) {
      await loadTasks();
    }
  };

  const allTags = Array.from(new Set(tasks.flatMap((t) => t.tags)));

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'medium':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'low':
        return 'bg-green-100 text-green-700 border-green-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const TaskCard = ({ task }: { task: TaskWithAssignees }) => (
    <div
      draggable
      onDragStart={(e) => handleDragStart(e, task.id)}
      onClick={() => {
        setSelectedTask(task);
        setShowTaskModal(true);
      }}
      className="bg-white rounded-xl p-4 shadow-sm border border-slate-200 hover:shadow-md transition-all cursor-move group"
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-900 flex-1 group-hover:text-blue-600 transition-colors">
          {task.title}
        </h3>
        <span
          className={`text-xs font-medium px-2 py-1 rounded-lg border ${getPriorityColor(
            task.priority
          )}`}
        >
          {task.priority}
        </span>
      </div>

      {task.description && (
        <p className="text-sm text-slate-600 mb-3 line-clamp-2">{task.description}</p>
      )}

      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center space-x-3">
          {task.due_date && (
            <div className="flex items-center space-x-1 text-slate-500">
              <Calendar className="w-3 h-3" />
              <span>{new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </div>
          )}
          {task.comments_count > 0 && (
            <div className="flex items-center space-x-1 text-slate-500">
              <MessageSquare className="w-3 h-3" />
              <span>{task.comments_count}</span>
            </div>
          )}
        </div>

        {task.assignees.length > 0 && (
          <div className="flex -space-x-2">
            {task.assignees.slice(0, 3).map((assignee) => (
              <div
                key={assignee.id}
                className="w-6 h-6 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center"
                title={assignee.username}
              >
                <span className="text-xs font-semibold text-blue-600">
                  {assignee.username.charAt(0).toUpperCase()}
                </span>
              </div>
            ))}
            {task.assignees.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                <span className="text-xs font-semibold text-slate-600">
                  +{task.assignees.length - 3}
                </span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center bg-white rounded-xl border border-slate-200 p-1">
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'kanban'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutGrid className="w-5 h-5" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-2 rounded-lg transition-all ${
                viewMode === 'list'
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center space-x-2">
            <Filter className="w-5 h-5 text-slate-400" />

            <select
              value={filters.assignee}
              onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Assignees</option>
              {allUsers.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.username}
                </option>
              ))}
            </select>

            <select
              value={filters.category}
              onChange={(e) => setFilters({ ...filters, category: e.target.value })}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              <option value="work">Work</option>
              <option value="personal">Personal</option>
            </select>

            <select
              value={filters.tag}
              onChange={(e) => setFilters({ ...filters, tag: e.target.value })}
              className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Tags</option>
              {allTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>

            {(filters.assignee || filters.category || filters.tag) && (
              <button
                onClick={() => setFilters({ assignee: '', category: '', tag: '' })}
                className="px-3 py-2 text-sm text-slate-600 hover:text-slate-900"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {profile?.role === 'admin' && (
          <button
            onClick={() => {
              setSelectedTask(null);
              setShowTaskModal(true);
            }}
            className="flex items-center space-x-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-all shadow-lg shadow-blue-500/30 hover:shadow-xl hover:shadow-blue-500/40"
          >
            <Plus className="w-5 h-5" />
            <span>New Task</span>
          </button>
        )}
      </div>

      {viewMode === 'kanban' ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(['to_do', 'in_progress', 'done'] as const).map((status) => (
            <div
              key={status}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, status)}
              className="bg-slate-100 rounded-2xl p-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-700 uppercase tracking-wider">
                  {status.replace('_', ' ')}
                </h3>
                <span className="text-xs font-semibold text-slate-500 bg-white px-2 py-1 rounded-lg">
                  {filteredTasks.filter((t) => t.status === status).length}
                </span>
              </div>
              <div className="space-y-3">
                {filteredTasks
                  .filter((task) => task.status === status)
                  .map((task) => (
                    <TaskCard key={task.id} task={task} />
                  ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Priority
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Assignees
                </th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Due Date
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTasks.map((task) => (
                <tr
                  key={task.id}
                  onClick={() => {
                    setSelectedTask(task);
                    setShowTaskModal(true);
                  }}
                  className="hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-900">{task.title}</div>
                    {task.description && (
                      <div className="text-sm text-slate-500 line-clamp-1">{task.description}</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs font-medium text-slate-600 capitalize">
                      {task.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-lg border ${getPriorityColor(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex -space-x-2">
                      {task.assignees.slice(0, 3).map((assignee) => (
                        <div
                          key={assignee.id}
                          className="w-8 h-8 rounded-full bg-blue-100 border-2 border-white flex items-center justify-center"
                          title={assignee.username}
                        >
                          <span className="text-xs font-semibold text-blue-600">
                            {assignee.username.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      ))}
                      {task.assignees.length > 3 && (
                        <div className="w-8 h-8 rounded-full bg-slate-100 border-2 border-white flex items-center justify-center">
                          <span className="text-xs font-semibold text-slate-600">
                            +{task.assignees.length - 3}
                          </span>
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm text-slate-900">
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString()
                        : '-'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          onClose={() => {
            setShowTaskModal(false);
            setSelectedTask(null);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
