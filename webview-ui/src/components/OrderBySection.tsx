import { ArrowUpDown } from 'lucide-react';
import CollapsibleSection from './CollapsibleSection';
import SearchableSelect from './SearchableSelect';

interface OrderBySectionProps {
  allFields: string[];
  orderByField: string;
  orderByDirection: 'asc' | 'desc';
  onFieldChange: (field: string) => void;
  onDirectionChange: (direction: 'asc' | 'desc') => void;
}

export default function OrderBySection({
  allFields,
  orderByField,
  orderByDirection,
  onFieldChange,
  onDirectionChange
}: OrderBySectionProps) {
  return (
    <CollapsibleSection
      title="ORDER BY"
      icon={<ArrowUpDown size={12} />}
      iconColor="#a78bfa"
      defaultExpanded={false}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>
        <SearchableSelect
          value={orderByField}
          options={allFields}
          onChange={onFieldChange}
          placeholder="none"
          style={{ flex: '1 1 200px', minWidth: '150px', maxWidth: '300px' }}
        />

        {orderByField && (
          <div style={{ display: 'flex', backgroundColor: '#222', borderRadius: '3px', padding: '1px' }}>
            <button
              onClick={() => onDirectionChange('asc')}
              style={{
                padding: '2px 8px',
                borderRadius: '2px',
                fontSize: '10px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: orderByDirection === 'asc' ? '#3b82f6' : 'transparent',
                color: orderByDirection === 'asc' ? '#fff' : '#71717a',
                fontFamily: 'monospace'
              }}
            >
              ASC
            </button>
            <button
              onClick={() => onDirectionChange('desc')}
              style={{
                padding: '2px 8px',
                borderRadius: '2px',
                fontSize: '10px',
                fontWeight: 700,
                border: 'none',
                cursor: 'pointer',
                backgroundColor: orderByDirection === 'desc' ? '#3b82f6' : 'transparent',
                color: orderByDirection === 'desc' ? '#fff' : '#71717a',
                fontFamily: 'monospace'
              }}
            >
              DESC
            </button>
          </div>
        )}
      </div>
    </CollapsibleSection>
  );
}
