import { useCallback, useMemo, useState, useRef } from 'react';
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  useReactFlow,
  MarkerType,
  Handle,
  Position
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from '@dagrejs/dagre';
import { X, AlertCircle, AlertTriangle, Activity, Clock, Copy, Check, RotateCcw } from 'lucide-react';
import LogRow from './LogRow';
import { LogEntry } from '../types';
import { buildServiceGraph, detectTraceConfig, ServiceNode as ServiceNodeData, getServiceValue } from '../utils/traceUtils';
import { getLevelBorderColor } from '../utils/logUtils';

interface TraceModalProps {
  traceId: string;
  traceLogs: LogEntry[];
  onClose: () => void;
}

// Custom node data type
interface CustomNodeData extends ServiceNodeData {
  isSelected: boolean;
  onClick: () => void;
}

// Custom node component for services
function ServiceNodeComponent({ data }: { data: CustomNodeData }) {
  const nodeData = data;

  const getBorderColor = () => {
    if (nodeData.hasErrors) return '#ef4444';
    if (nodeData.hasWarnings) return '#f59e0b';
    return '#3b82f6';
  };

  const getStatusIcon = () => {
    if (nodeData.hasErrors) return <AlertCircle size={14} color="#ef4444" />;
    if (nodeData.hasWarnings) return <AlertTriangle size={14} color="#f59e0b" />;
    return <Activity size={14} color="#22c55e" />;
  };

  return (
    <div
      onClick={nodeData.onClick}
      style={{
        padding: '12px 16px',
        borderRadius: '8px',
        backgroundColor: nodeData.isSelected ? '#1a1a1a' : '#111',
        border: `2px solid ${nodeData.isSelected ? '#60a5fa' : getBorderColor()}`,
        boxShadow: nodeData.isSelected
          ? '0 0 0 2px rgba(96, 165, 250, 0.3), 0 4px 12px rgba(0, 0, 0, 0.4)'
          : '0 2px 8px rgba(0, 0, 0, 0.3)',
        minWidth: '140px',
        cursor: 'pointer',
        transition: 'all 0.2s'
      }}
    >
      <Handle type="target" position={Position.Left} style={{ background: '#333', border: 'none' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        {getStatusIcon()}
        <span style={{
          fontSize: '13px',
          fontWeight: 600,
          color: '#f3f4f6',
          fontFamily: 'monospace'
        }}>
          {nodeData.label}
        </span>
      </div>

      <div style={{
        fontSize: '11px',
        color: '#71717a',
        fontFamily: 'monospace',
        display: 'flex',
        alignItems: 'center',
        gap: '4px'
      }}>
        <Clock size={10} />
        {nodeData.logCount} log{nodeData.logCount !== 1 ? 's' : ''}
      </div>

      <Handle type="source" position={Position.Right} style={{ background: '#333', border: 'none' }} />
    </div>
  );
}

const nodeTypes = {
  serviceNode: ServiceNodeComponent
};

// Reset view button component (must be inside ReactFlow)
function ResetViewButton({ onReset }: { onReset: () => void }) {
  const { fitView } = useReactFlow();

  const handleReset = () => {
    onReset();
    // Small delay to let nodes update before fitting view
    setTimeout(() => fitView({ padding: 0.3, duration: 300 }), 50);
  };

  return (
    <button
      onClick={handleReset}
      style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        backgroundColor: '#111',
        border: '1px solid #222',
        borderRadius: '8px',
        padding: '8px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        color: '#71717a',
        fontSize: '11px',
        fontFamily: 'monospace',
        fontWeight: 600,
        zIndex: 10,
        transition: 'all 0.2s'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = '#1a1a1a';
        e.currentTarget.style.color = '#a1a1aa';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = '#111';
        e.currentTarget.style.color = '#71717a';
      }}
      title="Reset view"
    >
      <RotateCcw size={14} />
      RESET VIEW
    </button>
  );
}

// Layout the graph using dagre
function getLayoutedElements(
  nodes: Node[],
  edges: Edge[],
  direction = 'LR'
): { nodes: Node[]; edges: Edge[] } {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  const nodeWidth = 160;
  const nodeHeight = 70;

  dagreGraph.setGraph({ rankdir: direction, nodesep: 60, ranksep: 120 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2
      }
    };
  });

  return { nodes: layoutedNodes, edges };
}

// Tree node component for sidebar
const TreeNode = ({ value, nodeKey, depth }: { value: any; nodeKey: string | null; depth: number }) => {
  const [expanded, setExpanded] = useState(depth < 2);
  const indent = depth * 16;

  if (value === null || value === undefined) {
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
        <span style={{ color: '#71717a' }}>{String(value)}</span>
      </div>
    );
  }

  if (typeof value !== 'object') {
    const color = typeof value === 'string' ? '#34d399' : typeof value === 'boolean' ? '#f59e0b' : '#a78bfa';
    return (
      <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
        {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
        <span style={{ color }}>{typeof value === 'string' ? `"${value}"` : String(value)}</span>
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((v, i) => [String(i), v]) : Object.entries(value);
  const bracket = isArray ? ['[', ']'] : ['{', '}'];

  return (
    <div style={{ marginLeft: `${indent}px`, fontFamily: 'monospace', fontSize: '11px' }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{ cursor: 'pointer', color: '#d4d4d8', userSelect: 'none' }}
      >
        <span style={{ color: '#71717a', marginRight: '4px' }}>{expanded ? '▼' : '▶'}</span>
        {nodeKey && <span style={{ color: '#60a5fa' }}>{nodeKey}: </span>}
        <span style={{ color: '#71717a' }}>{bracket[0]}</span>
        {!expanded && <span style={{ color: '#71717a' }}>...</span>}
        {!expanded && <span style={{ color: '#71717a' }}>{bracket[1]}</span>}
      </div>
      {expanded && (
        <>
          {entries.map(([k, v]) => (
            <TreeNode key={`${nodeKey || 'root'}-${k}`} value={v} nodeKey={k} depth={depth + 1} />
          ))}
          <div style={{ marginLeft: `${indent}px`, color: '#71717a' }}>{bracket[1]}</div>
        </>
      )}
    </div>
  );
};

export default function TraceModal({ traceId, traceLogs, onClose }: TraceModalProps) {
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [selectedLogIndex, setSelectedLogIndex] = useState<number | null>(null);
  const [splitPosition, setSplitPosition] = useState(50); // percentage for top panel
  const [sidebarWidth, setSidebarWidth] = useState(400); // sidebar width in pixels
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'pretty' | 'raw' | 'tree'>('pretty');
  const containerRef = useRef<HTMLDivElement>(null);

  // Build the graph data
  const traceConfig = useMemo(() => detectTraceConfig(traceLogs), [traceLogs]);
  const graph = useMemo(() => buildServiceGraph(traceLogs, traceConfig), [traceLogs, traceConfig]);

  // Convert to React Flow format
  const initialNodes: Node[] = useMemo(() =>
    graph.nodes.map((node) => ({
      id: node.id,
      type: 'serviceNode',
      position: { x: 0, y: 0 },
      data: {
        ...node,
        isSelected: selectedService === node.id,
        onClick: () => setSelectedService(selectedService === node.id ? null : node.id)
      }
    })),
    [graph.nodes, selectedService]
  );

  const initialEdges: Edge[] = useMemo(() =>
    graph.edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      animated: true,
      style: { stroke: '#333', strokeWidth: 2 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#333'
      },
      label: edge.requestCount > 1 ? `${edge.requestCount}` : undefined,
      labelStyle: { fill: '#71717a', fontSize: 10, fontFamily: 'monospace' },
      labelBgStyle: { fill: '#111', fillOpacity: 0.9 }
    })),
    [graph.edges]
  );

  // Apply layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(
    () => getLayoutedElements(initialNodes, initialEdges),
    [initialNodes, initialEdges]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, , onEdgesChange] = useEdgesState(layoutedEdges);

  // Update nodes when selection changes
  const handleNodeClick = useCallback((serviceId: string) => {
    setSelectedService(prev => prev === serviceId ? null : serviceId);
    setNodes(nds => nds.map(node => ({
      ...node,
      data: {
        ...node.data,
        isSelected: node.id === serviceId && selectedService !== serviceId,
        onClick: () => handleNodeClick(node.id)
      }
    })));
  }, [selectedService, setNodes]);

  // Filter logs for selected service
  const filteredLogs = useMemo(() => {
    if (!selectedService) return traceLogs;
    return traceLogs.filter(log => {
      if (typeof log === 'string') return false;
      return getServiceValue(log, traceConfig.serviceNameField) === selectedService;
    });
  }, [selectedService, traceLogs, traceConfig.serviceNameField]);

  // Get selected log for sidebar
  const selectedLog = selectedLogIndex !== null ? filteredLogs[selectedLogIndex] : null;

  // Handle resize
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const newPosition = ((e.clientY - rect.top) / rect.height) * 100;
      setSplitPosition(Math.min(80, Math.max(20, newPosition)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Handle sidebar resize
  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingSidebar(true);

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = window.innerWidth - e.clientX;
      setSidebarWidth(Math.min(800, Math.max(300, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizingSidebar(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  // Reset graph to original layout
  const handleResetGraph = useCallback(() => {
    setSelectedService(null);
    setNodes(layoutedNodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        isSelected: false,
        onClick: () => handleNodeClick(node.id)
      }
    })));
  }, [layoutedNodes, setNodes, handleNodeClick]);

  // Copy to clipboard
  const handleCopy = async () => {
    if (!selectedLog) return;
    try {
      const text = typeof selectedLog === 'string' ? selectedLog : JSON.stringify(selectedLog, null, 2);
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Render pretty JSON
  const renderPrettyJson = (obj: any, indent: number = 0): React.ReactNode[] => {
    const elements: React.ReactNode[] = [];

    if (typeof obj !== 'object' || obj === null) {
      const color = obj === null ? '#71717a' :
                    typeof obj === 'string' ? '#34d399' :
                    typeof obj === 'boolean' ? '#f59e0b' : '#a78bfa';
      const display = typeof obj === 'string' ? `"${obj}"` : String(obj);
      return [<span key="value" style={{ color }}>{display}</span>];
    }

    const isArray = Array.isArray(obj);
    const entries = isArray ? obj.map((v, i) => [String(i), v]) : Object.entries(obj);
    const openBracket = isArray ? '[' : '{';
    const closeBracket = isArray ? ']' : '}';
    const spaces = '  '.repeat(indent);

    elements.push(<span key="open" style={{ color: '#71717a' }}>{openBracket}</span>);

    if (entries.length > 0) {
      elements.push(<br key="open-br" />);
      entries.forEach(([key, value], idx) => {
        const childSpaces = '  '.repeat(indent + 1);
        elements.push(
          <span key={`line-${idx}`}>
            {childSpaces}
            {!isArray && (
              <>
                <span style={{ color: '#60a5fa' }}>"{key}"</span>
                <span style={{ color: '#d4d4d8' }}>: </span>
              </>
            )}
            {renderPrettyJson(value, indent + 1)}
            {idx < entries.length - 1 && <span style={{ color: '#d4d4d8' }}>,</span>}
            <br />
          </span>
        );
      });
      elements.push(<span key="close-spaces">{spaces}</span>);
    }

    elements.push(<span key="close" style={{ color: '#71717a' }}>{closeBracket}</span>);
    return elements;
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: '#0a0a0a',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 20px',
          borderBottom: '1px solid #222',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#0a0a0a'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <span style={{ fontSize: '14px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
            TRACE VIEW
          </span>
          <div style={{
            padding: '4px 12px',
            backgroundColor: '#111',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#60a5fa',
            fontFamily: 'monospace'
          }}>
            {traceId}
          </div>
          <span style={{ fontSize: '12px', color: '#71717a', fontFamily: 'monospace' }}>
            {traceLogs.length} logs · {graph.nodes.length} services
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '8px',
            color: '#71717a',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px'
          }}
        >
          <X size={20} />
        </button>
      </div>

      {/* Main content */}
      <div ref={containerRef} style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        {/* Left side: Graph + Logs */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Service Graph - Top */}
          <div style={{ height: `${splitPosition}%`, position: 'relative', backgroundColor: '#0a0a0a' }}>
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.3 }}
              proOptions={{ hideAttribution: true }}
            >
              <Background color="#1a1a1a" gap={20} />
              <Controls
                style={{
                  backgroundColor: '#111',
                  borderRadius: '8px',
                  border: '1px solid #222'
                }}
              />
              <ResetViewButton onReset={handleResetGraph} />
            </ReactFlow>

            {/* Legend */}
            <div
              style={{
                position: 'absolute',
                bottom: '20px',
                left: '20px',
                backgroundColor: '#111',
                border: '1px solid #222',
                borderRadius: '8px',
                padding: '12px 16px',
                fontSize: '11px',
                fontFamily: 'monospace'
              }}
            >
              <div style={{ color: '#71717a', marginBottom: '8px', fontWeight: 600 }}>STATUS</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#22c55e' }} />
                  <span style={{ color: '#71717a' }}>Healthy</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#f59e0b' }} />
                  <span style={{ color: '#71717a' }}>Warnings</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ef4444' }} />
                  <span style={{ color: '#71717a' }}>Errors</span>
                </div>
              </div>
            </div>
          </div>

          {/* Resize Handle */}
          <div
            onMouseDown={handleResizeStart}
            style={{
              height: '6px',
              backgroundColor: isResizing ? '#3b82f6' : '#222',
              cursor: 'ns-resize',
              transition: 'background-color 0.15s',
              flexShrink: 0
            }}
            onMouseEnter={(e) => {
              if (!isResizing) e.currentTarget.style.backgroundColor = '#333';
            }}
            onMouseLeave={(e) => {
              if (!isResizing) e.currentTarget.style.backgroundColor = '#222';
            }}
          />

          {/* Log list panel - Bottom */}
          <div
            style={{
              height: `${100 - splitPosition}%`,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#0a0a0a',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                padding: '10px 16px',
                borderBottom: '1px solid #222',
                backgroundColor: '#0a0a0a',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
                {selectedService ? (
                  <>
                    <span style={{ color: '#60a5fa' }}>{selectedService}</span>
                    <span> · {filteredLogs.length} logs</span>
                  </>
                ) : (
                  <>LOGS · {filteredLogs.length}</>
                )}
              </div>
              {selectedService && (
                <button
                  onClick={() => {
                    setSelectedService(null);
                    setNodes(nds => nds.map(node => ({
                      ...node,
                      data: {
                        ...node.data,
                        isSelected: false,
                        onClick: () => handleNodeClick(node.id)
                      }
                    })));
                  }}
                  style={{
                    background: 'none',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    color: '#71717a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '10px',
                    fontFamily: 'monospace',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#ef4444';
                    e.currentTarget.style.color = '#ef4444';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#333';
                    e.currentTarget.style.color = '#71717a';
                  }}
                  title="Clear filter"
                >
                  <X size={12} />
                  CLEAR FILTER
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              {filteredLogs.map((log, index) => (
                <LogRow
                  key={index}
                  log={log}
                  isSelected={selectedLogIndex === index}
                  onClick={() => setSelectedLogIndex(selectedLogIndex === index ? null : index)}
                  activeSearchTerms={[]}
                  getLevelBorderColor={getLevelBorderColor}
                  visibleFields={['all']}
                  levelField=""
                  timestampField=""
                />
              ))}
            </div>
          </div>
        </div>

        {/* Details Sidebar - Overlay */}
        {selectedLog && (
          <div
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              bottom: 0,
              width: `${sidebarWidth}px`,
              display: 'flex',
              backgroundColor: '#0a0a0a',
              zIndex: 100,
              boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.5)'
            }}
          >
            {/* Sidebar Resize Handle */}
            <div
              onMouseDown={handleSidebarResizeStart}
              style={{
                width: '6px',
                backgroundColor: isResizingSidebar ? '#3b82f6' : '#222',
                cursor: 'ew-resize',
                transition: 'background-color 0.15s',
                flexShrink: 0
              }}
              onMouseEnter={(e) => {
                if (!isResizingSidebar) e.currentTarget.style.backgroundColor = '#333';
              }}
              onMouseLeave={(e) => {
                if (!isResizingSidebar) e.currentTarget.style.backgroundColor = '#222';
              }}
            />
            <div
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden'
              }}
            >
            {/* Sidebar Header */}
            <div
              style={{
                padding: '12px',
                borderBottom: '1px solid #222',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#a1a1aa', fontFamily: 'monospace' }}>
                LOG DETAILS
              </span>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <button
                  onClick={handleCopy}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    color: copied ? '#10b981' : '#71717a',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontFamily: 'monospace'
                  }}
                  title="Copy to clipboard"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copied ? 'COPIED' : 'COPY'}</span>
                </button>
                <button
                  onClick={() => setSelectedLogIndex(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#71717a',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Sidebar Tabs */}
            <div
              style={{
                display: 'flex',
                gap: '0',
                borderBottom: '1px solid #222',
                padding: '0 12px'
              }}
            >
              {(['raw', 'pretty', 'tree'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSidebarTab(tab)}
                  style={{
                    background: 'none',
                    border: 'none',
                    borderBottom: sidebarTab === tab ? '2px solid #60a5fa' : '2px solid transparent',
                    cursor: 'pointer',
                    padding: '8px 12px',
                    color: sidebarTab === tab ? '#60a5fa' : '#71717a',
                    fontSize: '11px',
                    fontWeight: 600,
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab}
                </button>
              ))}
            </div>

            {/* Sidebar Content */}
            <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
              {sidebarTab === 'raw' && (
                <pre
                  style={{
                    fontSize: '11px',
                    color: '#d4d4d8',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    margin: 0,
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}
                >
                  {typeof selectedLog === 'string' ? selectedLog : JSON.stringify(selectedLog)}
                </pre>
              )}

              {sidebarTab === 'pretty' && (
                <pre
                  style={{
                    fontSize: '11px',
                    fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                    margin: 0,
                    lineHeight: '1.6',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    color: '#d4d4d8'
                  }}
                >
                  {typeof selectedLog === 'string' ? (
                    <span style={{ color: '#34d399' }}>"{selectedLog}"</span>
                  ) : (
                    renderPrettyJson(selectedLog)
                  )}
                </pre>
              )}

              {sidebarTab === 'tree' && (
                <div style={{ lineHeight: '1.6' }}>
                  {typeof selectedLog === 'string' ? (
                    <div style={{ fontFamily: 'monospace', fontSize: '11px', color: '#34d399' }}>"{selectedLog}"</div>
                  ) : (
                    <TreeNode value={selectedLog} nodeKey={null} depth={0} />
                  )}
                </div>
              )}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
