import { MixerHorizontalIcon } from "@radix-ui/react-icons";
import { ConfigPage, PageHeader, EmptyState } from "../../components/config";

export function OutputStylesView() {
  return (
    <ConfigPage>
      <PageHeader title="Output Styles" subtitle="Response formatting styles" />
      <EmptyState
        icon={MixerHorizontalIcon}
        message="Coming soon"
        hint="Output styles will be available in a future update"
      />
    </ConfigPage>
  );
}
