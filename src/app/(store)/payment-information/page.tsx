import { InfoPage, infoMetadata } from "@/components/store/info-page";

export const metadata = infoMetadata("payment");

export default function Page() {
  return <InfoPage pageKey="payment" />;
}
