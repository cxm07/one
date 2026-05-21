import { useEffect, useMemo, useState } from 'react'
import {
  AlarmClock,
  Bell,
  CalendarClock,
  Check,
  Circle,
  ClipboardList,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react'
import './App.css'

const STORAGE_KEY = 'todo-reminder.tasks'
const DEFAULT_REMINDER_METHOD = 'browser'

const initialTasks = [
  {
    id: crypto.randomUUID(),
    title: '整理今天的任务清单',
    note: '先把最要紧的三件事排出来',
    dueAt: getDateTimeValue(45),
    priority: 'high',
    reminderMethod: DEFAULT_REMINDER_METHOD,
    completed: false,
    reminded: false,
  },
  {
    id: crypto.randomUUID(),
    title: '给项目进度做一次回顾',
    note: '检查还有哪些事项卡住了',
    dueAt: getDateTimeValue(180),
    priority: 'medium',
    reminderMethod: 'page',
    completed: false,
    reminded: false,
  },
]

const priorityLabels = {
  high: '高',
  medium: '中',
  low: '低',
}

const reminderMethodLabels = {
  browser: '浏览器通知',
  page: '页面提示',
  silent: '仅列表标记',
}

function getDateTimeValue(minutesFromNow = 0) {
  const date = new Date(Date.now() + minutesFromNow * 60 * 1000)
  date.setSeconds(0, 0)
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
  return offsetDate.toISOString().slice(0, 16)
}

function formatDueTime(value) {
  if (!value) return '未设置提醒'

  return new Intl.DateTimeFormat('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function getTaskStatus(task) {
  if (task.completed) return 'done'
  if (!task.dueAt) return 'open'

  const diff = new Date(task.dueAt).getTime() - Date.now()
  if (diff < 0) return 'overdue'
  if (diff <= 60 * 60 * 1000) return 'soon'
  return 'open'
}

function normalizeTask(task) {
  return {
    ...task,
    priority: task.priority || 'medium',
    reminderMethod: task.reminderMethod || DEFAULT_REMINDER_METHOD,
    completed: Boolean(task.completed),
    reminded: Boolean(task.reminded),
  }
}

function App() {
  const [tasks, setTasks] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return initialTasks

    try {
      const parsedTasks = JSON.parse(stored)
      return Array.isArray(parsedTasks) ? parsedTasks.map(normalizeTask) : initialTasks
    } catch {
      return initialTasks
    }
  })
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [dueAt, setDueAt] = useState(getDateTimeValue(60))
  const [priority, setPriority] = useState('medium')
  const [reminderMethod, setReminderMethod] = useState(DEFAULT_REMINDER_METHOD)
  const [pageReminders, setPageReminders] = useState([])
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [notificationState, setNotificationState] = useState(
    'Notification' in window ? Notification.permission : 'unsupported',
  )

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    function pushPageReminder(task, message) {
      const reminder = {
        id: `${task.id}-${Date.now()}`,
        title: task.title,
        message: message || task.note || '时间到了',
      }

      setPageReminders((currentReminders) => [reminder, ...currentReminders].slice(0, 3))

      window.setTimeout(() => {
        setPageReminders((currentReminders) =>
          currentReminders.filter((item) => item.id !== reminder.id),
        )
      }, 8000)
    }

    const timer = window.setInterval(() => {
      setTasks((currentTasks) =>
        currentTasks.map((task) => {
          if (
            task.completed ||
            task.reminded ||
            !task.dueAt ||
            new Date(task.dueAt).getTime() > Date.now()
          ) {
            return task
          }

          const taskReminderMethod = task.reminderMethod || DEFAULT_REMINDER_METHOD
          const canNotify =
            'Notification' in window && Notification.permission === 'granted'

          if (taskReminderMethod === 'browser' && canNotify) {
            new Notification('待办提醒', {
              body: `${task.title} - ${task.note || '时间到了'}`,
            })
          }

          if (taskReminderMethod === 'page') {
            pushPageReminder(task)
          }

          if (taskReminderMethod === 'browser' && !canNotify) {
            pushPageReminder(task, '浏览器通知未开启，已改用页面提示')
          }

          return { ...task, reminded: true }
        }),
      )
    }, 15000)

    return () => window.clearInterval(timer)
  }, [])

  const stats = useMemo(() => {
    const active = tasks.filter((task) => !task.completed)
    const overdue = active.filter((task) => getTaskStatus(task) === 'overdue')

    return {
      total: tasks.length,
      active: active.length,
      completed: tasks.length - active.length,
      overdue: overdue.length,
    }
  }, [tasks])

  const visibleTasks = useMemo(() => {
    return tasks
      .filter((task) => {
        const status = getTaskStatus(task)
        if (filter === 'active') return !task.completed
        if (filter === 'done') return task.completed
        if (filter === 'overdue') return status === 'overdue'
        return true
      })
      .filter((task) => {
        const text =
          `${task.title} ${task.note} ${reminderMethodLabels[task.reminderMethod] || ''}`.toLowerCase()
        return text.includes(query.trim().toLowerCase())
      })
      .sort((a, b) => {
        if (a.completed !== b.completed) return a.completed ? 1 : -1
        return new Date(a.dueAt || '2999-12-31') - new Date(b.dueAt || '2999-12-31')
      })
  }, [filter, query, tasks])

  function addTask(event) {
    event.preventDefault()
    const cleanTitle = title.trim()

    if (!cleanTitle) return

    setTasks((currentTasks) => [
      {
        id: crypto.randomUUID(),
        title: cleanTitle,
        note: note.trim(),
        dueAt,
        priority,
        reminderMethod,
        completed: false,
        reminded: false,
      },
      ...currentTasks,
    ])
    setTitle('')
    setNote('')
    setDueAt(getDateTimeValue(60))
    setPriority('medium')
    setReminderMethod(DEFAULT_REMINDER_METHOD)
  }

  async function requestNotifications() {
    if (!('Notification' in window)) return
    const permission = await Notification.requestPermission()
    setNotificationState(permission)
  }

  function toggleTask(id) {
    setTasks((currentTasks) =>
      currentTasks.map((task) =>
        task.id === id ? { ...task, completed: !task.completed } : task,
      ),
    )
  }

  function removeTask(id) {
    setTasks((currentTasks) => currentTasks.filter((task) => task.id !== id))
  }

  function dismissPageReminder(id) {
    setPageReminders((currentReminders) =>
      currentReminders.filter((reminder) => reminder.id !== id),
    )
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Todo Reminder</p>
          <h1>待办事项提醒工具</h1>
        </div>
        <button
          className="ghost-button"
          type="button"
          onClick={requestNotifications}
          disabled={notificationState === 'granted' || notificationState === 'unsupported'}
          title="开启浏览器通知"
        >
          <Bell size={18} />
          {notificationState === 'granted' ? '通知已开启' : '开启通知'}
        </button>
      </header>

      <section className="summary-grid" aria-label="任务统计">
        <div>
          <span>全部</span>
          <strong>{stats.total}</strong>
        </div>
        <div>
          <span>进行中</span>
          <strong>{stats.active}</strong>
        </div>
        <div>
          <span>已完成</span>
          <strong>{stats.completed}</strong>
        </div>
        <div className={stats.overdue ? 'alert' : ''}>
          <span>已超时</span>
          <strong>{stats.overdue}</strong>
        </div>
      </section>

      <section className="workspace">
        <form className="task-form" onSubmit={addTask}>
          <div className="section-heading">
            <ClipboardList size={20} />
            <h2>新建提醒</h2>
          </div>

          <label>
            事项
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：18:00 前提交日报"
            />
          </label>

          <label>
            备注
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="补充地点、材料或下一步动作"
              rows="4"
            />
          </label>

          <div className="field-row">
            <label>
              提醒时间
              <input
                type="datetime-local"
                value={dueAt}
                onChange={(event) => setDueAt(event.target.value)}
              />
            </label>
            <label>
              优先级
              <select value={priority} onChange={(event) => setPriority(event.target.value)}>
                <option value="high">高优先级</option>
                <option value="medium">中优先级</option>
                <option value="low">低优先级</option>
              </select>
            </label>
          </div>

          <label>
            提醒方式
            <select
              value={reminderMethod}
              onChange={(event) => setReminderMethod(event.target.value)}
            >
              <option value="browser">浏览器通知</option>
              <option value="page">页面提示</option>
              <option value="silent">仅列表标记</option>
            </select>
          </label>

          <button className="primary-button" type="submit">
            <Plus size={18} />
            添加待办
          </button>
        </form>

        <section className="task-panel">
          <div className="toolbar">
            <div className="search-box">
              <Search size={18} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="搜索事项或备注"
              />
            </div>
            <div className="filters" aria-label="筛选任务">
              {[
                ['all', '全部'],
                ['active', '进行中'],
                ['overdue', '超时'],
                ['done', '完成'],
              ].map(([value, label]) => (
                <button
                  className={filter === value ? 'active' : ''}
                  key={value}
                  type="button"
                  onClick={() => setFilter(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="task-list">
            {visibleTasks.length ? (
              visibleTasks.map((task) => {
                const status = getTaskStatus(task)

                return (
                  <article className={`task-card ${status}`} key={task.id}>
                    <button
                      className="check-button"
                      type="button"
                      onClick={() => toggleTask(task.id)}
                      title={task.completed ? '标记为未完成' : '标记为完成'}
                    >
                      {task.completed ? <Check size={18} /> : <Circle size={18} />}
                    </button>
                    <div className="task-content">
                      <div className="task-title-row">
                        <h3>{task.title}</h3>
                        <span className={`priority ${task.priority}`}>
                          {priorityLabels[task.priority]}
                        </span>
                      </div>
                      {task.note && <p>{task.note}</p>}
                      <div className="task-meta">
                        <span>
                          <CalendarClock size={16} />
                          {formatDueTime(task.dueAt)}
                        </span>
                        <span>
                          <Bell size={16} />
                          {reminderMethodLabels[task.reminderMethod] ||
                            reminderMethodLabels[DEFAULT_REMINDER_METHOD]}
                        </span>
                        {status === 'overdue' && (
                          <span className="danger">
                            <AlarmClock size={16} />
                            已超时
                          </span>
                        )}
                        {status === 'soon' && (
                          <span className="warning">
                            <AlarmClock size={16} />
                            即将到期
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      className="delete-button"
                      type="button"
                      onClick={() => removeTask(task.id)}
                      title="删除"
                    >
                      <Trash2 size={18} />
                    </button>
                  </article>
                )
              })
            ) : (
              <div className="empty-state">
                <ClipboardList size={34} />
                <h3>没有匹配的待办</h3>
                <p>换个筛选条件，或者添加一个新的提醒。</p>
              </div>
            )}
          </div>
        </section>
      </section>

      {pageReminders.length > 0 && (
        <div className="reminder-stack" role="status" aria-live="polite">
          {pageReminders.map((reminder) => (
            <div className="reminder-toast" key={reminder.id}>
              <Bell size={18} />
              <div>
                <strong>{reminder.title}</strong>
                <span>{reminder.message}</span>
              </div>
              <button
                type="button"
                onClick={() => dismissPageReminder(reminder.id)}
                title="关闭页面提醒"
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}

export default App
