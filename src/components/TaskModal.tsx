import { useEffect, useState } from 'react';
import { supabase, Task, Profile, TaskComment } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Calendar, Tag, User, MessageSquare, Trash2, Send } from 'lucide-react';

type TaskWithAssignees = Task & {
  assignees: Profile[];
  comments_count: number;
};

type TaskModalProps = {
  task: TaskWithAssignees | null;
  onClose: () => void;
};

export default function TaskModal({ task, onClose }: TaskModalProps) {
  const { profile } = useAuth();
  const isAdmin = profile?.role === 'admin';
  const isEditing = !!task;

  const [formData, setFormData] = useState({
    title: task?.title || '',
    description: task?.description || '',
    status: task?.status || 'to_do',
    priority: task?.priority || 'medium',
    due_date: task?.due_date || '',
    category: task?.category || 'work',
    tags: task?.tags || [],
    assignees: task?.assignees.map((a) => a.id) || [],
  });

  const [newTag, setNewTag] = useState('');
  const [allUsers, setAllUsers] = useState<Profile[]>([]);
  const [comments, setComments] = useState<(TaskComment & { username: string })[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadUsers();
    if (task) {
      loadComments();
    }
  }, [task]);

  const loadUsers = async () => {
    const { data } = await supabase.from('profiles').select('*').eq('status', 'active');
    if (data) setAllUsers(data);
  };

  const loadComments = async () => {
    if (!task) return;

    const { data } = await supabase
      .from('task_comments')
      .select(`
        *,
        profiles!inner(username)
      `)
      .eq('task_id', task.id)
      .order('created_at', { ascending: true });

    if (data) {
      const formattedComments = data.map((c: any) => ({
        ...c,
        username: c.profiles.username,
      }));
      setComments(formattedComments);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    setLoading(true);

    try {
      if (isEditing && task) {
        const canUpdate = isAdmin || task.assignees.some((a) => a.id === profile.id);
        if (!canUpdate) {
          alert('You do not have permission to edit this task');
          return;
        }

        const { assignees, ...taskData } = formData;

        const updateData = isAdmin
          ? taskData
          : { status: formData.status };

        const { error: updateError } = await supabase
          .from('tasks')
          .update(updateData)
          .eq('id', task.id);

        if (updateError) throw updateError;

        if (isAdmin) {
          await supabase.from('task_assignees').delete().eq('task_id', task.id);

          if (assignees.length > 0) {
            const assigneesData = assignees.map((userId) => ({
              task_id: task.id,
              user_id: userId,
            }));

            const { error: assignError } = await supabase
              .from('task_assignees')
              .insert(assigneesData);

            if (assignError) throw assignError;
          }
        }
      } else {
        if (!isAdmin) {
          alert('Only admins can create tasks');
          return;
        }

        const { assignees, ...taskData } = formData;

        const { data: newTask, error: taskError } = await supabase
          .from('tasks')
          .insert({
            ...taskData,
            created_by: profile.id,
          })
          .select()
          .single();

        if (taskError) throw taskError;

        if (assignees.length > 0 && newTask) {
          const assigneesData = assignees.map((userId) => ({
            task_id: newTask.id,
            user_id: userId,
          }));

          const { error: assignError } = await supabase
            .from('task_assignees')
            .insert(assigneesData);

          if (assignError) throw assignError;
        }
      }

      onClose();
    } catch (error: any) {
      console.error('Error saving task:', error);
      alert(error.message || 'Failed to save task');
    } finally {
      setLoading(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !task || !profile) return;

    try {
      const { error } = await supabase.from('task_comments').insert({
        task_id: task.id,
        user_id: profile.id,
        content: newComment,
      });

      if (error) throw error;

      setNewComment('');
      await loadComments();
    } catch (error) {
      console.error('Error adding comment:', error);
    }
  };

  const handleDelete = async () => {
    if (!task || !isAdmin) return;

    if (confirm('Are you sure you want to move this task to trash?')) {
      try {
        const { error } = await supabase
          .from('tasks')
          .update({ is_deleted: true, deleted_at: new Date().toISOString() })
          .eq('id', task.id);

        if (error) throw error;
        onClose();
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleAddTag = () => {
    if (newTag.trim() && !formData.tags.includes(newTag.trim())) {
      setFormData({ ...formData, tags: [...formData.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tag: string) => {
    setFormData({ ...formData, tags: formData.tags.filter((t) => t !== tag) });
  };

  const canEdit = isAdmin || (task && task.assignees.some((a) => a.id === profile?.id));

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h2 className="text-2xl font-semibold text-slate-900">
            {isEditing ? 'Edit Task' : 'Create Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-xl transition-colors"
          >
            <X className="w-6 h-6 text-slate-600" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Title
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                disabled={!canEdit || !isAdmin}
                required
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                disabled={!canEdit || !isAdmin}
                rows={4}
                className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Status
                </label>
                <select
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value as Task['status'] })
                  }
                  disabled={!canEdit}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="to_do">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Priority
                </label>
                <select
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: e.target.value as Task['priority'] })
                  }
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Due Date
                </label>
                <input
                  type="date"
                  value={formData.due_date || ''}
                  onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value as Task['category'] })
                  }
                  disabled={!isAdmin}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50"
                >
                  <option value="work">Work</option>
                  <option value="personal">Personal</option>
                </select>
              </div>
            </div>

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assignees
                </label>
                <div className="space-y-2">
                  {allUsers.map((user) => (
                    <label
                      key={user.id}
                      className="flex items-center space-x-3 p-3 hover:bg-slate-50 rounded-xl cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignees.includes(user.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setFormData({
                              ...formData,
                              assignees: [...formData.assignees, user.id],
                            });
                          } else {
                            setFormData({
                              ...formData,
                              assignees: formData.assignees.filter((id) => id !== user.id),
                            });
                          }
                        }}
                        className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                      />
                      <span className="text-sm text-slate-900">{user.username}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Tags
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center space-x-1 px-3 py-1 bg-blue-50 text-blue-700 rounded-lg text-sm"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="hover:text-blue-900"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
                    placeholder="Add a tag"
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddTag}
                    className="px-4 py-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors"
                  >
                    Add
                  </button>
                </div>
              </div>
            )}

            {task && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">
                  Comments ({comments.length})
                </label>
                <div className="space-y-3 mb-4 max-h-60 overflow-y-auto">
                  {comments.map((comment) => (
                    <div key={comment.id} className="bg-slate-50 rounded-xl p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className="text-sm font-medium text-slate-900">
                          {comment.username}
                        </span>
                        <span className="text-xs text-slate-500">
                          {new Date(comment.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700">{comment.content}</p>
                    </div>
                  ))}
                </div>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="flex-1 px-4 py-2 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleAddComment}
                    className="p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-6 border-t border-slate-200">
              <div>
                {task && isAdmin && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                    <span>Delete Task</span>
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || !canEdit}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Saving...' : isEditing ? 'Save Changes' : 'Create Task'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
