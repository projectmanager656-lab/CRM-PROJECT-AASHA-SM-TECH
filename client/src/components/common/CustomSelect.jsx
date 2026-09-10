import { useState, useRef, useEffect } from 'react';
import ReactDOM from 'react-dom';
import './CustomSelect.css';

export default function CustomSelect({
  options = [],
  value,
  onChange,
  placeholder = 'Select option...',
  disabled = false,
  searchable = true,
  className = '',
  id,
  name
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0, openUpward: false });

  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchInputRef = useRef(null);

  // Convert options to standard array of { value, label, subtitle }
  const normalizedOptions = options.map((opt) => {
    if (typeof opt === 'string' || typeof opt === 'number') {
      return { value: String(opt), label: String(opt) };
    }
    return {
      value: opt.value ?? opt._id ?? '',
      label: opt.label ?? opt.name ?? opt.title ?? opt.sessionTitle ?? String(opt.value || ''),
      subtitle: opt.subtitle || opt.code || opt.email || opt.category || ''
    };
  });

  const selectedOption = normalizedOptions.find((opt) => String(opt.value) === String(value));

  // Calculate position when opening
  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const openUpward = spaceBelow < 220 && rect.top > 220;

    const top = openUpward ? rect.top - 230 : rect.bottom + 4;
    setCoords({
      top: Math.max(10, top),
      left: rect.left,
      width: rect.width,
      openUpward
    });
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
      setSearch('');
      setIsOpen(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setIsOpen(false);
    }
  };

  // Close when clicking outside or pressing Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target) &&
        menuRef.current &&
        !menuRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    const handleScrollOrResize = () => {
      if (isOpen) updatePosition();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
      window.addEventListener('scroll', handleScrollOrResize, true);
      window.addEventListener('resize', handleScrollOrResize);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen]);

  const filteredOptions = normalizedOptions.filter(
    (opt) =>
      opt.label?.toLowerCase().includes(search.toLowerCase()) ||
      opt.subtitle?.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (val) => {
    if (onChange) onChange(val);
    setIsOpen(false);
  };

  return (
    <div className={`custom-select-container ${className}`} id={id}>
      <button
        ref={triggerRef}
        type="button"
        className={`custom-select-trigger ${isOpen ? 'is-open' : ''} ${disabled ? 'is-disabled' : ''}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className={`custom-select-value ${!selectedOption ? 'custom-select-placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <span className="custom-select-arrow">▼</span>
      </button>

      {isOpen &&
        ReactDOM.createPortal(
          <div
            ref={menuRef}
            className="custom-select-portal-menu"
            style={{
              position: 'fixed',
              top: `${coords.top}px`,
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              zIndex: 999999
            }}
          >
            {searchable && normalizedOptions.length > 5 && (
              <div className="custom-select-search-box">
                <input
                  ref={searchInputRef}
                  type="text"
                  className="custom-select-search-input"
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            )}

            <ul className="custom-select-options-list">
              {filteredOptions.length === 0 ? (
                <li className="custom-select-empty">No options found</li>
              ) : (
                filteredOptions.map((opt) => (
                  <li
                    key={String(opt.value)}
                    className={`custom-select-option ${String(opt.value) === String(value) ? 'is-selected' : ''}`}
                    onClick={() => handleSelect(opt.value)}
                  >
                    <div>
                      <div>{opt.label}</div>
                      {opt.subtitle && <span className="custom-select-option-subtitle">{opt.subtitle}</span>}
                    </div>
                    {String(opt.value) === String(value) && <span>✓</span>}
                  </li>
                ))
              )}
            </ul>
          </div>,
          document.body
        )}
    </div>
  );
}
