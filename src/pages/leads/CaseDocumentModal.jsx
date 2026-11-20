import { useState, useEffect, useRef } from 'react'
import { fetchDropdown, uploadDocument, fetchDocuments, openDocument } from '../../utils/api'
import ValidationModal from '../../components/ValidationModal'

// Medical Documents (docTypeCd 316) never accepts Word files — matches the
// restriction already enforced on the Lead Form's own Medical Reports upload.
const MEDICAL_DOC_CD = '316'
const MEDICAL_DOC_EXTS  = ['.jpg', '.jpeg', '.png', '.pdf']
const MEDICAL_DOC_LABEL = 'JPEG, JPG, PNG, PDF'
const GENERAL_DOC_ACCEPT = '.pdf,.jpg,.jpeg,.png,.doc,.docx'

export default function CaseDocumentModal({ claimNo, memberId, onClose }) {
  const [docs,       setDocs]       = useState([])
  const [docTypes,   setDocTypes]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [uploading,  setUploading]  = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])

  const [docCd,      setDocCd]      = useState('')
  const [file,       setFile]       = useState(null)
  const fileRef = useRef(null)

  useEffect(() => {
    Promise.all([
      fetchDocuments('LEAD', claimNo),
      fetchDropdown('ddlDocumentType', 'LEAD')
    ])
      .then(([d, t]) => { setDocs(d); setDocTypes(t) })
      .finally(() => setLoading(false))
  }, [claimNo])

  async function handleUpload() {
    const errs = []
    if (!docCd) errs.push('Please select a document type.')
    if (!file)  errs.push('Please choose a file to upload.')
    if (file && file.size > 10 * 1024 * 1024) errs.push('File exceeds the maximum allowed size of 10 MB.')
    if (file && docCd === MEDICAL_DOC_CD) {
      const ext = '.' + file.name.split('.').pop().toLowerCase()
      if (!MEDICAL_DOC_EXTS.includes(ext)) errs.push(`Medical Documents only accept ${MEDICAL_DOC_LABEL} files.`)
    }
    if (errs.length) { setModalMsgs(errs); return }

    const selected = docTypes.find(t => String(t.value) === String(docCd))
    const docNm = selected?.text ?? ''

    setUploading(true)
    try {
      await uploadDocument({ moduleCd: 'LEAD', referenceCd: claimNo, memberId, docTypeCd: docCd, docTypeNm: docNm, file, auth: true })
      setDocCd('')
      setFile(null)
      if (fileRef.current) fileRef.current.value = ''
      const updated = await fetchDocuments('LEAD', claimNo)
      setDocs(updated)
    } catch (err) {
      setModalMsgs([err?.message || 'Upload failed. Please try again.'])
    } finally {
      setUploading(false)
    }
  }

  async function handleView(id) {
    try {
      await openDocument(id)
    } catch {
      setModalMsgs(['Unable to open document. Please try again.'])
    }
  }

  return (
    <div className="csm-overlay" onClick={onClose}>
      <ValidationModal messages={modalMsgs} onClose={() => setModalMsgs([])} />

      <div className="csm-box" style={{ maxWidth: 700, width: '95%' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="csm-header">
          <span><i className="fas fa-file-alt"></i>&nbsp; Case Documents — {claimNo}</span>
          <button className="csm-close" onClick={onClose}><i className="fas fa-times"></i></button>
        </div>

        {/* Upload form */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #eee' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>

            <div style={{ flex: '1 1 180px', minWidth: 160 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                Document Type <span style={{ color: 'red' }}>*</span>
              </label>
              <select
                className="leadform-field-input"
                style={{ fontSize: 13 }}
                value={docCd}
                onChange={e => setDocCd(e.target.value)}
              >
                <option value="">-- Select Type --</option>
                {docTypes.map(t => (
                  <option key={t.value} value={t.value}>{t.text}</option>
                ))}
              </select>
            </div>

            <div style={{ flex: '2 1 220px', minWidth: 180 }}>
              <label style={{ fontSize: 12, color: '#666', display: 'block', marginBottom: 4 }}>
                File <span style={{ color: 'red' }}>*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                className="leadform-field-input"
                style={{ fontSize: 13, padding: '5px 8px' }}
                accept={docCd === MEDICAL_DOC_CD ? MEDICAL_DOC_EXTS.join(',') : GENERAL_DOC_ACCEPT}
                onChange={e => setFile(e.target.files?.[0] ?? null)}
              />
              {docCd === MEDICAL_DOC_CD && (
                <span style={{ fontSize: 11, color: '#888', display: 'block', marginTop: 3 }}>
                  Accepted: {MEDICAL_DOC_LABEL}
                </span>
              )}
            </div>

            <div style={{ flexShrink: 0 }}>
              <button
                className="btn-gradient"
                style={{ padding: '8px 20px', fontSize: 13, whiteSpace: 'nowrap' }}
                onClick={handleUpload}
                disabled={uploading}
              >
                {uploading
                  ? <><i className="fas fa-spinner fa-spin"></i> Uploading…</>
                  : <><i className="fas fa-upload"></i> Upload</>}
              </button>
            </div>

          </div>
        </div>

        {/* Document list */}
        <div style={{ maxHeight: 360, overflowY: 'auto', padding: '10px 16px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#888' }}>
              <i className="fas fa-spinner fa-spin" style={{ marginRight: 6 }}></i>Loading...
            </div>
          ) : docs.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24, color: '#aaa', fontSize: 13 }}>
              No documents uploaded yet.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f5fb', color: '#2e1d55' }}>
                  <th style={thStyle}>Document Type</th>
                  <th style={thStyle}>File Name</th>
                  <th style={thStyle}>Uploaded By</th>
                  <th style={thStyle}>Date</th>
                  <th style={thStyle}>View</th>
                </tr>
              </thead>
              <tbody>
                {docs.map(d => (
                  <tr key={d.id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                    <td style={tdStyle}>{d.docTypeNm || '—'}</td>
                    <td style={{ ...tdStyle, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        title={d.originalFileName || d.fileName}>
                      {d.originalFileName || d.fileName}
                    </td>
                    <td style={tdStyle}>{d.uploadedBy || '—'}</td>
                    <td style={tdStyle}>{d.uploadedDt}</td>
                    <td style={tdStyle}>
                      <button
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#632da7', fontSize: 15 }}
                        title="View document"
                        onClick={() => handleView(d.id)}
                      >
                        <i className="fas fa-eye"></i>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  )
}

const thStyle = {
  padding: '8px 10px',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 12,
  borderBottom: '2px solid #e2e8f0'
}

const tdStyle = {
  padding: '8px 10px',
  color: '#444'
}
