import { useTranslations } from "next-intl";
import { MetaCard, MetaGrid, OutputBlock } from "./shared";
import { asNumber, asString } from "./result-helpers";

interface ExecResultProps {
  result: Record<string, unknown>;
}

export function ExecResult({ result }: ExecResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const output = asString(result.output) ?? asString(result.result) ?? null;
  const error = asString(result.error);
  const exitCode = asNumber(result.exit_code);

  return (
    <div className="space-y-2">
      {exitCode !== undefined && (
        <MetaGrid>
          <MetaCard label={t("exitCode")} value={exitCode} />
        </MetaGrid>
      )}
      {output && <OutputBlock content={output} maxHeight="400px" />}
      {error && (
        <OutputBlock content={error} maxHeight="200px" isError />
      )}
      {!output && !error && (
        <span className="text-muted-foreground text-sm italic">
          {t("noOutput")}
        </span>
      )}
    </div>
  );
}
