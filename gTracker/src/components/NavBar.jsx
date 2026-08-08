import { NavLink } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function NavBar() {
  const { user, logout } = useAuth()

  return (
    <nav className="navbar">
      <span className="navbar-brand">gTracker</span>
      <div className="navbar-links">
        <NavLink to="/" end>
          Dashboard
        </NavLink>
        <NavLink to="/history">History</NavLink>
        <NavLink to="/hand-breakdown">Hand Breakdown</NavLink>
      </div>
      <div className="navbar-user">
        <span>{user}</span>
        <button type="button" onClick={logout}>
          Log out
        </button>
      </div>
    </nav>
  )
}
