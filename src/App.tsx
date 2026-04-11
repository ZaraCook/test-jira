import './App.css'
import { AppShell } from './components/AppShell'
import { JiraRoutes } from './routes/JiraRoutes'

function App() {
  return (
    <AppShell>
      <JiraRoutes />
    </AppShell>
  )
}

export default App
