import { InfoPage, infoMetadata } from "@/components/site/info-page";

export const metadata = infoMetadata("terms");

export default function Page() {
  return <InfoPage pageKey="terms" />;
}
