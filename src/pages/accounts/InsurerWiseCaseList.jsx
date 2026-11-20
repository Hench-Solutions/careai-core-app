import { useEffect, useRef } from 'react'

const CARDS = [
  {
    id: 1,
    icon: 'fa-solid fa-user-shield',
    colorIcon: 'cai-ic-purple', colorNum: 'cai-num-purple', colorBar: 'cai-bar-purple',
    trend: { cls: 'cai-tr-purple', icon: 'fa-solid fa-circle-check', label: 'Active' },
    count: 35, label: 'Total Pentacare Cases', barWidth: '1.4%',
  },
  {
    id: 2,
    icon: 'fa-solid fa-calendar-days',
    colorIcon: 'cai-ic-coral', colorNum: 'cai-num-coral', colorBar: 'cai-bar-coral',
    trend: { cls: 'cai-tr-up', icon: 'fa-solid fa-arrow-trend-up', label: '+12%' },
    count: 2526, label: 'Total Dubai Insurance Cases', barWidth: '73.7%',
  },
  {
    id: 3,
    icon: 'fa-solid fa-shield-heart',
    colorIcon: 'cai-ic-teal', colorNum: 'cai-num-teal', colorBar: 'cai-bar-teal',
    trend: { cls: 'cai-tr-up', icon: 'fa-solid fa-arrow-trend-up', label: '+8%' },
    count: 304, label: 'Total Lifeline TPA Cases', barWidth: '8.9%',
  },
  {
    id: 4,
    icon: 'fa-solid fa-indian-rupee-sign',
    colorIcon: 'cai-ic-pink', colorNum: 'cai-num-pink', colorBar: 'cai-bar-pink',
    trend: { cls: 'cai-tr-up', icon: 'fa-solid fa-arrow-trend-up', label: 'Active' },
    count: 200, label: 'Total Whealth Insurance Cases', barWidth: '5.8%',
  },
  {
    id: 5,
    icon: 'fa-solid fa-handshake',
    colorIcon: 'cai-ic-blue', colorNum: 'cai-num-blue', colorBar: 'cai-bar-blue',
    trend: { cls: 'cai-tr-up', icon: 'fa-solid fa-arrow-trend-up', label: '+5%' },
    count: 564, label: 'MIS Partner Cases', barWidth: '16.5%',
  },
]

function StatCard({ card }) {
  const barRef = useRef(null)

  /* Animate bar on mount — mirrors initCaiBars() JS */
  useEffect(() => {
    const bar = barRef.current
    if (!bar) return
    bar.style.width = '0%'
    const t = setTimeout(() => { bar.style.width = card.barWidth }, 160)
    return () => clearTimeout(t)
  }, [card.barWidth])

  return (
    <div className="cai-stat-card">
      <div className="cai-stat-card-top">
        <div className="cai-sc-row1">
          <div className={`cai-sc-icon ${card.colorIcon}`}>
            <i className={card.icon}></i>
          </div>
          <div className={`cai-sc-trend ${card.trend.cls}`}>
            <i className={card.trend.icon}></i> {card.trend.label}
          </div>
        </div>
        <div>
          <div className={`cai-sc-number ${card.colorNum}`}>{card.count.toLocaleString()}</div>
          <div className="cai-sc-label">{card.label}</div>
        </div>
        <div className="cai-sc-bar-wrap">
          <div ref={barRef} className={`cai-sc-bar ${card.colorBar}`} style={{ width: '0%' }}></div>
        </div>
      </div>
      <div className="cai-stat-card-foot">
        <button className="cai-view-link" onClick={() => alert(`View Details: ${card.label}`)}>
          <i className="fa-solid fa-table-list"></i> View Details
          <i className="fa-solid fa-arrow-right cai-arr"></i>
        </button>
        <button className="cai-dl-btn" title="Download" onClick={() => alert('Downloading...')}>
          <i className="fa-solid fa-file-arrow-down"></i>
        </button>
      </div>
    </div>
  )
}

export default function InsurerWiseCaseList() {
  return (
    <div className="cai-wrap">
      <div className="cai-section-card">

        {/* ── Header ── */}
        <div className="cai-section-header">
          <div className="cai-sh-icon-wrap">
            <i className="fa-solid fa-building-columns"></i>
          </div>
          <div className="cai-sh-title">
            <i className="fa-solid fa-building-columns"></i>
            Insurer Wise Case Details
          </div>
          <div className="cai-sh-pill">
            <i className="fa-solid fa-layer-group"></i>
            Total: 3,629+ cases
          </div>
        </div>

        {/* ── Cards ── */}
        <div className="cai-cards-body">
          <div className="cai-cards-grid">
            {CARDS.map(card => <StatCard key={card.id} card={card} />)}
          </div>
        </div>

      </div>
    </div>
  )
}
