import type { DispatchType } from "@/lib/types";
import { FallbackJson } from "./shared";
import { ExecResult } from "./exec-result";
import { TemplateResult } from "./template-result";
import { TxBlockResult } from "./tx-block-result";
import { TxWorkflowResult } from "./tx-workflow-result";
import { OrchestrateResult } from "./orchestrate-result";
import { useTranslations } from "next-intl";

interface ResultRendererProps {
  dispatchType: DispatchType;
  result: unknown;
}

// Route each dispatch type to its matching result component
export function ResultRenderer({ dispatchType, result }: ResultRendererProps) {
  const tc = useTranslations("common");

  if (result === null || result === undefined) {
    return (
      <span className="text-muted-foreground text-sm italic">
        {tc("noData")}
      </span>
    );
  }

  // Ensure result is an object before rendering
  const data =
    typeof result === "object" && !Array.isArray(result)
      ? (result as Record<string, unknown>)
      : null;

  if (!data) {
    return <FallbackJson data={result} />;
  }

  switch (dispatchType) {
    case "exec":
      return <ExecResult result={data} />;
    case "template":
      return <TemplateResult result={data} />;
    case "tx_block":
      return <TxBlockResult result={data} />;
    case "tx_workflow":
      return <TxWorkflowResult result={data} />;
    case "orchestrate":
      return <OrchestrateResult result={data} />;
    default:
      return <FallbackJson data={result} />;
  }
}
