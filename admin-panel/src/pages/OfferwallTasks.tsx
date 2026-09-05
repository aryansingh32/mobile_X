import React, { useEffect, useMemo, useState } from 'react';
import { Check, ClipboardList, Edit2, Plus, Trash2, Users, X } from 'lucide-react';
import {
  createOfferwallTask,
  deleteOfferwallTask,
  getOfferwallCompletions,
  getOfferwallTasks,
  updateOfferwallTask,
} from '../services/api';

const TASK_TYPES = ['INSTALL', 'SURVEY', 'VIDEO', 'SIGNUP', 'REVIEW', 'OTHER'];

const blankForm = {
  title: '',
  description: '',
  imageUrl: '',
  type: 'SURVEY',
  rewardCoins: 50,
  externalUrl: '',
  sortOrder: 0,
  isActive: true,
};

const OfferwallTasksPage = () => {
  const [tasks, setTasks] = useState<any[]>([]);
  const [completions, setCompletions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [selectedTask, setSelectedTask] = useState<any>(null);
  const [formData, setFormData] = useState(blankForm);

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    if (selectedTask) fetchCompletions(selectedTask.id);
  }, [selectedTask?.id]);

  const selectedFreshTask = useMemo(
    () => tasks.find((task) => task.id === selectedTask?.id) || selectedTask,
    [tasks, selectedTask],
  );

  const fetchTasks = async () => {
    try {
      const { data } = await getOfferwallTasks();
      setTasks(data.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompletions = async (taskId: number) => {
    try {
      const { data } = await getOfferwallCompletions({ taskId });
      setCompletions(data.data || []);
    } catch (err) {
      console.error(err);
      setCompletions([]);
    }
  };

  const openCreate = () => {
    setEditingTask(null);
    setFormData(blankForm);
    setShowModal(true);
  };

  const openEdit = (task: any) => {
    setEditingTask(task);
    setFormData({
      title: task.title || '',
      description: task.description || '',
      imageUrl: task.imageUrl || '',
      type: task.type || 'SURVEY',
      rewardCoins: task.rewardCoins || 50,
      externalUrl: task.externalUrl || '',
      sortOrder: task.sortOrder ?? 0,
      isActive: task.isActive ?? true,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('Delete this task? Past completions are kept for the coin ledger record, but this removes it from the catalog.')) return;
    try {
      await deleteOfferwallTask(id);
      if (selectedTask?.id === id) setSelectedTask(null);
      await fetchTasks();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete task');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      title: formData.title,
      description: formData.description,
      imageUrl: formData.imageUrl || null,
      type: formData.type,
      rewardCoins: Number(formData.rewardCoins),
      externalUrl: formData.externalUrl || null,
      sortOrder: Number(formData.sortOrder),
      isActive: formData.isActive,
    };

    try {
      if (editingTask) {
        await updateOfferwallTask(editingTask.id, payload);
      } else {
        await createOfferwallTask(payload);
      }
      setShowModal(false);
      await fetchTasks();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save task');
    }
  };

  if (loading) return <div className="p-6 text-white">Loading offerwall tasks...</div>;

  return (
    <div className="p-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center">
            <ClipboardList className="mr-3 text-[var(--accent)]" /> Offerwall Tasks
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Admin-curated tasks shown in the app's Earn tab. No third-party offerwall network is
            connected — completion is self-attested by the user and pays out once per task, same as
            any other admin-set reward. The signature-verified <code>/postback</code> webhook stays
            available separately for whenever a real network is wired in.
          </p>
        </div>
        <button onClick={openCreate} className="bg-[var(--accent)] hover:bg-[#E64518] text-white px-4 py-2 rounded-lg flex items-center transition-colors">
          <Plus size={20} className="mr-2" /> Add Task
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_420px] gap-6">
        <div className="bg-[#1A1A1A] rounded-lg overflow-hidden border border-[#333]">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-[#2A2A2A] text-gray-400">
              <tr>
                <th className="px-5 py-4 font-semibold">Task</th>
                <th className="px-5 py-4 font-semibold">Type</th>
                <th className="px-5 py-4 font-semibold">Reward</th>
                <th className="px-5 py-4 font-semibold">Completions</th>
                <th className="px-5 py-4 font-semibold">Status</th>
                <th className="px-5 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#333]">
              {tasks.map((task) => (
                <tr key={task.id} className={`hover:bg-[#222] transition-colors ${selectedTask?.id === task.id ? 'bg-[#222]' : ''}`}>
                  <td className="px-5 py-4">
                    <button onClick={() => setSelectedTask(task)} className="flex items-center gap-3 text-left cursor-pointer">
                      <div className="w-12 h-12 bg-[#333] rounded-md overflow-hidden flex items-center justify-center shrink-0">
                        {task.imageUrl ? <img src={task.imageUrl} alt="" className="w-full h-full object-cover" /> : <ClipboardList size={20} className="text-gray-500" />}
                      </div>
                      <div>
                        <div className="font-semibold text-white">{task.title}</div>
                        <div className="text-xs text-gray-500 line-clamp-1">{task.description}</div>
                      </div>
                    </button>
                  </td>
                  <td className="px-5 py-4"><span className="bg-[#333] px-2 py-1 rounded text-xs">{task.type}</span></td>
                  <td className="px-5 py-4 font-mono text-[var(--accent)]">{task.rewardCoins}</td>
                  <td className="px-5 py-4">
                    <button onClick={() => setSelectedTask(task)} className="flex items-center gap-1.5 text-white/80 hover:text-white">
                      <Users size={14} /> {task._count?.completions ?? 0}
                    </button>
                  </td>
                  <td className="px-5 py-4">
                    <span className={`px-2 py-1 rounded text-xs ${task.isActive ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                      {task.isActive ? 'Active' : 'Hidden'}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex justify-end gap-3">
                      <button onClick={() => openEdit(task)} className="text-blue-400 hover:text-blue-300" title="Edit task"><Edit2 size={18} /></button>
                      <button onClick={() => handleDelete(task.id)} className="text-red-400 hover:text-red-300" title="Delete task"><Trash2 size={18} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {tasks.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-gray-500">No offerwall tasks yet.</td></tr>}
            </tbody>
          </table>
        </div>

        <aside className="bg-[#1A1A1A] rounded-lg border border-[#333] p-4 h-fit">
          {selectedFreshTask ? (
            <>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedFreshTask.title}</h2>
                  <p className="text-sm text-gray-400">{selectedFreshTask._count?.completions ?? 0} completions</p>
                </div>
                <button onClick={() => setSelectedTask(null)} className="text-gray-400 hover:text-white"><X size={20} /></button>
              </div>

              <div className="max-h-[480px] overflow-y-auto divide-y divide-[#333]">
                {completions.map((completion) => (
                  <div key={completion.id} className="py-3">
                    <div className="font-semibold text-white text-sm">{completion.user?.name || completion.user?.email || `user #${completion.userId}`}</div>
                    <div className="text-xs text-gray-500">
                      +{completion.rewardCoins} coins · {new Date(completion.completedAt).toLocaleString()}
                    </div>
                  </div>
                ))}
                {completions.length === 0 && <div className="py-8 text-center text-gray-500">No one has completed this task yet.</div>}
              </div>
            </>
          ) : (
            <div className="py-10 text-center text-gray-500">
              <Users className="mx-auto mb-3 text-gray-600" />
              Select a task to see who's completed it.
            </div>
          )}
        </aside>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1A1A1A] rounded-lg border border-[#333] w-full max-w-xl overflow-hidden">
            <div className="flex justify-between items-center p-4 border-b border-[#333]">
              <h2 className="text-lg font-bold text-white">{editingTask ? 'Edit Task' : 'Add Task'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
            </div>
            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Title *</label>
                <input required className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Description *</label>
                <textarea required rows={3} className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Image URL</label>
                <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.imageUrl} onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })} placeholder="https://..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Type *</label>
                  <select className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })}>
                    {TASK_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-1">Reward Coins *</label>
                  <input type="number" required min="1" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.rewardCoins} onChange={(e) => setFormData({ ...formData, rewardCoins: Number(e.target.value) })} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">External URL</label>
                <input className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.externalUrl} onChange={(e) => setFormData({ ...formData, externalUrl: e.target.value })} placeholder="https:// — opened when the user taps this task" />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Sort Order</label>
                <input type="number" className="w-full bg-[#111] border border-[#333] rounded px-3 py-2 text-white focus:outline-none focus:border-[var(--accent)]" value={formData.sortOrder} onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
              </div>
              <label className="flex items-center gap-3 text-white">
                <input type="checkbox" checked={formData.isActive} onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })} />
                Active in user catalog
              </label>
              <div className="pt-2 flex justify-end gap-2">
                <button type="button" className="px-4 py-2 text-gray-400 hover:text-white" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-[var(--accent)] hover:bg-[#E64518] text-white rounded flex items-center">
                  <Check size={16} className="mr-2" /> Save Task
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default OfferwallTasksPage;
