import { useTranslations } from "next-intl";
import { OutputBlock } from "./shared";

interface ExecResultProps {
  result: Record<string, unknown>;
}

export function ExecResult({ result }: ExecResultProps) {
  const t = useTranslations("dialogs.taskResult");

  const output = (result.output as string) ?? (result.result as string) ?? null;
  const error = result.error as string | undefined;

  return (
    <div className="space-y-2">
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
