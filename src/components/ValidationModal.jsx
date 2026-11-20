export default function ValidationModal({ messages, onClose, type = 'error' }) {
  if (!messages || messages.length === 0) return null
  const isSuccess = type === 'success'
  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-box" onClick={e => e.stopPropagation()}>
        <div className={`vmodal-header${isSuccess ? ' success' : ''}`}>
          <i className={isSuccess ? 'fas fa-check-circle' : 'fas fa-exclamation-circle'}></i>
          <span>{isSuccess ? 'Success' : 'Please review the following fields'}</span>
        </div>
        <div className="vmodal-body">
          <ul className="vmodal-list">
            {messages.map((m, i) => (
              <li key={i}>
                <i className="fas fa-circle-dot"></i>
                {m}
              </li>
            ))}
          </ul>
        </div>
        <div className="vmodal-footer">
          <button className="vmodal-ok" onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}
