import Select, { components } from 'react-select'

/**
 * Searchable calling-code picker with real flag images.
 * Flags loaded from flagcdn.com (free, no key, works on Windows).
 *
 * Props:
 *   codes    — raw array from fetchCallingCodes()
 *              each item: { value, isoCode, country_Nm }
 *   value    — currently selected calling code string (e.g. "+91")
 *   onChange — (callingCodeString) => void
 */

const FLAG_URL = iso =>
  iso ? `https://flagcdn.com/w20/${iso.toLowerCase()}.png` : null

const FlagImg = ({ iso, style = {} }) => {
  const src = FLAG_URL(iso)
  if (!src) return <span style={{ width: 20, textAlign: 'center', flexShrink: 0, fontSize: 13, ...style }}>🌐</span>
  return (
    <img
      src={src}
      alt={iso}
      style={{ width: 20, height: 14, objectFit: 'cover', borderRadius: 2, flexShrink: 0, ...style }}
      onError={e => { e.currentTarget.replaceWith(Object.assign(document.createElement('span'), { textContent: '🌐', style: 'width:20px;font-size:13px;flex-shrink:0' })) }}
    />
  )
}

const SELECT_OPTION = { value: '', label: '--Select--', callingCode: '', countryNm: '', isoCode: '' }

const buildOptions = codes => [
  SELECT_OPTION,
  ...codes.map(c => ({
    value:      c.value,
    label:      `${c.country_Nm || ''} ${c.value}`,
    callingCode: c.value,
    countryNm:  c.country_Nm || '',
    isoCode:    c.isoCode || '',
  }))
]

/** Dropdown list row: flag image + country name + code */
const formatOptionLabel = (opt, { context }) => {
  if (!opt.value) return <span style={{ fontSize: 12, color: '#aaa' }}>--Select--</span>
  return context === 'value'
    ? (
      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
        <FlagImg iso={opt.isoCode} />
        <span style={{ fontSize: 12, fontWeight: 500, whiteSpace: 'nowrap' }}>{opt.callingCode}</span>
      </span>
    )
    : (
      <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FlagImg iso={opt.isoCode} />
        <span style={{ fontSize: 13, flex: 1 }}>{opt.countryNm}</span>
        <span style={{ fontSize: 12, color: '#888', flexShrink: 0 }}>{opt.callingCode}</span>
      </span>
    )
}

/** Search by country name OR calling code */
const filterOption = (option, input) => {
  if (!input) return true
  const q = input.toLowerCase()
  return (
    option.data.countryNm.toLowerCase().includes(q) ||
    option.data.callingCode.includes(q)
  )
}

/** Replace dropdown indicator with a search icon to signal searchability */
const DropdownIndicator = props => (
  <components.DropdownIndicator {...props}>
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  </components.DropdownIndicator>
)

const selectStyles = (hasError = false) => ({
  container: base => ({
    ...base,
    flex: '0 0 105px',
    minWidth: 105,
  }),
  control: (base, { isFocused }) => ({
    ...base,
    minHeight: 34,
    height: 34,
    border: `1px solid ${isFocused ? '#667eea' : hasError ? '#e53e3e' : '#ddd'}`,
    borderRadius: 4,
    background: '#f8f9fa',
    boxShadow: isFocused ? '0 0 0 2px rgba(102,126,234,0.1)' : hasError ? '0 0 0 2px rgba(229,62,62,0.1)' : 'none',
    cursor: 'text',
    '&:hover': { borderColor: hasError ? '#e53e3e' : '#667eea' },
  }),
  valueContainer: base => ({
    ...base,
    padding: '0 6px',
    height: 34,
    flexWrap: 'nowrap',
  }),
  input: base => ({
    ...base,
    margin: 0,
    padding: 0,
    fontSize: 12,
    color: '#333',
  }),
  singleValue: base => ({
    ...base,
    margin: 0,
  }),
  placeholder: base => ({
    ...base,
    fontSize: 12,
    color: '#aaa',
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: base => ({
    ...base,
    padding: '0 6px',
  }),
  menu: base => ({
    ...base,
    zIndex: 9999,
    minWidth: 270,
    left: 0,
    fontSize: 13,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    border: '1px solid #e0e0e0',
  }),
  menuPortal: base => ({ ...base, zIndex: 9999 }),
  option: (base, { isFocused, isSelected }) => ({
    ...base,
    padding: '7px 10px',
    background: isSelected ? '#667eea' : isFocused ? '#f0f0ff' : 'white',
    color: isSelected ? 'white' : '#333',
    cursor: 'pointer',
  }),
  noOptionsMessage: base => ({
    ...base,
    fontSize: 13,
    color: '#888',
  }),
})

export default function CallingCodeSelect({ codes = [], value = '', onChange, hasError = false }) {
  const options  = buildOptions(codes)
  const selected = options.find(o => o.value === value) ?? SELECT_OPTION
  const styles   = selectStyles(hasError)

  return (
    <Select
      options={options}
      value={selected}
      onChange={opt => onChange(opt?.value ?? '')}
      isSearchable
      filterOption={filterOption}
      formatOptionLabel={formatOptionLabel}
      components={{ DropdownIndicator }}
      styles={styles}
      menuPortalTarget={document.body}
      menuPosition="fixed"
      placeholder="--Select--"
      noOptionsMessage={() => 'No country found'}
    />
  )
}
