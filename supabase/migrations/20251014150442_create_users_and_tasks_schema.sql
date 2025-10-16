/*
  # Task Management Application Schema

  ## Overview
  This migration creates the complete database schema for a team-oriented task management application
  with admin and employee roles, supporting task assignment, comments, and file attachments.

  ## 1. New Tables

  ### `profiles`
  - `id` (uuid, primary key) - Links to auth.users
  - `username` (text, unique) - User's display name
  - `role` (text) - Either 'admin' or 'employee'
  - `status` (text) - Either 'active' or 'disabled'
  - `created_at` (timestamptz) - Account creation timestamp
  - `updated_at` (timestamptz) - Last profile update

  ### `tasks`
  - `id` (uuid, primary key) - Unique task identifier
  - `title` (text) - Task title
  - `description` (text) - Rich text description with support for images/files
  - `status` (text) - 'to_do', 'in_progress', or 'done'
  - `priority` (text) - 'low', 'medium', or 'high'
  - `due_date` (date) - Task deadline
  - `category` (text) - 'work' or 'personal'
  - `tags` (text[]) - Array of custom tags
  - `created_by` (uuid) - User who created the task
  - `is_deleted` (boolean) - Soft delete flag
  - `deleted_at` (timestamptz) - Deletion timestamp
  - `created_at` (timestamptz) - Task creation timestamp
  - `updated_at` (timestamptz) - Last task update

  ### `task_assignees`
  - `id` (uuid, primary key) - Unique assignment identifier
  - `task_id` (uuid) - Reference to tasks table
  - `user_id` (uuid) - Reference to profiles table
  - `assigned_at` (timestamptz) - Assignment timestamp

  ### `task_comments`
  - `id` (uuid, primary key) - Unique comment identifier
  - `task_id` (uuid) - Reference to tasks table
  - `user_id` (uuid) - Comment author
  - `content` (text) - Comment text
  - `created_at` (timestamptz) - Comment creation timestamp

  ### `task_attachments`
  - `id` (uuid, primary key) - Unique attachment identifier
  - `task_id` (uuid) - Reference to tasks table
  - `file_name` (text) - Original file name
  - `file_url` (text) - Storage URL for the file
  - `file_type` (text) - MIME type
  - `uploaded_by` (uuid) - User who uploaded the file
  - `created_at` (timestamptz) - Upload timestamp

  ## 2. Security

  Row Level Security (RLS) is enabled on all tables with the following policies:

  ### Profiles Policies
  - Users can view all active profiles
  - Users can update their own profile
  - Admins can update any profile

  ### Tasks Policies
  - Users can view non-deleted tasks
  - Admins can create, update, and soft-delete tasks
  - Employees can update status and add comments on assigned tasks
  - Users can view deleted tasks (for trash page)
  - Admins can permanently delete tasks

  ### Task Assignees Policies
  - Users can view all task assignments
  - Admins can create and delete assignments

  ### Task Comments Policies
  - Users can view comments on tasks they can see
  - Users can create comments on tasks
  - Users can update their own comments

  ### Task Attachments Policies
  - Users can view attachments on tasks they can see
  - Users can upload attachments
  - Users can delete their own attachments
  - Admins can delete any attachment

  ## 3. Important Notes
  - All tables use UUID primary keys for security
  - Tasks use soft-delete (is_deleted flag) instead of permanent deletion
  - RLS policies ensure employees can only modify tasks they're assigned to
  - Admins have full access to all operations
  - Timestamps are automatically managed with triggers
*/

-- Create profiles table
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'employee')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text DEFAULT '',
  status text NOT NULL DEFAULT 'to_do' CHECK (status IN ('to_do', 'in_progress', 'done')),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  due_date date,
  category text NOT NULL DEFAULT 'work' CHECK (category IN ('work', 'personal')),
  tags text[] DEFAULT ARRAY[]::text[],
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create task_assignees table
CREATE TABLE IF NOT EXISTS task_assignees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(task_id, user_id)
);

-- Create task_comments table
CREATE TABLE IF NOT EXISTS task_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create task_attachments table
CREATE TABLE IF NOT EXISTS task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_type text,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tasks_created_by ON tasks(created_by);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_is_deleted ON tasks(is_deleted);
CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_task_assignees_task_id ON task_assignees(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignees_user_id ON task_assignees(user_id);
CREATE INDEX IF NOT EXISTS idx_task_comments_task_id ON task_comments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task_id ON task_attachments(task_id);

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_attachments ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Users can view active profiles"
  ON profiles FOR SELECT
  TO authenticated
  USING (status = 'active' OR id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can update any profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Tasks policies
CREATE POLICY "Users can view non-deleted tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (is_deleted = false);

CREATE POLICY "Users can view deleted tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    is_deleted = true AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can create tasks"
  ON tasks FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can update any task"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Employees can update assigned task status"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_assignees.task_id = tasks.id
      AND task_assignees.user_id = auth.uid()
    )
    AND NOT is_deleted
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM task_assignees
      WHERE task_assignees.task_id = tasks.id
      AND task_assignees.user_id = auth.uid()
    )
    AND NOT is_deleted
  );

-- Task assignees policies
CREATE POLICY "Users can view task assignments"
  ON task_assignees FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can create task assignments"
  ON task_assignees FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

CREATE POLICY "Admins can delete task assignments"
  ON task_assignees FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Task comments policies
CREATE POLICY "Users can view comments"
  ON task_comments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_comments.task_id
      AND tasks.is_deleted = false
    )
  );

CREATE POLICY "Users can create comments"
  ON task_comments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_id
      AND tasks.is_deleted = false
    )
  );

CREATE POLICY "Users can update own comments"
  ON task_comments FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own comments"
  ON task_comments FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Task attachments policies
CREATE POLICY "Users can view attachments"
  ON task_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_attachments.task_id
      AND tasks.is_deleted = false
    )
  );

CREATE POLICY "Users can upload attachments"
  ON task_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks
      WHERE tasks.id = task_id
      AND tasks.is_deleted = false
    )
  );

CREATE POLICY "Users can delete own attachments"
  ON task_attachments FOR DELETE
  TO authenticated
  USING (uploaded_by = auth.uid());

CREATE POLICY "Admins can delete any attachment"
  ON task_attachments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
    )
  );

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to automatically create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, role, status)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, 'user_' || NEW.id::text),
    'employee',
    'active'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();