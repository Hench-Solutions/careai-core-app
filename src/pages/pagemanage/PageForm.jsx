import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPageDetail, savePage } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

function SuccessModal({ message, onClose }) {
  if (!message) return null
  return (
    <div className="vmodal-overlay" onClick={onClose}>
      <div className="vmodal-box" onClick={e => e.stopPropagation()}>
        <div className="vmodal-header" style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}>
          <i className="fas fa-check-circle"></i><span>Success</span>
        </div>
        <div className="vmodal-body">
          <ul className="vmodal-list"><li><i className="fas fa-check"></i>{message}</li></ul>
        </div>
        <div className="vmodal-footer">
          <button className="vmodal-ok"
            style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}
            onClick={onClose}>OK</button>
        </div>
      </div>
    </div>
  )
}

// Derive SP modes and navigation from level + isEdit
const LEVEL_META = {
  1: { loadMode: 'P', addMode: 'A', editMode: 'U', title: (e) => e ? 'Edit Page'          : 'Add Page',          parentId: 0, pageLevel: 1 },
  2: { loadMode: 'C', addMode: 'I', editMode: 'E', title: (e) => e ? 'Edit Sub Page'       : 'Add Sub Page',       pageLevel: 2 },
  3: { loadMode: 'C', addMode: 'R', editMode: 'E', title: (e) => e ? 'Edit Tertiary Page'  : 'Add Tertiary Page',  pageLevel: 3 }
}

export default function PageForm({ level }) {
  const navigate              = useNavigate()
  const { id, parentId, subParentId } = useParams()
  const isEdit                = Boolean(id)
  const meta                  = LEVEL_META[level]

  // The parent used for save: L1→0, L2→parentId, L3→subParentId
  const saveParentId = level === 1 ? 0 : level === 2 ? Number(parentId) : Number(subParentId)

  const [pageTitle,  setPageTitle]  = useState('')
  const [pageUrl,    setPageUrl]    = useState('')
  const [actvInd,    setActvInd]    = useState(1)

  const [loading,    setLoading]    = useState(isEdit)
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    if (!isEdit) return
    fetchPageDetail(meta.loadMode, id)
      .then(detail => {
        if (detail) {
          setPageTitle(detail.pageTitle ?? '')
          setPageUrl(detail.pageUrl ?? '')
          setActvInd(detail.actvInd ?? 1)
        }
      })
      .catch(() => setModalMsgs(['Failed to load page details. Please try again.']))
      .finally(() => setLoading(false))
  }, [id, isEdit])

  function backUrl() {
    if (level === 1) return '/pagemanage/pages'
    if (level === 2) return `/pagemanage/pages/${parentId}/sub`
    return `/pagemanage/pages/${parentId}/sub/${subParentId}/tertiary`
  }

  async function handleSave() {
    const errs = []
    if (!pageTitle.trim()) errs.push('Page Title is required.')
    if (!pageUrl.trim())   errs.push('Page URL is required.')
    if (errs.length) { setModalMsgs(errs); return }

    const payload = {
      mode:      isEdit ? meta.editMode : meta.addMode,
      id:        isEdit ? Number(id) : null,
      parentId:  saveParentId,
      pageLevel: meta.pageLevel,
      pageTitle: pageTitle.trim(),
      pageUrl:   pageUrl.trim(),
      actvInd
    }

    setSaving(true)
    try {
      const result = await savePage(payload)
      const code   = result?.errorObj?.[0]?.errorCode
      if (code === 0) {
        setSuccessMsg(isEdit ? 'Page updated successfully!' : 'Page added successfully!')
      } else {
        setModalMsgs(['Failed to save page. Please try again.'])
      }
    } catch {
      setModalMsgs(['An error occurred while saving. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="lsrch-page">
        <div className="lsrch-state-row" style={{ padding: 40, textAlign: 'center' }}>
          <i className="fas fa-spinner fa-spin" style={{ marginRight: 8 }}></i>Loading...
        </div>
      </div>
    )
  }

  return (
    <div className="lsrch-page">
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />
      <SuccessModal message={successMsg} onClose={() => navigate(backUrl())} />

      {/* Header */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>{meta.title(isEdit)}</h2>
        <button className="btn-outline" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate(backUrl())}>
          <i className="fas fa-arrow-left"></i>&nbsp; Back
        </button>
      </div>

      <div className="leadform-container" style={{ maxWidth: 700 }}>
        <div className="leadform-section leadform-section-active">
          <div className="leadform-section-header">
            <span className="leadform-section-title">Page Details</span>
          </div>

          <div className="leadform-grid">
            {/* Page Title */}
            <div className="leadform-field leadform-full-width">
              <label className="leadform-field-label">
                Page Title <span className="leadform-required-star">*</span>
              </label>
              <input className="leadform-field-input" type="text" maxLength={100}
                value={pageTitle} onChange={e => setPageTitle(e.target.value)}
                placeholder="Enter page title" />
            </div>

            {/* Page URL */}
            <div className="leadform-field leadform-full-width">
              <label className="leadform-field-label">
                Page URL <span className="leadform-required-star">*</span>
              </label>
              <input className="leadform-field-input" type="text" maxLength={500}
                value={pageUrl} onChange={e => setPageUrl(e.target.value)}
                placeholder="e.g. /pagemanage/groups" />
            </div>

            {/* Status */}
            <div className="leadform-field">
              <label className="leadform-field-label">Status</label>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="actvInd" checked={actvInd === 1} onChange={() => setActvInd(1)} />
                  Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="actvInd" checked={actvInd === 0} onChange={() => setActvInd(0)} />
                  Inactive
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-outline" style={{ fontSize: 13, padding: '8px 20px' }}
            onClick={() => navigate(backUrl())}>
            Cancel
          </button>
          <button className="btn-gradient" style={{ fontSize: 13, padding: '8px 24px' }}
            onClick={handleSave} disabled={saving}>
            {saving
              ? <><i className="fas fa-spinner fa-spin"></i> Saving...</>
              : <><i className="fas fa-save"></i> {isEdit ? 'Update' : 'Save'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
