"use client";

import "@xyflow/react/dist/style.css";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addEdge,
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  MiniMap,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Copy,
  FileCode2,
  GitBranch,
  Network,
  Plus,
  Send,
  Settings2,
  Trash2,
} from "lucide-react";
import { useTranslations } from "next-intl";
import { apiClient } from "@/lib/api/client";
import { getDefaultRecordLevelForType } from "@/lib/record-level";
import { isAgentAvailableStatus, cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { DispatchType } from "@/lib/types";
import {
  buildTxWorkflowPayload,
  validateTxWorkflowForm,
  type TxWorkflowBlockFormData,
  type TxWorkflowFormData,
  type TxWorkflowStepFormData,
} from "@/components/task-forms/tx-workflow-form";
import {
  buildOrchestratePayload,
  validateOrchestrateForm,
  type OrchestrateFormData,
  type OrchestrateStageFormData,
} from "@/components/task-forms/orchestrate-form";

type ComplexDispatchType = Extract<DispatchType, "tx_workflow" | "orchestrate">;
type RecordLevel = "Off" | "KeyEventsOnly" | "Full";
type WorkflowBlockKind = "config" | "show";
type WorkflowRollbackPolicy = "per_step" | "none" | "whole_resource";
type TxMode = "Enable" | "Config";
type StageStrategy = "serial" | "parallel";
type OrchestrationActionKind = "tx_block" | "tx_workflow";
type InspectorTab = "config" | "summary";

interface ConnectionItem {
  name: string;
  host?: string;
  port?: number;
  device_profile?: string;
  has_password?: boolean;
}

interface EntryNodeData extends Record<string, unknown> {
  kind: "entry";
  mode: ComplexDispatchType;
}

interface WorkflowNodeData extends Record<string, unknown> {
  kind: "workflow_block";
  config: TxWorkflowBlockFormData;
}

interface OrchestrateNodeData extends Record<string, unknown> {
  kind: "orchestrate_stage";
  config: OrchestrateStageFormData;
}

type DesignerNodeData = EntryNodeData | WorkflowNodeData | OrchestrateNodeData;
type DesignerNode = Node<DesignerNodeData>;
type DesignerEdge = Edge;

const START_NODE_ID = "designer-start";

function makeId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function defaultWorkflowStep(): TxWorkflowStepFormData {
  return {
    mode: "Config",
    command: "",
    timeoutSecs: "",
    rollbackCommand: "",
    rollbackOnFailure: false,
  };
}

function defaultWorkflowBlock(): TxWorkflowBlockFormData {
  return {
    name: "",
    kind: "config",
    failFast: true,
    rollbackPolicy: "per_step",
    wholeResourceMode: "Config",
    wholeResourceUndoCommand: "",
    wholeResourceTimeoutSecs: "",
    wholeResourceTriggerStepIndex: "",
    steps: [defaultWorkflowStep()],
  };
}

function defaultOrchestrateStage(): OrchestrateStageFormData {
  return {
    name: "",
    strategy: "serial",
    maxParallel: "",
    failFast: true,
    targetGroups: "",
    targetsJson: "",
    actionKind: "tx_block",
    actionJson: JSON.stringify(
      {
        name: "stage-change",
        mode: "Config",
        commands: ["show version"],
      },
      null,
      2
    ),
  };
}

function cloneWorkflowBlockConfig(config: TxWorkflowBlockFormData): TxWorkflowBlockFormData {
  return {
    ...config,
    steps: config.steps.map((step) => ({ ...step })),
  };
}

function cloneOrchestrateStageConfig(
  config: OrchestrateStageFormData
): OrchestrateStageFormData {
  return {
    ...config,
  };
}

function createEntryNode(mode: ComplexDispatchType): DesignerNode {
  return {
    id: START_NODE_ID,
    type: "entry",
    position: { x: 40, y: 150 },
    data: { kind: "entry", mode },
    draggable: false,
    selectable: false,
    deletable: false,
  };
}

function createWorkflowNode(config: TxWorkflowBlockFormData, x: number): DesignerNode {
  return {
    id: makeId("workflow-block"),
    type: "designer",
    position: { x, y: 130 },
    data: { kind: "workflow_block", config },
  };
}

function createOrchestrateNode(config: OrchestrateStageFormData, x: number): DesignerNode {
  return {
    id: makeId("orchestrate-stage"),
    type: "designer",
    position: { x, y: 130 },
    data: { kind: "orchestrate_stage", config },
  };
}

function createLinearEdge(source: string, target: string): DesignerEdge {
  return {
    id: `${source}->${target}`,
    source,
    target,
    type: "smoothstep",
    markerEnd: {
      type: MarkerType.ArrowClosed,
    },
  };
}

function isContentNode(node: DesignerNode): boolean {
  return node.id !== START_NODE_ID;
}

function isWorkflowNode(node: DesignerNode | undefined): node is DesignerNode & { data: WorkflowNodeData } {
  return !!node && node.data.kind === "workflow_block";
}

function isOrchestrateNode(node: DesignerNode | undefined): node is DesignerNode & { data: OrchestrateNodeData } {
  return !!node && node.data.kind === "orchestrate_stage";
}

function sortByPosition(a: DesignerNode, b: DesignerNode): number {
  if (a.position.x === b.position.x) {
    return a.position.y - b.position.y;
  }
  return a.position.x - b.position.x;
}

function getOrderedContentNodes(
  nodes: DesignerNode[],
  edges: DesignerEdge[]
): DesignerNode[] {
  const contentNodes = nodes.filter(isContentNode);
  const nodeMap = new Map(contentNodes.map((node) => [node.id, node]));
  const outgoing = new Map<string, DesignerEdge[]>();

  for (const edge of edges) {
    if (!outgoing.has(edge.source)) {
      outgoing.set(edge.source, []);
    }
    outgoing.get(edge.source)!.push(edge);
  }

  const ordered: DesignerNode[] = [];
  const seen = new Set<string>();
  let currentId = outgoing
    .get(START_NODE_ID)
    ?.map((edge) => nodeMap.get(edge.target))
    .filter((node): node is DesignerNode => !!node)
    .sort(sortByPosition)[0]?.id;

  while (currentId) {
    if (seen.has(currentId)) {
      break;
    }
    const node = nodeMap.get(currentId);
    if (!node) {
      break;
    }
    ordered.push(node);
    seen.add(currentId);
    currentId = outgoing
      .get(currentId)
      ?.map((edge) => nodeMap.get(edge.target))
      .filter((next): next is DesignerNode => !!next)
      .sort(sortByPosition)[0]?.id;
  }

  const remaining = contentNodes
    .filter((node) => !seen.has(node.id))
    .sort(sortByPosition);

  return [...ordered, ...remaining];
}

function nextNodeX(nodes: DesignerNode[]): number {
  const contentNodes = nodes.filter(isContentNode);
  if (contentNodes.length === 0) {
    return 280;
  }

  const spacing = typeof window !== "undefined" && window.innerWidth < 640 ? 220 : 280;
  return Math.max(...contentNodes.map((node) => node.position.x)) + spacing;
}

function EntryNode({ data }: NodeProps<Node<EntryNodeData>>) {
  const t = useTranslations("designer");
  const tc = useTranslations("common");
  const label = data.mode === "tx_workflow" ? t("workflowBuilder") : t("orchestrationBuilder");
  const description =
    data.mode === "tx_workflow" ? tc("workflow") : tc("orchestrate");

  return (
    <div className="rauto-flow-entry-node min-w-[160px] sm:min-w-[180px] rounded-2xl border border-primary/30 bg-primary px-4 py-3 text-primary-foreground shadow-lg">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] opacity-80">
        {description}
      </div>
      <div className="mt-1 text-sm sm:text-base font-semibold">{label}</div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-primary-foreground !bg-primary-foreground"
      />
    </div>
  );
}

function DesignerNodeCard({ data, selected }: NodeProps<Node<WorkflowNodeData | OrchestrateNodeData>>) {
  const t = useTranslations("designer");
  const tf = useTranslations("taskForms");

  const title =
    data.kind === "workflow_block"
      ? data.config.name.trim() || t("workflowBlockNode")
      : data.config.name.trim() || t("stageNode");

  const summary =
    data.kind === "workflow_block"
      ? `${data.config.steps.length} ${tf("step")} / ${data.config.kind} / ${data.config.rollbackPolicy}`
      : `${data.config.strategy} / ${data.config.actionKind} / ${
          data.config.targetGroups.trim() || data.config.targetsJson.trim() ? "targets" : "unset"
        }`;

  const Icon = data.kind === "workflow_block" ? FileCode2 : Network;

  return (
    <div
      className={cn(
        "rauto-flow-node-card min-w-[180px] sm:min-w-[200px] lg:min-w-[220px] rounded-2xl border bg-card px-3 py-3 shadow-md transition-all sm:px-4",
        selected ? "border-primary shadow-lg shadow-primary/15" : "border-border"
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!h-3 !w-3 !border-2 !border-border !bg-background"
      />
      <div className="flex items-start justify-between gap-2 sm:gap-3">
        <div className="space-y-1 min-w-0">
          <div className="text-sm font-semibold truncate">{title}</div>
          <div className="text-xs text-muted-foreground line-clamp-2">{summary}</div>
        </div>
        <div className="rauto-flow-node-icon rounded-lg bg-muted p-1.5 text-muted-foreground flex-shrink-0 sm:p-2">
          <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
        </div>
      </div>
      <Handle
        type="source"
        position={Position.Right}
        className="!h-3 !w-3 !border-2 !border-border !bg-background"
      />
    </div>
  );
}

const nodeTypes = {
  entry: EntryNode,
  designer: DesignerNodeCard,
};

function CanvasSettingsSection({
  title,
  description,
  children,
  className,
}: {
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-background/70 p-3 shadow-sm sm:p-4", className)}>
      <div className="mb-4 space-y-1">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{description}</div>
      </div>
      {children}
    </section>
  );
}

export function ComplexTaskDesigner() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const td = useTranslations("dialogs");
  const tr = useTranslations("dialogs.taskResult");
  const tf = useTranslations("taskForms");
  const tc = useTranslations("common");
  const tp = useTranslations("designer");

  const [mode, setMode] = useState<ComplexDispatchType>("tx_workflow");
  const [agentId, setAgentId] = useState("");
  const [connectionName, setConnectionName] = useState("");
  const [connections, setConnections] = useState<ConnectionItem[]>([]);
  const [loadingConnections, setLoadingConnections] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [recordLevel, setRecordLevel] = useState<RecordLevel>(
    getDefaultRecordLevelForType("tx_workflow")
  );
  const [dispatching, setDispatching] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [inspectorOpen, setInspectorOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 768;
    }
    return true;
  });
  const [previewOpen, setPreviewOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>("config");
  const ignoreNextEmptySelectionRef = useRef(false);

  const openInspectorPanel = (tab: InspectorTab = "config") => {
    setInspectorOpen(true);
    setInspectorTab(tab);
  };

  const closeInspectorPanel = ({ clearSelection = false }: { clearSelection?: boolean } = {}) => {
    setInspectorOpen(false);
    if (clearSelection) {
      setSelectedNodeId(null);
    }
  };

  const markNodeInteraction = () => {
    ignoreNextEmptySelectionRef.current = true;
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        ignoreNextEmptySelectionRef.current = false;
      });
    }
  };

  const toggleSettingsPanel = () => {
    setSettingsOpen((current) => {
      const willOpen = !current;
      if (willOpen && typeof window !== "undefined" && window.innerWidth < 1024) {
        setInspectorOpen(false);
        setPreviewOpen(false);
      }
      return willOpen;
    });
  };

  const toggleInspectorPanel = () => {
    setInspectorOpen((current) => {
      const willOpen = !current;
      if (willOpen && typeof window !== "undefined" && window.innerWidth < 1024) {
        setSettingsOpen(false);
        setPreviewOpen(false);
      }
      return willOpen;
    });
  };

  const togglePreviewPanel = () => {
    setPreviewOpen((current) => {
      const willOpen = !current;
      if (willOpen && typeof window !== "undefined" && window.innerWidth < 1024) {
        setSettingsOpen(false);
        setInspectorOpen(false);
      }
      return willOpen;
    });
  };

  const [workflowName, setWorkflowName] = useState("workflow");
  const [workflowFailFast, setWorkflowFailFast] = useState(true);
  const [planName, setPlanName] = useState("orchestration");
  const [planFailFast, setPlanFailFast] = useState(true);
  const [inventoryFile, setInventoryFile] = useState("");
  const [inventoryJson, setInventoryJson] = useState("");
  const [baseDir, setBaseDir] = useState("");

  const [nodes, setNodes, onNodesChange] = useNodesState<DesignerNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<DesignerEdge>([]);

  const { data: agentsData } = useQuery({
    queryKey: ["agents"],
    queryFn: () => apiClient.getAgents(),
  });

  const availableAgents = (agentsData?.data ?? []).filter((agent) =>
    isAgentAvailableStatus(agent.status)
  );

  useEffect(() => {
    const initialX = typeof window !== "undefined" && window.innerWidth < 640 ? 260 : 320;
    const initialContentNode =
      mode === "tx_workflow"
        ? createWorkflowNode(defaultWorkflowBlock(), initialX)
        : createOrchestrateNode(defaultOrchestrateStage(), initialX);

    setNodes([createEntryNode(mode), initialContentNode]);
    setEdges([createLinearEdge(START_NODE_ID, initialContentNode.id)]);
    setSelectedNodeId(initialContentNode.id);
    setInspectorTab("config");
    setConnectionName("");
    setRecordLevel(getDefaultRecordLevelForType(mode));
  }, [mode, setEdges, setNodes]);

  useEffect(() => {
    if (!agentId) {
      setConnections([]);
      return;
    }

    const fetchConnections = async () => {
      setLoadingConnections(true);
      try {
        const result = await apiClient.getAgentConnections(agentId);
        if (result.success && result.data?.connections) {
          setConnections(result.data.connections);
        } else if (!result.success) {
          toast.error(
            td("fetchConnectionsFailed", { error: result.error ?? tc("unknownError") })
          );
        }
      } catch (error) {
        toast.error(
          td("fetchConnectionsFailed", {
            error: error instanceof Error ? error.message : tc("unknownError"),
          })
        );
      } finally {
        setLoadingConnections(false);
      }
    };

    fetchConnections();
  }, [agentId, td, tc]);

  const orderedNodes = getOrderedContentNodes(nodes, edges);
  const selectedNode = nodes.find((node) => node.id === selectedNodeId);

  useEffect(() => {
    if (!selectedNodeId) {
      setInspectorOpen(false);
      return;
    }

    if (!selectedNode) {
      setSelectedNodeId(null);
    }
  }, [selectedNode, selectedNodeId]);

  const workflowFormData: TxWorkflowFormData = {
    name: workflowName,
    failFast: workflowFailFast,
    blocks: orderedNodes
      .filter(isWorkflowNode)
      .map((node) => node.data.config),
    rawJson: "",
    useRawJson: false,
  };

  const orchestrateFormData: OrchestrateFormData = {
    name: planName,
    failFast: planFailFast,
    inventoryFile,
    inventoryJson,
    baseDir,
    stages: orderedNodes
      .filter(isOrchestrateNode)
      .map((node) => node.data.config),
    rawJson: "",
    useRawJson: false,
  };

  const validationError =
    mode === "tx_workflow"
      ? validateTxWorkflowForm(workflowFormData, tf)
      : validateOrchestrateForm(orchestrateFormData, tf);

  const canvasRightInsetClass = inspectorOpen
    ? "right-4 sm:right-[19rem] lg:right-[23rem]"
    : "right-4";

  let previewPayload: Record<string, unknown> | null = null;
  try {
    previewPayload =
      mode === "tx_workflow"
        ? buildTxWorkflowPayload(workflowFormData)
        : buildOrchestratePayload(orchestrateFormData);
  } catch {
    previewPayload = null;
  }

  const updateSelectedWorkflowNode = (
    updater: (current: TxWorkflowBlockFormData) => TxWorkflowBlockFormData
  ) => {
    if (!selectedNodeId) {
      return;
    }

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNodeId || node.data.kind !== "workflow_block") {
          return node;
        }

        return {
          ...node,
          data: {
            kind: "workflow_block",
            config: updater(node.data.config),
          },
        };
      })
    );
  };

  const updateSelectedOrchestrateNode = (
    updater: (current: OrchestrateStageFormData) => OrchestrateStageFormData
  ) => {
    if (!selectedNodeId) {
      return;
    }

    setNodes((current) =>
      current.map((node) => {
        if (node.id !== selectedNodeId || node.data.kind !== "orchestrate_stage") {
          return node;
        }

        return {
          ...node,
          data: {
            kind: "orchestrate_stage",
            config: updater(node.data.config),
          },
        };
      })
    );
  };

  const handleConnect = (connection: Connection) => {
    if (!connection.source || !connection.target || connection.target === START_NODE_ID) {
      return;
    }

    setEdges((current) => {
      const filtered = current.filter(
        (edge) =>
          edge.source !== connection.source && edge.target !== connection.target
      );

      return addEdge(
        {
          ...connection,
          type: "smoothstep",
          markerEnd: {
            type: MarkerType.ArrowClosed,
          },
        },
        filtered
      );
    });
  };

  const handleAddNode = () => {
    const newNode =
      mode === "tx_workflow"
        ? createWorkflowNode(defaultWorkflowBlock(), nextNodeX(nodes))
        : createOrchestrateNode(defaultOrchestrateStage(), nextNodeX(nodes));

    const ordered = getOrderedContentNodes(nodes, edges);
    const sourceId = ordered.length > 0 ? ordered[ordered.length - 1].id : START_NODE_ID;

    setNodes((current) => [...current, newNode]);
    setEdges((current) => [...current, createLinearEdge(sourceId, newNode.id)]);
    setSelectedNodeId(newNode.id);
    openInspectorPanel("config");
  };

  const handleResetCanvas = () => {
    const replacement =
      mode === "tx_workflow"
        ? createWorkflowNode(defaultWorkflowBlock(), 320)
        : createOrchestrateNode(defaultOrchestrateStage(), 320);

    setNodes([createEntryNode(mode), replacement]);
    setEdges([createLinearEdge(START_NODE_ID, replacement.id)]);
    setSelectedNodeId(replacement.id);
    openInspectorPanel("config");
  };

  const handleDeleteSelectedNode = () => {
    if (!selectedNodeId || selectedNodeId === START_NODE_ID) {
      return;
    }

    const incoming = edges.find((edge) => edge.target === selectedNodeId);
    const outgoing = edges.find((edge) => edge.source === selectedNodeId);

    setNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setEdges((current) => {
      const filtered = current.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId
      );

      if (incoming && outgoing && incoming.source !== outgoing.target) {
        filtered.push(createLinearEdge(incoming.source, outgoing.target));
      }

      return filtered;
    });
    setSelectedNodeId(null);
    setInspectorOpen(false);
    toast.success(tp("deleteNode"));
  };

  const handleDuplicateSelectedNode = () => {
    if (!selectedNode || selectedNode.id === START_NODE_ID) {
      return;
    }

    const x = nextNodeX(nodes);
    const newNode = isWorkflowNode(selectedNode)
      ? createWorkflowNode(cloneWorkflowBlockConfig(selectedNode.data.config), x)
      : isOrchestrateNode(selectedNode)
        ? createOrchestrateNode(cloneOrchestrateStageConfig(selectedNode.data.config), x)
        : null;

    if (!newNode) {
      return;
    }

    const ordered = getOrderedContentNodes(nodes, edges);
    const sourceId = ordered.length > 0 ? ordered[ordered.length - 1].id : START_NODE_ID;

    setNodes((current) => [...current, newNode]);
    setEdges((current) => [...current, createLinearEdge(sourceId, newNode.id)]);
    setSelectedNodeId(newNode.id);
    openInspectorPanel("config");
    toast.success(tp("duplicateNodeSuccess"));
  };

  const handleDispatch = async () => {
    if (!agentId) {
      toast.error(td("selectAgent"));
      return;
    }

    if (mode === "tx_workflow" && !connectionName) {
      toast.error(td("selectConnection"));
      return;
    }

    if (validationError) {
      toast.error(validationError);
      return;
    }

    if (!previewPayload) {
      toast.error(tp("previewUnavailable"));
      return;
    }

    setDispatching(true);
    try {
      const result = await apiClient.dispatch({
        type: mode,
        agent_id: agentId,
        connection:
          mode === "tx_workflow" ? { connection_name: connectionName } : undefined,
        payload: previewPayload,
        dry_run: dryRun || undefined,
        record_level: recordLevel !== "Off" ? recordLevel : undefined,
      });

      if (result.success) {
        toast.success(
          tp("dispatchSuccess", { name: result.data?.agent_name ?? "" })
        );
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        router.push("/tasks");
      } else {
        toast.error(td("dispatchFailed", { error: result.error ?? tc("unknownError") }));
      }
    } catch (error) {
      toast.error(
        td("dispatchFailed", {
          error: error instanceof Error ? error.message : tc("unknownError"),
        })
      );
    } finally {
      setDispatching(false);
    }
  };

  const modeDescription =
    mode === "tx_workflow"
      ? tp("workflowModeDescription")
      : tp("orchestrationModeDescription");

  return (
    <div>
      <Card className="min-h-[500px] overflow-hidden">
        <CardHeader>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-3">
              <div className="space-y-2">
                <div className="inline-flex w-fit items-center gap-1 rounded-2xl border bg-muted/50 p-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "tx_workflow" ? "default" : "ghost"}
                    onClick={() => setMode("tx_workflow")}
                    className="rounded-xl px-3.5"
                  >
                    <GitBranch className="mr-2 h-4 w-4" />
                    {tc("workflow")}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={mode === "orchestrate" ? "default" : "ghost"}
                    onClick={() => setMode("orchestrate")}
                    className="rounded-xl px-3.5"
                  >
                    <Network className="mr-2 h-4 w-4" />
                    {tc("orchestrate")}
                  </Button>
                </div>
                <CardDescription>{modeDescription}</CardDescription>
              </div>
              <div className="text-xs text-muted-foreground">{tp("dragToArrange")}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => router.push("/tasks")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tp("backToTasks")}
              </Button>
              <Button size="sm" onClick={handleDispatch} disabled={dispatching}>
                <Send className="mr-2 h-4 w-4" />
                {dispatching ? tp("dispatching") : tp("dispatch")}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative h-[calc(100vh-240px)] min-h-[500px] max-h-[900px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={handleConnect}
              onNodeClick={(_, node) => {
                markNodeInteraction();
                setSelectedNodeId(node.id);
                openInspectorPanel("config");
              }}
              onPaneClick={() => {
                ignoreNextEmptySelectionRef.current = false;
                setSelectedNodeId(null);
              }}
              onSelectionChange={({ nodes: selectedNodes }) => {
                const nextSelectedNode = selectedNodes[0];
                if (nextSelectedNode) {
                  markNodeInteraction();
                  setSelectedNodeId(nextSelectedNode.id);
                  openInspectorPanel("config");
                } else if (ignoreNextEmptySelectionRef.current) {
                  ignoreNextEmptySelectionRef.current = false;
                } else {
                  setSelectedNodeId(null);
                }
              }}
              fitView
              minZoom={0.5}
              maxZoom={1.4}
              className="rauto-flow-canvas bg-[radial-gradient(circle_at_top,rgba(241,245,249,0.92)_0%,rgba(255,255,255,1)_62%)] dark:bg-[radial-gradient(circle_at_top,rgba(30,41,59,0.94)_0%,rgba(15,23,42,0.92)_42%,rgba(2,6,23,1)_100%)]"
            >
              <MiniMap pannable zoomable />
              <Controls />
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.2} />
            </ReactFlow>

            <div className="pointer-events-none absolute inset-0 z-10">
              <div
                className={cn(
                  "pointer-events-auto absolute left-4 top-4",
                  canvasRightInsetClass
                )}
              >
                <div
                  data-designer-panel="settings"
                  className="rounded-2xl border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b px-3 py-2.5 sm:px-4 sm:py-3">
                    <div className="min-w-0 flex items-start gap-3">
                      <div className="rounded-lg bg-primary/10 p-1.5 text-primary sm:p-2">
                        <Settings2 className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold">{tp("metaSettings")}</div>
                        <div className="mt-1 text-xs text-muted-foreground sm:hidden">
                          {tp("settingsCompactHint")}
                        </div>
                        <div className="mt-1 hidden text-xs text-muted-foreground sm:block">
                          {tp("linearFlowHint")}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={toggleSettingsPanel}
                        className="md:hidden"
                        aria-label={settingsOpen ? tp("collapseSettings") : tp("expandSettings")}
                      >
                        {settingsOpen ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={toggleSettingsPanel}
                        className="hidden md:flex"
                      >
                        {settingsOpen ? (
                          <ChevronUp className="mr-2 h-4 w-4" />
                        ) : (
                          <ChevronDown className="mr-2 h-4 w-4" />
                        )}
                        {settingsOpen ? tp("collapseSettings") : tp("expandSettings")}
                      </Button>
                    </div>
                  </div>

                  {settingsOpen && (
                    <div className="h-[52vh] sm:h-[56vh] md:h-[400px] overflow-hidden">
                      <ScrollArea className="h-full">
                        <div className="grid gap-4 px-3 py-3 sm:gap-5 sm:px-4 sm:py-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,520px),1fr))]">
                        <CanvasSettingsSection
                          title={tp("settingsGroupTargetTitle")}
                          description={tp("settingsGroupTargetDescription")}
                          className="h-full"
                        >
                          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                            <div className="min-w-0 space-y-2">
                              <Label>{td("targetAgent")}</Label>
                              <Select value={agentId} onValueChange={setAgentId}>
                                <SelectTrigger>
                                  <SelectValue placeholder={td("selectOnlineAgent")} />
                                </SelectTrigger>
                                <SelectContent>
                                  {availableAgents.length === 0 ? (
                                    <div className="p-2 text-sm text-muted-foreground">
                                      {td("noOnlineAgents")}
                                    </div>
                                  ) : (
                                    availableAgents.map((agent) => (
                                      <SelectItem key={agent.id} value={agent.id}>
                                        {agent.name} ({agent.host}:{agent.port})
                                      </SelectItem>
                                    ))
                                  )}
                                </SelectContent>
                              </Select>
                            </div>

                            {mode === "tx_workflow" ? (
                              <div className="space-y-2 [grid-column:1/-1]">
                                <Label>{td("deviceConnection")}</Label>
                                {loadingConnections ? (
                                  <div className="flex h-10 items-center rounded-xl border bg-muted/40 px-3 text-sm text-muted-foreground">
                                    {td("loadingConnections")}
                                  </div>
                                ) : (
                                  <Select
                                    value={connectionName}
                                    onValueChange={setConnectionName}
                                    disabled={!agentId}
                                  >
                                    <SelectTrigger>
                                      <SelectValue
                                        placeholder={
                                          agentId
                                            ? td("selectDeviceConnection")
                                            : tf("selectAgentFirst")
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {connections.length === 0 ? (
                                        <div className="p-2 text-sm text-muted-foreground">
                                          {agentId
                                            ? td("noAvailableConnections")
                                            : tf("selectAgentFirst")}
                                        </div>
                                      ) : (
                                        connections.map((connection) => (
                                          <SelectItem
                                            key={connection.name}
                                            value={connection.name}
                                          >
                                            {connection.name}
                                            {connection.host ? ` (${connection.host})` : ""}
                                          </SelectItem>
                                        ))
                                      )}
                                    </SelectContent>
                                  </Select>
                                )}
                              </div>
                            ) : (
                              <div className="rounded-xl border bg-muted/40 px-4 py-3 text-sm text-muted-foreground [grid-column:1/-1]">
                                <div className="font-medium text-foreground">
                                  {tp("noConnectionRequired")}
                                </div>
                                <div className="mt-1">
                                  {tp("noConnectionRequiredDescription")}
                                </div>
                              </div>
                            )}
                          </div>
                        </CanvasSettingsSection>

                        <CanvasSettingsSection
                          title={tp("settingsGroupRuntimeTitle")}
                          description={tp("settingsGroupRuntimeDescription")}
                          className="h-full"
                        >
                          <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                            <div className="flex min-w-0 flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                              <div className="min-w-0 space-y-0.5">
                                <Label>{tr("dryRun")}</Label>
                              </div>
                              <Switch checked={dryRun} onCheckedChange={setDryRun} />
                            </div>

                            <div className="min-w-0 space-y-2">
                              <Label>{tp("recordLevel")}</Label>
                              <Select
                                value={recordLevel}
                                onValueChange={(value) => setRecordLevel(value as RecordLevel)}
                              >
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="Off">{tp("recordLevelOff")}</SelectItem>
                                  <SelectItem value="KeyEventsOnly">
                                    {tp("recordLevelKeyEvents")}
                                  </SelectItem>
                                  <SelectItem value="Full">{tp("recordLevelFull")}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </CanvasSettingsSection>

                        <CanvasSettingsSection
                          title={tp("settingsGroupMetadataTitle")}
                          description={tp("settingsGroupMetadataDescription")}
                          className="[grid-column:1/-1]"
                        >
                          {mode === "tx_workflow" ? (
                            <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                              <div className="space-y-2">
                                <Label>{tf("workflowName")}</Label>
                                <Input
                                  value={workflowName}
                                  onChange={(e) => setWorkflowName(e.target.value)}
                                  placeholder={tf("workflowNamePlaceholder")}
                                />
                              </div>
                              <div className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                <div className="space-y-0.5">
                                  <Label>{tf("workflowFailFast")}</Label>
                                  <p className="text-xs text-muted-foreground">
                                    {tf("workflowFailFastHint")}
                                  </p>
                                </div>
                                <Switch
                                  checked={workflowFailFast}
                                  onCheckedChange={setWorkflowFailFast}
                                />
                              </div>
                            </div>
                            ) : (
                            <div className="space-y-4">
                              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr))]">
                                <div className="space-y-2">
                                  <Label>{tf("planNameLabel")}</Label>
                                  <Input
                                    value={planName}
                                    onChange={(e) => setPlanName(e.target.value)}
                                    placeholder={tf("planNamePlaceholder")}
                                  />
                                </div>
                                <div className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                                  <div className="space-y-0.5">
                                    <Label>{tf("planFailFast")}</Label>
                                    <p className="text-xs text-muted-foreground">
                                      {tf("planFailFastHint")}
                                    </p>
                                  </div>
                                  <Switch
                                    checked={planFailFast}
                                    onCheckedChange={setPlanFailFast}
                                  />
                                </div>
                              </div>

                              <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                                <div className="space-y-2">
                                  <Label>{tf("inventoryFile")}</Label>
                                  <Input
                                    value={inventoryFile}
                                    onChange={(e) => setInventoryFile(e.target.value)}
                                    placeholder={tf("inventoryFilePlaceholder")}
                                  />
                                </div>
                                <div className="space-y-2">
                                  <Label>{tf("baseDir")}</Label>
                                  <Input
                                    value={baseDir}
                                    onChange={(e) => setBaseDir(e.target.value)}
                                    placeholder={tf("baseDirPlaceholder")}
                                  />
                                </div>
                                <div className="space-y-2 [grid-column:1/-1]">
                                  <Label>{tf("inventoryJson")}</Label>
                                  <Textarea
                                    className="min-h-[120px] font-mono text-sm"
                                    value={inventoryJson}
                                    onChange={(e) => setInventoryJson(e.target.value)}
                                    placeholder={tf("inventoryJsonPlaceholder")}
                                  />
                                </div>
                              </div>
                            </div>
                          )}
                        </CanvasSettingsSection>
                      </div>
                      </ScrollArea>
                    </div>
                  )}
                </div>
              </div>

              <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2 hidden lg:block">
                <div
                  data-designer-panel="toolbar"
                  className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={handleAddNode}
                    aria-label={
                      mode === "tx_workflow"
                        ? tp("addWorkflowBlock")
                        : tp("addOrchestrationStage")
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={handleDuplicateSelectedNode}
                    disabled={!selectedNode || selectedNode.id === START_NODE_ID}
                    aria-label={tp("duplicateNode")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={handleDeleteSelectedNode}
                    disabled={!selectedNode || selectedNode.id === START_NODE_ID}
                    aria-label={tp("deleteNode")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  <Button
                    variant={settingsOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={toggleSettingsPanel}
                    aria-label={settingsOpen ? tp("collapseSettings") : tp("expandSettings")}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>

                  <Button
                    variant={inspectorOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={toggleInspectorPanel}
                    aria-label={inspectorOpen ? tp("collapseInspector") : tp("expandInspector")}
                  >
                    <ChevronLeft className={cn("h-4 w-4 transition-transform", inspectorOpen && "rotate-180")} />
                  </Button>

                  <Button
                    variant={previewOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={togglePreviewPanel}
                    aria-label={previewOpen ? tp("collapsePreview") : tp("expandPreview")}
                  >
                    <FileCode2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="pointer-events-auto absolute bottom-4 left-1/2 z-20 -translate-x-1/2 lg:hidden">
                <div
                  data-designer-panel="toolbar"
                  className="flex items-center gap-2 rounded-full border bg-background/95 px-3 py-2 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-background/80"
                >
                  <Button
                    variant="secondary"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={handleAddNode}
                    aria-label={
                      mode === "tx_workflow"
                        ? tp("addWorkflowBlock")
                        : tp("addOrchestrationStage")
                    }
                  >
                    <Plus className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={handleDuplicateSelectedNode}
                    disabled={!selectedNode || selectedNode.id === START_NODE_ID}
                    aria-label={tp("duplicateNode")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={handleDeleteSelectedNode}
                    disabled={!selectedNode || selectedNode.id === START_NODE_ID}
                    aria-label={tp("deleteNode")}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>

                  <Separator orientation="vertical" className="h-6" />

                  <Button
                    variant={settingsOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={toggleSettingsPanel}
                    aria-label={settingsOpen ? tp("collapseSettings") : tp("expandSettings")}
                  >
                    <Settings2 className="h-4 w-4" />
                  </Button>

                  <Button
                    variant={inspectorOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={toggleInspectorPanel}
                    aria-label={inspectorOpen ? tp("collapseInspector") : tp("expandInspector")}
                  >
                    <ChevronLeft className={cn("h-4 w-4 transition-transform", inspectorOpen && "rotate-180")} />
                  </Button>

                  <Button
                    variant={previewOpen ? "secondary" : "ghost"}
                    size="icon"
                    className="h-9 w-9 rounded-full"
                    onClick={togglePreviewPanel}
                    aria-label={previewOpen ? tp("collapsePreview") : tp("expandPreview")}
                  >
                    <FileCode2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {previewOpen && (
                <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
                  <div
                    data-designer-panel="preview"
                    className="relative mx-4 w-full max-w-3xl max-h-[85vh] rounded-2xl border bg-background shadow-2xl"
                  >
                    <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
                      <div>
                        <div className="text-lg font-semibold">{tp("preview")}</div>
                        <div className="text-sm text-muted-foreground">
                          {tp("previewDescription")}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={togglePreviewPanel}
                        aria-label={tp("collapsePreview")}
                      >
                        <ChevronDown className="h-5 w-5" />
                      </Button>
                    </div>

                    <ScrollArea className="max-h-[calc(85vh-80px)]">
                      <div className="space-y-4 px-6 py-4">
                        {validationError && (
                          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                            {validationError}
                          </div>
                        )}
                        <Textarea
                          className="min-h-[400px] font-mono text-sm"
                          readOnly
                          value={
                            previewPayload
                              ? JSON.stringify(previewPayload, null, 2)
                              : tp("previewUnavailable")
                          }
                        />
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              )}

              <div
                className={cn(
                  "pointer-events-auto absolute bottom-4 right-4 top-4 w-[calc(100%-2rem)]",
                  "max-w-[280px] sm:max-w-[320px] lg:max-w-[360px]",
                  !inspectorOpen && "hidden lg:block lg:w-auto lg:max-w-none lg:top-24 lg:bottom-auto"
                )}
              >
                {inspectorOpen ? (
                  <div
                    data-designer-panel="inspector"
                    className="flex h-full flex-col rounded-2xl border bg-background/95 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
                  >
                    <div className="flex items-start justify-between gap-3 border-b px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold">{tp("inspector")}</div>
                        <div className="text-xs text-muted-foreground">
                          {tp("inspectorDescription")}
                        </div>
                      </div>
                      <TooltipProvider>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                disabled={!selectedNodeId || selectedNodeId === START_NODE_ID}
                                onClick={handleDeleteSelectedNode}
                                aria-label={tp("deleteNode")}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">{tp("deleteNode")}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => closeInspectorPanel()}
                                aria-label={tp("collapseInspector")}
                              >
                                <ChevronRight className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              {tp("collapseInspector")}
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </div>

                    <div className="flex gap-2 border-b px-4 py-2">
                      <Button
                        variant={inspectorTab === "config" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setInspectorTab("config")}
                      >
                        {tp("inspectorConfigTab")}
                      </Button>
                      <Button
                        variant={inspectorTab === "summary" ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setInspectorTab("summary")}
                      >
                        {tp("inspectorSummaryTab")}
                      </Button>
                    </div>

                    <ScrollArea className="h-full">
                      <div className="p-4">
                        {!selectedNode || selectedNode.id === START_NODE_ID ? (
                          <div className="rounded-xl border border-dashed px-4 py-12 text-center">
                            <div className="text-sm font-semibold">
                              {tp("noSelectionTitle")}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                              {tp("noSelectionDescription")}
                            </div>
                          </div>
                        ) : inspectorTab === "summary" ? (
                          <NodeSummaryPanel node={selectedNode} />
                        ) : selectedNode && isWorkflowNode(selectedNode) ? (
                          <WorkflowBlockInspector
                            value={selectedNode.data.config}
                            onChange={(next) => updateSelectedWorkflowNode(() => next)}
                          />
                        ) : selectedNode && isOrchestrateNode(selectedNode) ? (
                          <OrchestrateStageInspector
                            value={selectedNode.data.config}
                            onChange={(next) => updateSelectedOrchestrateNode(() => next)}
                          />
                        ) : null}
                      </div>
                    </ScrollArea>
                  </div>
                ) : (
                  <>
                    <TooltipProvider>
                      <div
                        data-designer-panel="inspector-handle"
                        className="hidden lg:block rounded-2xl border bg-background/95 p-2 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-background/80"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openInspectorPanel(inspectorTab)}
                                aria-label={tp("expandInspector")}
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </Button>
                          </TooltipTrigger>
                          <TooltipContent side="left">
                            {tp("expandInspector")}
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </TooltipProvider>
                    <div className="lg:hidden">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => openInspectorPanel(inspectorTab)}
                      >
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        {tp("expandInspector")}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-xl border bg-muted/30 px-3 py-2">
      <div className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="text-sm text-foreground">{value || "-"}</div>
    </div>
  );
}

function NodeSummaryPanel({ node }: { node: DesignerNode }) {
  const tp = useTranslations("designer");
  const tf = useTranslations("taskForms");
  const tr = useTranslations("dialogs.taskResult");

  if (isWorkflowNode(node)) {
    const config = node.data.config;
    const commandList = config.steps
      .map((step, index) => `${index + 1}. [${step.mode}] ${step.command || "-"}`)
      .join("\n");

    return (
      <div className="space-y-4">
        <div className="grid gap-3">
          <SummaryRow
            label={tr("blockName")}
            value={config.name.trim() || tp("workflowBlockNode")}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryRow
              label={tf("blockKind")}
              value={
                config.kind === "config"
                  ? tf("blockKindConfig")
                  : tf("blockKindShow")
              }
            />
            <SummaryRow
              label={tr("failFast")}
              value={config.failFast ? tr("on") : tr("off")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryRow
              label={tf("rollbackPolicy")}
              value={
                config.rollbackPolicy === "per_step"
                  ? tf("rollbackPolicyPerStep")
                  : config.rollbackPolicy === "whole_resource"
                    ? tf("rollbackPolicyWholeResource")
                    : tf("rollbackPolicyNone")
              }
            />
            <SummaryRow
              label={tr("executedSteps")}
              value={String(config.steps.length)}
            />
          </div>
          {config.rollbackPolicy === "whole_resource" && (
            <div className="grid gap-3 md:grid-cols-2">
              <SummaryRow
                label={tf("wholeResourceMode")}
                value={config.wholeResourceMode}
              />
              <SummaryRow
                label={tf("wholeResourceTriggerStepIndex")}
                value={config.wholeResourceTriggerStepIndex || "-"}
              />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">{tp("summaryStepList")}</div>
          <Textarea
            className="min-h-[220px] font-mono text-sm"
            readOnly
            value={commandList || "-"}
          />
        </div>
      </div>
    );
  }

  if (isOrchestrateNode(node)) {
    const config = node.data.config;

    return (
      <div className="space-y-4">
        <div className="grid gap-3">
          <SummaryRow
            label={tr("stageName")}
            value={config.name.trim() || tp("stageNode")}
          />
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryRow
              label={tr("strategy")}
              value={
                config.strategy === "parallel"
                  ? tf("strategyParallel")
                  : tf("strategySerial")
              }
            />
            <SummaryRow
              label={tr("failFast")}
              value={config.failFast ? tr("on") : tr("off")}
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryRow
              label={tf("maxParallel")}
              value={config.maxParallel || "-"}
            />
            <SummaryRow
              label={tf("actionKind")}
              value={
                config.actionKind === "tx_workflow"
                  ? tf("actionKindTxWorkflow")
                  : tf("actionKindTxBlock")
              }
            />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <SummaryRow
              label={tp("summaryTargetGroups")}
              value={config.targetGroups.trim() || "-"}
            />
            <SummaryRow
              label={tp("summaryInlineTargets")}
              value={config.targetsJson.trim() ? tr("on") : tr("off")}
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-sm font-semibold">{tp("summaryActionPayload")}</div>
          <Textarea
            className="min-h-[220px] font-mono text-sm"
            readOnly
            value={config.actionJson || "-"}
          />
        </div>
      </div>
    );
  }

  return null;
}

function WorkflowBlockInspector({
  value,
  onChange,
}: {
  value: TxWorkflowBlockFormData;
  onChange: (next: TxWorkflowBlockFormData) => void;
}) {
  const tf = useTranslations("taskForms");
  const tc = useTranslations("common");

  const updateStep = (
    index: number,
    patch: Partial<TxWorkflowStepFormData>
  ) => {
    onChange({
      ...value,
      steps: value.steps.map((step, stepIndex) =>
        stepIndex === index ? { ...step, ...patch } : step
      ),
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{tf("blockNameLabel")}</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={tf("blockNamePlaceholder")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{tf("blockKind")}</Label>
          <Select
            value={value.kind}
            onValueChange={(next) =>
              onChange({
                ...value,
                kind: next as WorkflowBlockKind,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="config">{tf("blockKindConfig")}</SelectItem>
              <SelectItem value="show">{tf("blockKindShow")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between rounded-xl border px-4 py-3">
          <div className="space-y-0.5">
            <Label>{tf("blockFailFast")}</Label>
            <p className="text-xs text-muted-foreground">
              {tf("blockFailFastHint")}
            </p>
          </div>
          <Switch
            checked={value.failFast}
            onCheckedChange={(checked) => onChange({ ...value, failFast: checked })}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{tf("rollbackPolicy")}</Label>
        <Select
          value={value.rollbackPolicy}
          onValueChange={(next) =>
            onChange({
              ...value,
              rollbackPolicy: next as WorkflowRollbackPolicy,
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="per_step">{tf("rollbackPolicyPerStep")}</SelectItem>
            <SelectItem value="whole_resource">
              {tf("rollbackPolicyWholeResource")}
            </SelectItem>
            <SelectItem value="none">{tf("rollbackPolicyNone")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {value.rollbackPolicy === "whole_resource" && (
        <div className="rounded-xl border p-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{tf("wholeResourceMode")}</Label>
              <Select
                value={value.wholeResourceMode}
                onValueChange={(next) =>
                  onChange({
                    ...value,
                    wholeResourceMode: next as TxMode,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Enable">{tc("enableMode")}</SelectItem>
                  <SelectItem value="Config">{tc("configMode")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{tf("wholeResourceTimeout")}</Label>
              <Input
                inputMode="numeric"
                value={value.wholeResourceTimeoutSecs}
                onChange={(e) =>
                  onChange({
                    ...value,
                    wholeResourceTimeoutSecs: e.target.value,
                  })
                }
                placeholder={tf("wholeResourceTimeoutPlaceholder")}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{tf("wholeResourceUndoCommand")}</Label>
            <Input
              value={value.wholeResourceUndoCommand}
              onChange={(e) =>
                onChange({
                  ...value,
                  wholeResourceUndoCommand: e.target.value,
                })
              }
              placeholder={tf("wholeResourceUndoCommandPlaceholder")}
            />
          </div>

          <div className="space-y-2">
            <Label>{tf("wholeResourceTriggerStepIndex")}</Label>
            <Input
              inputMode="numeric"
              value={value.wholeResourceTriggerStepIndex}
              onChange={(e) =>
                onChange({
                  ...value,
                  wholeResourceTriggerStepIndex: e.target.value,
                })
              }
              placeholder={tf("wholeResourceTriggerStepIndexPlaceholder")}
            />
          </div>
        </div>
      )}

      <Separator />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>{tf("commandList")}</Label>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                steps: [...value.steps, defaultWorkflowStep()],
              })
            }
          >
            <Plus className="mr-2 h-4 w-4" />
            {tf("addCommand")}
          </Button>
        </div>

        {value.steps.map((step, index) => (
          <div key={index} className="rounded-xl border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {tf("stepNumber", { number: index + 1 })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    steps: value.steps.filter((_, stepIndex) => stepIndex !== index),
                  })
                }
                disabled={value.steps.length === 1}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>{tf("stepMode")}</Label>
                <Select
                  value={step.mode}
                  onValueChange={(next) =>
                    updateStep(index, { mode: next as TxMode })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Enable">{tc("enableMode")}</SelectItem>
                    <SelectItem value="Config">{tc("configMode")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{tf("stepTimeout")}</Label>
                <Input
                  inputMode="numeric"
                  value={step.timeoutSecs}
                  onChange={(e) =>
                    updateStep(index, { timeoutSecs: e.target.value })
                  }
                  placeholder={tf("stepTimeoutPlaceholder")}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{tf("commandLabel")}</Label>
              <Input
                value={step.command}
                onChange={(e) => updateStep(index, { command: e.target.value })}
                placeholder={tf("commandPlaceholder")}
              />
            </div>

            <div className="space-y-2">
              <Label>{tf("rollbackCommand")}</Label>
              <Input
                value={step.rollbackCommand}
                onChange={(e) =>
                  updateStep(index, { rollbackCommand: e.target.value })
                }
                placeholder={tf("rollbackCommandPlaceholder")}
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border px-4 py-3">
              <div className="space-y-0.5">
                <Label>{tf("rollbackOnFailure")}</Label>
                <p className="text-xs text-muted-foreground">
                  {tf("rollbackOnFailureHint")}
                </p>
              </div>
              <Switch
                checked={step.rollbackOnFailure}
                onCheckedChange={(checked) =>
                  updateStep(index, { rollbackOnFailure: checked })
                }
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OrchestrateStageInspector({
  value,
  onChange,
}: {
  value: OrchestrateStageFormData;
  onChange: (next: OrchestrateStageFormData) => void;
}) {
  const tf = useTranslations("taskForms");

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{tf("stageName")}</Label>
        <Input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          placeholder={tf("stageNamePlaceholder")}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>{tf("executionStrategy")}</Label>
          <Select
            value={value.strategy}
            onValueChange={(next) =>
              onChange({
                ...value,
                strategy: next as StageStrategy,
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="serial">{tf("strategySerial")}</SelectItem>
              <SelectItem value="parallel">{tf("strategyParallel")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{tf("maxParallel")}</Label>
          <Input
            inputMode="numeric"
            value={value.maxParallel}
            onChange={(e) => onChange({ ...value, maxParallel: e.target.value })}
            placeholder={tf("maxParallelPlaceholder")}
          />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl border px-4 py-3">
        <div className="space-y-0.5">
          <Label>{tf("stageFailFast")}</Label>
          <p className="text-xs text-muted-foreground">{tf("stageFailFastHint")}</p>
        </div>
        <Switch
          checked={value.failFast}
          onCheckedChange={(checked) => onChange({ ...value, failFast: checked })}
        />
      </div>

      <div className="space-y-2">
        <Label>{tf("targetGroups")}</Label>
        <Input
          value={value.targetGroups}
          onChange={(e) => onChange({ ...value, targetGroups: e.target.value })}
          placeholder={tf("targetGroupsPlaceholder")}
        />
      </div>

      <div className="space-y-2">
        <Label>{tf("targetsJson")}</Label>
        <Textarea
          className="min-h-[120px] font-mono text-sm"
          value={value.targetsJson}
          onChange={(e) => onChange({ ...value, targetsJson: e.target.value })}
          placeholder={tf("targetsJsonPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{tf("targetsJsonHint")}</p>
      </div>

      <div className="space-y-2">
        <Label>{tf("actionKind")}</Label>
        <Select
          value={value.actionKind}
          onValueChange={(next) =>
            onChange({
              ...value,
              actionKind: next as OrchestrationActionKind,
              actionJson:
                next === "tx_workflow"
                  ? JSON.stringify({ workflow_file: "./core-vlan-workflow.json" }, null, 2)
                  : JSON.stringify(
                      {
                        name: "stage-change",
                        mode: "Config",
                        commands: ["show version"],
                      },
                      null,
                      2
                    ),
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="tx_block">{tf("actionKindTxBlock")}</SelectItem>
            <SelectItem value="tx_workflow">{tf("actionKindTxWorkflow")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{tf("actionJson")}</Label>
        <Textarea
          className="min-h-[180px] font-mono text-sm"
          value={value.actionJson}
          onChange={(e) => onChange({ ...value, actionJson: e.target.value })}
          placeholder={tf("actionJsonPlaceholder")}
        />
        <p className="text-xs text-muted-foreground">{tf("actionJsonHint")}</p>
      </div>
    </div>
  );
}
