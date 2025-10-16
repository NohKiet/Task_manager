import { useEffect, useState } from 'react';
import { supabase, Task } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { RotateCcw, Trash2, Calendar, Tag } from 'lucide-react';

type DeletedTask = Task & {
  assignees: { username: string }[];
};

export default function Trash() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<DeletedTask[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile?.role === 'admin') {
      loadDeletedTasks();
    }
  }, [profile]);

  const loadDeletedTasks = async () => {
    try {
      const { data: tasksData } = await supabase
        .from('tasks')
        .select('*')
        .eq('is_deleted', true)
        .order('deleted_at', { ascending: false });

      if (tasksData) {
        const tasksWithDetails = await Promise.all(
          tasksData.map(async (task) => {
            const { data: assignees } = await supabase
              .from('task_assignees')
              .select('profiles(username)')
              .eq('task_id', task.id);

            return {
              ...task,
              assignees: assignees?.map((a: any) => ({ username: a.profiles.username })) || [],
            };
          })
        );

        setTasks(tasksWithDetails);
      }
    } catch (error) {
      console.error('Error loading deleted tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ is_deleted: false, deleted_at: null })
        .eq('id', taskId);

      if (error) throw error;
      await loadDeletedTasks();
    } catch (error) {
      console.error('Error restoring task:', error);
    }
  };

  const handlePermanentDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to permanently delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);

      if (error) throw error;
      await loadDeletedTasks();
    } catch (error) {
      console.error('Error permanently deleting task:', error);
    }
  };

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

  if (profile?.role !== 'admin') {
    return (
      <div className="text-center py-12">
        <p className="text-slate-600">You do not have permission to view this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-slate-900">Deleted Tasks</h3>
        <p className="text-sm text-slate-600 mt-1">
          Restore or permanently delete tasks
        </p>
      </div>

      {tasks.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Trash2 className="w-8 h-8 text-slate-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No deleted tasks</h3>
          <p className="text-sm text-slate-600">
            Deleted tasks will appear here and can be restored or permanently deleted.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {tasks.map((task) => (
            <div
              key={task.id}
              className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-lg font-semibold text-slate-900">{task.title}</h3>
                    <span
                      className={`text-xs font-medium px-2 py-1 rounded-lg border ${getPriorityColor(
                        task.priority
                      )}`}
                    >
                      {task.priority}
                    </span>
                  </div>
                  {task.description && (
                    <p className="text-sm text-slate-600 mb-3">{task.description}</p>
                  )}

                  <div className="flex items-center space-x-4 text-sm text-slate-500">
                    {task.due_date && (
                      <div className="flex items-center space-x-1">
                        <Calendar className="w-4 h-4" />
                        <span>Due: {new Date(task.due_date).toLocaleDateString()}</span>
                      </div>
                    )}
                    <div className="flex items-center space-x-1">
                      <Tag className="w-4 h-4" />
                      <span className="capitalize">{task.category}</span>
                    </div>
                    <div>
                      <span>Status: </span>
                      <span className="capitalize">{task.status.replace('_', ' ')}</span>
                    </div>
                  </div>

                  {task.assignees.length > 0 && (
                    <div className="mt-3">
                      <span className="text-sm text-slate-500">Assigned to: </span>
                      <span className="text-sm text-slate-900">
                        {task.assignees.map((a) => a.username).join(', ')}
                      </span>
                    </div>
                  )}

                  {task.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {task.deleted_at && (
                    <p className="text-xs text-slate-400 mt-3">
                      Deleted on {new Date(task.deleted_at).toLocaleString()}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 ml-4">
                  <button
                    onClick={() => handleRestore(task.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                    title="Restore task"
                  >
                    <RotateCcw className="w-5 h-5" />
                    <span className="text-sm font-medium">Restore</span>
                  </button>
                  <button
                    onClick={() => handlePermanentDelete(task.id)}
                    className="flex items-center space-x-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-100 rounded-xl transition-colors"
                    title="Permanently delete task"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span className="text-sm font-medium">Delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
