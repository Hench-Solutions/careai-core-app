export default function ComingSoon({ page = 'This page' }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '60px 20px', textAlign: 'center'
    }}>
      <div style={{ fontSize: 50, color: '#667eea', marginBottom: 16 }}>
        <i className="fas fa-tools"></i>
      </div>
      <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', marginBottom: 8 }}>
        {page}
      </h2>
      <p style={{ color: '#999', fontSize: 13 }}>
        This section is under development and will be available soon.
      </p>
    </div>
  )
}
