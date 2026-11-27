import { InfoPage, infoMetadata } from "@/components/site/info-page";

export const metadata = infoMetadata("refunds");

export default function Page() {
  return <InfoPage pageKey="refunds" />;
}
