import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fetchPageTree, fetchGroupDetail, saveGroup, fetchPageSections } from '../../utils/api'

// Sections are keyed by a fixed Page_Key rather than a pages.Id, since these
// pages are reached via in-app buttons (not the menu tree) and have no row
// in the `pages` table. Adding a new page here (plus its page_sections seed
// rows) is all it takes to make its buttons/sections admin-configurable —
// no other frontend change needed.
const SECTION_ACCESS_PAGES = [
  { key: 'LEAD_ACTION',           label: 'Lead Action' },
  { key: 'ESTIMATE_STATUS_PAGE',  label: 'Estimate Status' },
  { key: 'ESTIMATE_COMPARE_PAGE', label: 'Estimate Compare' },
]

// Modules with a "can see all records" toggle, backed by MT_GroupModuleAccess /
// dbo.fn_CanSeeAll. When unchecked, a user in this group only sees records they
// created or are assigned to (e.g. Case_Manager_Cd) rather than the full list.
const VISIBILITY_MODULES = [
  { code: 'LEAD',     label: 'Lead' },
  { code: 'PROVIDER', label: 'Provider' }
]
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
          <button
            className="vmodal-ok"
            style={{ background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)' }}
            onClick={onClose}
          >OK</button>
        </div>
      </div>
    </div>
  )
}

export default function GroupForm() {
  const navigate  = useNavigate()
  const { id }    = useParams()
  const isEdit    = Boolean(id)

  const [tree,         setTree]         = useState([])
  const [checkedNodes, setCheckedNodes] = useState(new Set())
  const [rights,       setRights]       = useState({})
  const [expandedL1,   setExpandedL1]   = useState(new Set())
  const [expandedL2,   setExpandedL2]   = useState(new Set())

  // Section-wise view permission (Phase 1) — scoped to the Lead Action page
  const [sections,       setSections]       = useState([])
  const [sectionChecked, setSectionChecked] = useState(new Set())

  // Module-wise "can see all records" visibility (i.e. LEAD, PROVIDER)
  const [moduleCanSeeAll, setModuleCanSeeAll] = useState({})

  const [groupNm,   setGroupNm]   = useState('')
  const [groupDesc, setGroupDesc] = useState('')
  const [actvInd,   setActvInd]   = useState(1)

  const [loading,    setLoading]    = useState(true)
  const [saving,     setSaving]     = useState(false)
  const [modalMsgs,  setModalMsgs]  = useState([])
  const [successMsg, setSuccessMsg] = useState('')

  useEffect(() => {
    async function load() {
      try {
        const treeData = await fetchPageTree()
        setTree(treeData)

        // Load section lists for every admin-configurable page (fixed keys,
        // no pages-table lookup needed). Section list is optional per page —
        // page-level assignment still works without it.
        const sectionLists = await Promise.all(
          SECTION_ACCESS_PAGES.map(p => fetchPageSections(p.key).catch(() => []))
        )
        setSections(sectionLists.flat())

        if (isEdit) {
          const detail = await fetchGroupDetail(id)
          if (detail) {
            setGroupNm(detail.groupNm ?? '')
            setGroupDesc(detail.groupDesc ?? '')
            setActvInd(detail.actvInd ?? 1)

            const assigned = detail.assignedPages ?? []
            const initChecked = new Set(assigned.map(p => p.pageId))
            const initRights  = {}
            assigned.forEach(p => {
              if (p.viewInd || p.editInd || p.createInd) {
                initRights[p.pageId] = {
                  view:   Boolean(p.viewInd),
                  edit:   Boolean(p.editInd),
                  create: Boolean(p.createInd)
                }
              }
            })
            setCheckedNodes(initChecked)
            setRights(initRights)

            const assignedSections = detail.assignedSections ?? []
            setSectionChecked(new Set(
              assignedSections.filter(s => s.viewInd === 1).map(s => s.sectionId)
            ))

            const moduleAccess = detail.moduleAccess ?? []
            setModuleCanSeeAll(Object.fromEntries(
              moduleAccess.map(m => [m.moduleCd, m.canSeeAll === 1])
            ))

            // Auto-expand L1 and L2 nodes that have assigned children
            const el1 = new Set()
            const el2 = new Set()
            treeData.forEach(l1 => {
              l1.children.forEach(l2 => {
                const anyL3 = l2.children.some(l3 => initChecked.has(l3.pageId))
                if (anyL3 || initChecked.has(l2.pageId)) {
                  el1.add(l1.pageId)
                  el2.add(l2.pageId)
                }
              })
              if (initChecked.has(l1.pageId)) el1.add(l1.pageId)
            })
            setExpandedL1(el1)
            setExpandedL2(el2)
          }
        }
      } catch {
        setModalMsgs(['Failed to load data. Please try again.'])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, isEdit])

  // ── Tree toggle handlers ──────────────────────────────────────────
  function toggleL1(l1Node) {
    const wasChecked = checkedNodes.has(l1Node.pageId)
    const newChecked = new Set(checkedNodes)
    const newRights  = { ...rights }
    if (!wasChecked) {
      newChecked.add(l1Node.pageId)
      l1Node.children.forEach(l2 => {
        newChecked.add(l2.pageId)
        l2.children.forEach(l3 => newChecked.add(l3.pageId))
      })
      setExpandedL1(prev => new Set([...prev, l1Node.pageId]))
    } else {
      newChecked.delete(l1Node.pageId)
      l1Node.children.forEach(l2 => {
        newChecked.delete(l2.pageId)
        l2.children.forEach(l3 => { newChecked.delete(l3.pageId); delete newRights[l3.pageId] })
      })
    }
    setCheckedNodes(newChecked)
    setRights(newRights)
  }

  function toggleL2(l1Node, l2Node) {
    const wasChecked = checkedNodes.has(l2Node.pageId)
    const newChecked = new Set(checkedNodes)
    const newRights  = { ...rights }
    if (!wasChecked) {
      newChecked.add(l2Node.pageId)
      newChecked.add(l1Node.pageId)
      l2Node.children.forEach(l3 => newChecked.add(l3.pageId))
      setExpandedL2(prev => new Set([...prev, l2Node.pageId]))
    } else {
      newChecked.delete(l2Node.pageId)
      l2Node.children.forEach(l3 => { newChecked.delete(l3.pageId); delete newRights[l3.pageId] })
      const anyL2 = l1Node.children.some(l2 => l2.pageId !== l2Node.pageId && newChecked.has(l2.pageId))
      if (!anyL2) newChecked.delete(l1Node.pageId)
    }
    setCheckedNodes(newChecked)
    setRights(newRights)
  }

  function toggleL3(l1Node, l2Node, l3Id) {
    const wasChecked = checkedNodes.has(l3Id)
    const newChecked = new Set(checkedNodes)
    const newRights  = { ...rights }
    if (!wasChecked) {
      newChecked.add(l3Id)
      newChecked.add(l2Node.pageId)
      newChecked.add(l1Node.pageId)
    } else {
      newChecked.delete(l3Id)
      delete newRights[l3Id]
      const anyL3 = l2Node.children.some(l3 => l3.pageId !== l3Id && newChecked.has(l3.pageId))
      if (!anyL3) {
        newChecked.delete(l2Node.pageId)
        const anyL2 = l1Node.children.some(l2 => l2.pageId !== l2Node.pageId && newChecked.has(l2.pageId))
        if (!anyL2) newChecked.delete(l1Node.pageId)
      }
    }
    setCheckedNodes(newChecked)
    setRights(newRights)
  }

  function toggleRight(l3Id, right) {
    setRights(prev => ({
      ...prev,
      [l3Id]: {
        view:   prev[l3Id]?.view   ?? false,
        edit:   prev[l3Id]?.edit   ?? false,
        create: prev[l3Id]?.create ?? false,
        [right]: !(prev[l3Id]?.[right] ?? false)
      }
    }))
  }

  function toggleModuleCanSeeAll(moduleCd) {
    setModuleCanSeeAll(prev => ({ ...prev, [moduleCd]: !prev[moduleCd] }))
  }

  function toggleSection(sectionId) {
    setSectionChecked(prev => {
      const n = new Set(prev)
      n.has(sectionId) ? n.delete(sectionId) : n.add(sectionId)
      return n
    })
  }

  // ── Save ─────────────────────────────────────────────────────────
  async function handleSave() {
    const errs = []
    if (!groupNm.trim()) errs.push('Group Name is required.')
    if (errs.length) { setModalMsgs(errs); return }

    const pages = [...checkedNodes].map(pageId => ({
      pageId,
      viewInd:   rights[pageId]?.view   ? 1 : 0,
      editInd:   rights[pageId]?.edit   ? 1 : 0,
      createInd: rights[pageId]?.create ? 1 : 0
    }))

    const sectionsPayload = sections.map(s => ({
      sectionId: s.id,
      viewInd:   sectionChecked.has(s.id) ? 1 : 0
    }))

    const moduleAccessPayload = VISIBILITY_MODULES.map(m => ({
      moduleCd:  m.code,
      canSeeAll: moduleCanSeeAll[m.code] ? 1 : 0
    }))

    const payload = {
      mode:      isEdit ? 'U' : 'A',
      id:        isEdit ? Number(id) : null,
      groupNm:   groupNm.trim(),
      groupDesc: groupDesc.trim(),
      actvInd,
      pages,
      sections: sectionsPayload,
      moduleAccess: moduleAccessPayload
    }

    setSaving(true)
    try {
      const result = await saveGroup(payload)
      const code   = result?.errorObj?.[0]?.errorCode
      if (code === 0) {
        setSuccessMsg(isEdit ? 'Group updated successfully!' : 'Group created successfully!')
      } else {
        setModalMsgs(['Failed to save group. Please try again.'])
      }
    } catch {
      setModalMsgs(['An error occurred while saving. Please try again.'])
    } finally {
      setSaving(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────
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
      <SuccessModal message={successMsg} onClose={() => navigate('/pagemanage/groups')} />

      {/* Header */}
      <div className="page-header-banner" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2>{isEdit ? 'Edit Group' : 'Add Group'}</h2>
        <button className="btn-outline" style={{ fontSize: 13, padding: '7px 16px' }}
          onClick={() => navigate('/pagemanage/groups')}>
          <i className="fas fa-arrow-left"></i>&nbsp; Back
        </button>
      </div>

      <div className="leadform-container" style={{ maxWidth: 900 }}>

        {/* Group Details */}
        <div className="leadform-section leadform-section-active">
          <div className="leadform-section-header">
            <span className="leadform-section-title">Group Details</span>
          </div>

          <div className="leadform-grid">
            {/* Group Name */}
            <div className="leadform-field">
              <label className="leadform-field-label">
                Group Name <span className="leadform-required-star">*</span>
              </label>
              <input
                className="leadform-field-input"
                type="text"
                maxLength={100}
                value={groupNm}
                onChange={e => setGroupNm(e.target.value)}
                placeholder="Enter group name"
              />
            </div>

            {/* Status */}
            <div className="leadform-field">
              <label className="leadform-field-label">Status</label>
              <div style={{ display: 'flex', gap: 20, alignItems: 'center', marginTop: 6 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="actvInd" value={1}
                    checked={actvInd === 1} onChange={() => setActvInd(1)} />
                  Active
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13 }}>
                  <input type="radio" name="actvInd" value={0}
                    checked={actvInd === 0} onChange={() => setActvInd(0)} />
                  Inactive
                </label>
              </div>
            </div>

            {/* Description */}
            <div className="leadform-field leadform-full-width">
              <label className="leadform-field-label">Description</label>
              <textarea
                className="leadform-field-textarea"
                maxLength={300}
                rows={3}
                value={groupDesc}
                onChange={e => setGroupDesc(e.target.value)}
                placeholder="Enter group description"
              />
            </div>
          </div>
        </div>

        {/* Page Assignment Tree */}
        <div className="leadform-section leadform-section-active" style={{ marginTop: 16 }}>
          <div className="leadform-section-header">
            <span className="leadform-section-title">Assign Pages</span>
          </div>

          {tree.length === 0 ? (
            <p style={{ padding: '12px 0', color: '#888', fontSize: 13 }}>No pages available.</p>
          ) : (
            <div className="grp-tree-container">
              {tree.map(l1 => (
                <div key={l1.pageId} className="grp-tree-l1">
                  {/* L1 header */}
                  <div className="grp-tree-l1-header">
                    <button
                      className="grp-tree-expand-btn"
                      onClick={() => setExpandedL1(prev => {
                        const n = new Set(prev)
                        n.has(l1.pageId) ? n.delete(l1.pageId) : n.add(l1.pageId)
                        return n
                      })}
                    >
                      <i className={`fas fa-chevron-${expandedL1.has(l1.pageId) ? 'down' : 'right'}`}></i>
                    </button>
                    <label className="grp-tree-node-label">
                      <input
                        type="checkbox"
                        checked={checkedNodes.has(l1.pageId)}
                        onChange={() => toggleL1(l1)}
                      />
                      <span>{l1.pageTitle}</span>
                    </label>
                  </div>

                  {/* L2 nodes */}
                  {expandedL1.has(l1.pageId) && (
                    <div className="grp-tree-l1-children">
                      {l1.children.map(l2 => (
                        <div key={l2.pageId} className="grp-tree-l2">
                          {/* L2 header */}
                          <div className="grp-tree-l2-header">
                            {l2.children.length > 0 && (
                              <button
                                className="grp-tree-expand-btn"
                                onClick={() => setExpandedL2(prev => {
                                  const n = new Set(prev)
                                  n.has(l2.pageId) ? n.delete(l2.pageId) : n.add(l2.pageId)
                                  return n
                                })}
                              >
                                <i className={`fas fa-chevron-${expandedL2.has(l2.pageId) ? 'down' : 'right'}`}></i>
                              </button>
                            )}
                            {l2.children.length === 0 && <span style={{ width: 22, display: 'inline-block' }}></span>}
                            <label className="grp-tree-node-label">
                              <input
                                type="checkbox"
                                checked={checkedNodes.has(l2.pageId)}
                                onChange={() => toggleL2(l1, l2)}
                              />
                              <span>{l2.pageTitle}</span>
                            </label>
                          </div>

                          {/* L3 nodes */}
                          {expandedL2.has(l2.pageId) && l2.children.length > 0 && (
                            <div className="grp-tree-l2-children">
                              {l2.children.map(l3 => {
                                const l3Checked = checkedNodes.has(l3.pageId)
                                const r         = rights[l3.pageId] ?? {}
                                return (
                                  <div key={l3.pageId} className="grp-tree-l3">
                                    <label className="grp-tree-node-label">
                                      <input
                                        type="checkbox"
                                        checked={l3Checked}
                                        onChange={() => toggleL3(l1, l2, l3.pageId)}
                                      />
                                      <span>{l3.pageTitle}</span>
                                    </label>
                                    <div className="grp-tree-rights">
                                      <label className={`grp-tree-right-label${!l3Checked ? ' grp-tree-right-disabled' : ''}`}>
                                        <input
                                          type="checkbox"
                                          disabled={!l3Checked}
                                          checked={r.view ?? false}
                                          onChange={() => toggleRight(l3.pageId, 'view')}
                                        />
                                        View
                                      </label>
                                      <label className={`grp-tree-right-label${!l3Checked ? ' grp-tree-right-disabled' : ''}`}>
                                        <input
                                          type="checkbox"
                                          disabled={!l3Checked}
                                          checked={r.edit ?? false}
                                          onChange={() => toggleRight(l3.pageId, 'edit')}
                                        />
                                        Edit
                                      </label>
                                      <label className={`grp-tree-right-label${!l3Checked ? ' grp-tree-right-disabled' : ''}`}>
                                        <input
                                          type="checkbox"
                                          disabled={!l3Checked}
                                          checked={r.create ?? false}
                                          onChange={() => toggleRight(l3.pageId, 'create')}
                                        />
                                        Add New
                                      </label>
                                    </div>

                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Module Visibility — "Can see all records" per module. When unchecked,
            users in this group only see records they created or are assigned to
            (e.g. Case_Manager_Cd), backed by MT_GroupModuleAccess / fn_CanSeeAll. */}
        <div className="leadform-section leadform-section-active" style={{ marginTop: 16 }}>
          <div className="leadform-section-header">
            <span className="leadform-section-title">Module Visibility</span>
          </div>
          <div className="grp-tree-container">
            {VISIBILITY_MODULES.map(m => (
              <div key={m.code} className="grp-tree-l3">
                <span style={{ fontSize: 13 }}>{m.label}</span>
                <div className="grp-tree-rights">
                  <label className="grp-tree-right-label">
                    <input
                      type="checkbox"
                      checked={Boolean(moduleCanSeeAll[m.code])}
                      onChange={() => toggleModuleCanSeeAll(m.code)}
                    />
                    Can see all records
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section Access (Phase 1, view-only) — one block per admin-configurable
            page, standalone rather than nested under the pages tree since these
            pages are reached via in-app buttons, not menu links, so they have no
            row in the pages tree to nest under. */}
        {SECTION_ACCESS_PAGES.map(p => {
          const pageSections = sections.filter(sec => sec.pageKey === p.key)
          if (pageSections.length === 0) return null
          return (
            <div key={p.key} className="leadform-section leadform-section-active" style={{ marginTop: 16 }}>
              <div className="leadform-section-header">
                <span className="leadform-section-title">{p.label} — Section Access</span>
              </div>
              <div className="grp-tree-container">
                {pageSections.map(sec => (
                  <div key={sec.id} className="grp-tree-l3">
                    <span style={{ fontSize: 13 }}>{sec.sectionLabel}</span>
                    <div className="grp-tree-rights">
                      <label className="grp-tree-right-label">
                        <input
                          type="checkbox"
                          checked={sectionChecked.has(sec.id)}
                          onChange={() => toggleSection(sec.id)}
                        />
                        View
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {/* Footer buttons */}
        <div style={{ display: 'flex', gap: 12, marginTop: 20, justifyContent: 'flex-end' }}>
          <button className="btn-outline" style={{ fontSize: 13, padding: '8px 20px' }}
            onClick={() => navigate('/pagemanage/groups')}>
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
