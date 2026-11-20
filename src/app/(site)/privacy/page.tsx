import { InfoPage, infoMetadata } from "@/components/site/info-page";

export const metadata = infoMetadata("privacy");

export default function Page() {
  return <InfoPage pageKey="privacy" />;
}
