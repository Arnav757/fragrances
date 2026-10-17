import { InfoPage, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("returns");

export default function Page() {
  return <InfoPage pageKey="returns" />;
}
