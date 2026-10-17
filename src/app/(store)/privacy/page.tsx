import { InfoPage, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("privacy");

export default function Page() {
  return <InfoPage pageKey="privacy" />;
}
