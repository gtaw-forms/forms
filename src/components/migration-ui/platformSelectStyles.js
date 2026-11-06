// Platform-styled react-select styles (matches the .pmc theme tokens).
// Used by the Additional Employees multi-select in the create forms.
export const platformSelectStyles = {
  control: (base, state) => ({
    ...base,
    background: '#17171a',
    borderColor: state.isFocused ? '#d63a3a' : '#232327',
    boxShadow: 'none',
    minHeight: 38,
    borderRadius: 8,
    fontSize: 13.5,
    '&:hover': { borderColor: state.isFocused ? '#d63a3a' : '#3a3a42' },
  }),
  valueContainer: (base) => ({ ...base, padding: '2px 9px' }),
  singleValue: (base) => ({ ...base, color: '#e9e9ec' }),
  input: (base) => ({ ...base, color: '#e9e9ec' }),
  placeholder: (base) => ({ ...base, color: '#8e8e96' }),
  menu: (base) => ({
    ...base, background: '#121214', border: '1px solid #232327',
    borderRadius: 8, zIndex: 60, overflow: 'hidden',
  }),
  menuList: (base) => ({ ...base, padding: 4 }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? '#0f2b28' : state.isFocused ? '#1d1d22' : 'transparent',
    color: '#e9e9ec',
    fontSize: 13,
    cursor: 'pointer',
    borderRadius: 6,
  }),
  multiValue: (base) => ({ ...base, background: '#26262c', borderRadius: 6 }),
  multiValueLabel: (base) => ({ ...base, color: '#e9e9ec', fontSize: 12 }),
  multiValueRemove: (base) => ({
    ...base, color: '#8e8e96', ':hover': { background: '#3a2020', color: '#e5686d' },
  }),
  indicatorSeparator: () => ({ display: 'none' }),
  dropdownIndicator: (base) => ({ ...base, color: '#8e8e96' }),
  clearIndicator: (base) => ({ ...base, color: '#8e8e96' }),
  noOptionsMessage: (base) => ({ ...base, color: '#8e8e96', fontSize: 12.5 }),
};
