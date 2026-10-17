import { InfoPage, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("terms");

export default function Page() {
  return <InfoPage pageKey="terms" />;
}
