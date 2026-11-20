import { Link } from 'react-router-dom'

const stats = [
  { label: 'Total Leads',       value: '248',  trend: '+12% this month', up: true,  icon: 'fas fa-user-plus',      iconClass: 'purple' },
  { label: 'Active Cases',      value: '64',   trend: '+5% this week',   up: true,  icon: 'fas fa-briefcase-medical', iconClass: 'green' },
  { label: 'Pending Estimates', value: '18',   trend: '-3 from yesterday',up: false, icon: 'fas fa-file-invoice',   iconClass: 'orange' },
  { label: 'Appointments',      value: '31',   trend: '+8 this week',    up: true,  icon: 'fas fa-calendar-check', iconClass: 'blue'  },
]

const quickActions = [
  { label: 'New Lead',        icon: 'fas fa-user-plus',      path: '/leads/new' },
  { label: 'Lead Search',     icon: 'fas fa-search',         path: '/leads/search' },
  { label: 'Appointments',    icon: 'fas fa-calendar-check', path: '/appointments' },
  { label: 'Estimate Req.',   icon: 'fas fa-file-invoice',   path: '/leads/estimate-request' },
  { label: 'Doc Upload',      icon: 'fas fa-file-upload',    path: '/documents' },
  { label: 'MIS Reports',     icon: 'fas fa-chart-bar',      path: '/reports/mis' },
]

const recentLeads = [
  { id: 'LD-1042', name: 'Ahmed Al Rashid', treatment: 'Cardiology', hospital: 'Apollo',   status: 'new',      category: 'Priority',  date: '27 Mar 2026' },
  { id: 'LD-1041', name: 'Sara Mohammed',   treatment: 'Orthopedics',hospital: 'Fortis',   status: 'active',   category: 'Normal',    date: '26 Mar 2026' },
  { id: 'LD-1040', name: 'Ravi Kumar',      treatment: 'Oncology',   hospital: 'Medanta',  status: 'pending',  category: 'Emergency', date: '25 Mar 2026' },
  { id: 'LD-1039', name: 'Fatima Al Hassan',treatment: 'Neurology',  hospital: 'Max',      status: 'active',   category: 'Normal',    date: '24 Mar 2026' },
  { id: 'LD-1038', name: 'John Smith',      treatment: 'Urology',    hospital: 'Manipal',  status: 'closed',   category: 'Normal',    date: '23 Mar 2026' },
]

const statusBadgeClass = {
  new: 'badge-new', active: 'badge-active', pending: 'badge-pending', closed: 'badge-closed'
}
const categoryBadgeClass = {
  Priority: 'badge-priority', Emergency: 'badge-emergency', Normal: 'badge-normal'
}

export default function Dashboard() {
  return (
    <div className="dashboard-page">
      <div className="dashboard-title">Dashboard Overview</div>

      {/* Stat Cards */}
      <div className="stat-cards-grid">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <div className={`stat-card-icon ${s.iconClass}`}>
              <i className={s.icon}></i>
            </div>
            <div className="stat-card-info">
              <div className="stat-card-value">{s.value}</div>
              <div className="stat-card-label">{s.label}</div>
              <div className={`stat-card-trend ${s.up ? 'up' : 'down'}`}>
                <i className={`fas fa-arrow-${s.up ? 'up' : 'down'}`}></i> {s.trend}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="card-panel">
        <div className="card-panel-header">
          <div className="card-panel-title"><i className="fas fa-bolt"></i> Quick Actions</div>
        </div>
        <div className="card-panel-body">
          <div className="quick-actions-grid">
            {quickActions.map((a) => (
              <Link to={a.path} className="quick-action-card" key={a.label}>
                <div className="quick-action-icon"><i className={a.icon}></i></div>
                <div className="quick-action-label">{a.label}</div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Leads */}
      <div className="card-panel">
        <div className="card-panel-header">
          <div className="card-panel-title"><i className="fas fa-list"></i> Recent Leads</div>
          <Link to="/leads/search" className="card-panel-action">View All</Link>
        </div>
        <div className="card-panel-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Lead ID</th>
                <th>Patient Name</th>
                <th>Treatment</th>
                <th>Hospital</th>
                <th>Category</th>
                <th>Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {recentLeads.map((lead) => (
                <tr key={lead.id}>
                  <td><strong>{lead.id}</strong></td>
                  <td>{lead.name}</td>
                  <td>{lead.treatment}</td>
                  <td>{lead.hospital}</td>
                  <td><span className={`badge ${categoryBadgeClass[lead.category]}`}>{lead.category}</span></td>
                  <td><span className={`badge ${statusBadgeClass[lead.status]}`}>{lead.status}</span></td>
                  <td>{lead.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
