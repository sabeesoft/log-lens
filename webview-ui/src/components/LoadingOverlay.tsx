import { Loader2 } from 'lucide-react';

interface LoadingOverlayProps {
  visible: boolean;
}

export default function LoadingOverlay({ visible }: LoadingOverlayProps) {
  if (!visible) return null;

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(10, 10, 10, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        backdropFilter: 'blur(2px)'
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '12px'
        }}
      >
        <Loader2
          size={32}
          color="#3b82f6"
          style={{
            animation: 'spin 1s linear infinite'
          }}
        />
        <span
          style={{
            fontSize: '13px',
            color: '#a1a1aa',
            fontFamily: 'monospace'
          }}
        >
          Filtering...
        </span>
      </div>

      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
}
