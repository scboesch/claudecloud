import { useState } from 'react'
import './App.css'

const initialTasks = [
  { id: 1, text: 'Scaffold the React + Vite app', done: true },
  { id: 2, text: 'Run the dev server', done: true },
  { id: 3, text: 'Commit and push to GitHub', done: false },
]

function App() {
  const [tasks, setTasks] = useState(initialTasks)
  const [draft, setDraft] = useState('')

  const remaining = tasks.filter((task) => !task.done).length

  function addTask(event) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setTasks([...tasks, { id: Date.now(), text, done: false }])
    setDraft('')
  }

  function toggleTask(id) {
    setTasks(
      tasks.map((task) =>
        task.id === id ? { ...task, done: !task.done } : task,
      ),
    )
  }

  function removeTask(id) {
    setTasks(tasks.filter((task) => task.id !== id))
  }

  return (
    <main className="app">
      <header>
        <h1>Task List</h1>
        <p className="subtitle">
          {remaining} {remaining === 1 ? 'task' : 'tasks'} remaining
        </p>
      </header>

      <form className="new-task" onSubmit={addTask}>
        <input
          type="text"
          value={draft}
          placeholder="What needs doing?"
          onChange={(event) => setDraft(event.target.value)}
          aria-label="New task"
        />
        <button type="submit">Add</button>
      </form>

      <ul className="tasks">
        {tasks.map((task) => (
          <li key={task.id} className={task.done ? 'done' : undefined}>
            <label>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => toggleTask(task.id)}
              />
              <span>{task.text}</span>
            </label>
            <button
              type="button"
              className="remove"
              onClick={() => removeTask(task.id)}
              aria-label={`Remove ${task.text}`}
            >
              ×
            </button>
          </li>
        ))}
      </ul>

      {tasks.length === 0 && <p className="empty">Nothing here yet.</p>}
    </main>
  )
}

export default App
